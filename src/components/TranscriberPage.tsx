'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import AudioRecorder from '@/components/AudioRecorder';
import AudioFileUpload from '@/components/AudioFileUpload';
import TranscriptionResult from '@/components/TranscriptionResult';
import LocalAudioBackup from '@/components/LocalAudioBackup';
import { TranscriptionModelType, getAllModels, getModelById } from '@/lib/transcriptionModels';
import { compressAudio, formatBytes } from '@/lib/audioUtils';
import { audioStorageManager } from '@/lib/audioStorageManager';

// Legacy feature flags (false for production deploy).
const ENABLE_LEGACY_TEST_UPLOAD = false;
const ENABLE_LEGACY_LOCAL_BACKUP = false;

interface HistoryEntry {
  id: string;
  timestamp: string;
  model: TranscriptionModelType;
  content: string;
  duration: number; // em segundos
  audioId?: string; // ID do áudio armazenado localmente
}

export default function TranscriberPage() {
  const router = useRouter();
  const [selectedModel, setSelectedModel] = useState<TranscriptionModelType>('soap');
  const [transcriptionContent, setTranscriptionContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastRecordingTime, setLastRecordingTime] = useState<string>('');
  const [processingError, setProcessingError] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [compressionStatus, setCompressionStatus] = useState('');
  const [savedAudioInfo, setSavedAudioInfo] = useState<{ id: string; size: string } | null>(null);
  const [backupRefreshTrigger, setBackupRefreshTrigger] = useState(0);
  const [processingMeta, setProcessingMeta] = useState<{
    originalBytes: number;
    sentBytes: number;
    compressed: boolean;
    chunked: boolean;
    chunksProcessed: number;
  } | null>(null);

  const handleRecordingComplete = async (audioBlob: Blob, duration: number) => {
    setIsLoading(true);
    setTranscriptionContent('');
    setProcessingError('');
    setCompressionStatus('');
    setSavedAudioInfo(null);
    setProcessingMeta(null);
    setRecordingDuration(duration);

    let audioId: string | undefined;

    try {
      // Etapa 1 (legacy): Salvar áudio no IndexedDB como backup local
      if (ENABLE_LEGACY_LOCAL_BACKUP) {
        try {
          setCompressionStatus('💾 Salvando áudio como backup local...');
          audioId = await audioStorageManager.saveAudio(audioBlob, duration, selectedModel);
          console.log('Áudio salvo com ID:', audioId);
        } catch (storageError) {
          console.warn('Aviso: Não foi possível salvar backup local:', storageError);
        }
      }

      // Etapa 2: Processar áudio (compressão adaptativa, igual ao fluxo legado de upload)
      let audioToSend = audioBlob;

      if (audioBlob.size > 10 * 1024 * 1024) {
        setCompressionStatus('🗜️ Comprimindo áudio antes do envio...');
        const targetRates = [8000, 4000, 2000];
        const chunkThresholdBytes = 15 * 1024 * 1024;

        for (const targetRate of targetRates) {
          const compressed = await compressAudio(audioToSend, targetRate);

          if (compressed.size < audioToSend.size) {
            console.log(
              `Gravação comprimida @${targetRate}Hz: ${formatBytes(audioToSend.size)} → ${formatBytes(compressed.size)}`
            );
            audioToSend = compressed;
          }

          if (audioToSend.size <= chunkThresholdBytes) {
            break;
          }
        }

        if (audioToSend.size < audioBlob.size) {
          setCompressionStatus(
            `✅ Compressão aplicada: ${formatBytes(audioBlob.size)} → ${formatBytes(audioToSend.size)}`
          );
        } else {
          setCompressionStatus(
            `⚠️ Não houve redução (${formatBytes(audioBlob.size)}). Enviando original; API fará chunking apenas se necessário.`
          );
        }
      }

      // Etapa 3: Enviar para API de transcrição
      setCompressionStatus('🚀 Enviando para processamento...');

      const formData = new FormData();
      formData.append('audio', audioToSend, 'recording.wav');
      formData.append('model', selectedModel);
      if (audioId) {
        formData.append('audioId', audioId);
      }

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Sessão expirada ou inválida. Faça login novamente.');
        }

        const errorMsg = data?.details || data?.error || `API error: ${response.statusText}`;

        // Se for erro 413 (Payload Too Large), informar claramente
        if (response.status === 413) {
          throw new Error(
            `Arquivo muito grande (${formatBytes(audioBlob.size)}). Máximo suportado: ~18 MB. Grave um trecho mais curto.`
          );
        }

        throw new Error(errorMsg);
      }

      // Etapa 4: Sucesso
      if (audioId) {
        try {
          await audioStorageManager.updateAudioStatus(audioId, 'completed');
        } catch (error) {
          console.warn('Não foi possível atualizar status:', error);
        }
      }

      setCompressionStatus('✅ Transcrição concluída com sucesso!');
      setProcessingMeta({
        originalBytes: audioBlob.size,
        sentBytes: audioToSend.size,
        compressed: audioToSend.size < audioBlob.size,
        chunked: Boolean(data?.chunked),
        chunksProcessed: Number(data?.chunksProcessed || 1),
      });
      setTranscriptionContent(data.content);
      const timestamp = new Date().toLocaleString('pt-BR');
      setLastRecordingTime(timestamp);

      if (audioId) {
        setSavedAudioInfo({ id: audioId, size: formatBytes(audioBlob.size) });
        setBackupRefreshTrigger((prev) => prev + 1);
      }

      // Add to history
      const newEntry: HistoryEntry = {
        id: Date.now().toString(),
        timestamp,
        model: selectedModel,
        content: data.content,
        duration,
        audioId,
      };
      setHistory((prev) => [newEntry, ...prev]);
    } catch (error) {
      console.error('Error:', error);
      const errorMsg = (error as Error).message;
      setProcessingError(errorMsg);
      setCompressionStatus(`❌ Erro: ${errorMsg}`);

      if (errorMsg.includes('Sessão expirada') || errorMsg.includes('Não autenticado')) {
        setTimeout(() => {
          router.push('/login');
        }, 1200);
      }

      // Marcar áudio como falho
      if (audioId) {
        try {
          await audioStorageManager.updateAudioStatus(audioId, 'failed', errorMsg);
          if (ENABLE_LEGACY_LOCAL_BACKUP) {
            setBackupRefreshTrigger((prev) => prev + 1);
          }
        } catch (updateError) {
          console.warn('Não foi possível atualizar status de erro:', updateError);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (file: File, duration: number) => {
    setIsLoading(true);
    setTranscriptionContent('');
    setProcessingError('');
    setCompressionStatus('');
    setSavedAudioInfo(null);
    setProcessingMeta(null);
    setRecordingDuration(duration);

    let audioId: string | undefined;

    try {
      // Etapa 1: Salvar áudio no backup
      try {
        setCompressionStatus('💾 Salvando arquivo como backup local...');
        audioId = await audioStorageManager.saveAudio(file, duration, selectedModel);
      } catch (storageError) {
        console.warn('Aviso: Não foi possível salvar backup:', storageError);
      }

      // Etapa 2: Tentar comprimir antes de enviar
      let audioToSend: Blob = file;
      if (file.size > 10 * 1024 * 1024) {
        setCompressionStatus('🗜️ Comprimindo arquivo antes do envio...');
        const targetRates = [8000, 4000, 2000];
        const chunkThresholdBytes = 15 * 1024 * 1024;

        for (const targetRate of targetRates) {
          const compressed = await compressAudio(audioToSend, targetRate);

          if (compressed.size < audioToSend.size) {
            console.log(
              `Upload comprimido @${targetRate}Hz: ${formatBytes(audioToSend.size)} → ${formatBytes(compressed.size)}`
            );
            audioToSend = compressed;
          }

          if (audioToSend.size <= chunkThresholdBytes) {
            break;
          }
        }

        if (audioToSend.size < file.size) {
          setCompressionStatus(
            `✅ Compressão aplicada: ${formatBytes(file.size)} → ${formatBytes(audioToSend.size)}`
          );
        } else {
          setCompressionStatus(
            `⚠️ Não houve redução no cliente (${formatBytes(file.size)}). Enviando original; API fará chunking apenas se necessário.`
          );
          console.log('Compressão de upload não reduziu tamanho, mantendo original');
        }
      }

      // Etapa 3: Enviar para processamento (chunking é último recurso no servidor)
      setCompressionStatus('🚀 Enviando arquivo para processamento...');

      const formData = new FormData();
      formData.append('audio', audioToSend, file.name || 'uploaded-audio.wav');
      formData.append('model', selectedModel);
      if (audioId) {
        formData.append('audioId', audioId);
      }

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Sessão expirada ou inválida. Faça login novamente.');
        }

        const errorMsg = data?.details || data?.error || `API error: ${response.statusText}`;
        throw new Error(errorMsg);
      }

      // Etapa 4: Sucesso
      if (audioId) {
        try {
          await audioStorageManager.updateAudioStatus(audioId, 'completed');
        } catch (error) {
          console.warn('Não foi possível atualizar status:', error);
        }
      }

      const processInfo = data.chunked
        ? `✅ Processado em ${data.chunksProcessed} partes (${formatBytes(audioToSend.size)})`
        : '✅ Transcrição concluída com sucesso!';

      setCompressionStatus(processInfo);
      setProcessingMeta({
        originalBytes: file.size,
        sentBytes: audioToSend.size,
        compressed: audioToSend.size < file.size,
        chunked: Boolean(data?.chunked),
        chunksProcessed: Number(data?.chunksProcessed || 1),
      });
      setTranscriptionContent(data.content);
      const timestamp = new Date().toLocaleString('pt-BR');
      setLastRecordingTime(timestamp);

      if (audioId) {
        setSavedAudioInfo({ id: audioId, size: formatBytes(file.size) });
        setBackupRefreshTrigger((prev) => prev + 1);
      }

      // Add to history
      const newEntry: HistoryEntry = {
        id: Date.now().toString(),
        timestamp,
        model: selectedModel,
        content: data.content,
        duration,
        audioId,
      };
      setHistory((prev) => [newEntry, ...prev]);
    } catch (error) {
      console.error('Error:', error);
      const errorMsg = (error as Error).message;
      setProcessingError(errorMsg);
      setCompressionStatus(`❌ Erro: ${errorMsg}`);

      if (errorMsg.includes('Sessão expirada') || errorMsg.includes('Não autenticado')) {
        setTimeout(() => {
          router.push('/login');
        }, 1200);
      }

      // Marcar áudio como falho
      if (audioId) {
        try {
          await audioStorageManager.updateAudioStatus(audioId, 'failed', errorMsg);
          setBackupRefreshTrigger((prev) => prev + 1);
        } catch (updateError) {
          console.warn('Não foi possível atualizar status de erro:', updateError);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout');
    router.push('/login');
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#f8fafb] to-[#f3f6f9]">

      {/* Header com logo */}
      <header className="bg-white border-b border-[#e0e8f0] shadow-sm">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo Image */}
            <Image
              src="/logo.png"
              alt="MedTranscript Logo"
              width={40}
              height={40}
              priority
              className="w-8 h-8"
            />
            <div className="flex flex-col">
              <span className="font-bold text-[#003f87] text-sm tracking-tight">MedTranscript</span>
              <span className="text-[10px] text-[#5dd462] font-semibold">Seu assistente médico</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm font-medium text-[#607080] hover:text-[#003f87] transition"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Hero Section - Logo apenas */}
      <div className="max-w-6xl mx-auto px-6 pt-16 sm:pt-24 pb-16 flex justify-center">
        <Image
          src="/logo.png"
          alt="MedTranscript Logo"
          width={600}
          height={200}
          priority
          className="w-full max-w-2xl h-auto"
        />
      </div>

      {/* Seletor de Modelo */}
      <div className="max-w-5xl mx-auto px-6 pb-6">
        <div className="bg-white rounded-xl border border-[#e0e8f0] p-6 shadow-sm">
          <label className="block text-xs font-bold text-[#003f87] tracking-widest uppercase mb-5">
            Selecione o Modelo de Transcrição
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {getAllModels().map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  setSelectedModel(model.id);
                  setTranscriptionContent(''); // Limpar resultado anterior ao trocar modelo
                }}
                className={`text-left p-5 rounded-xl border-2 transition transform hover:scale-105 ${
                  selectedModel === model.id
                    ? 'border-[#5dd462] bg-gradient-to-br from-[#f0fdf4] to-[#e8f7f1] shadow-md'
                    : 'border-[#e0e8f0] bg-white hover:border-[#003f87] hover:shadow-sm'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${
                    selectedModel === model.id
                      ? 'border-[#5dd462] bg-[#5dd462]'
                      : 'border-[#dde2e8]'
                  }`}>
                    {selectedModel === model.id && (
                      <span className="text-white text-xs font-bold">✓</span>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-[#003f87] text-base">{model.name}</p>
                    <p className="text-xs text-[#607080] mt-1">{model.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Painéis principais */}
      <div className="max-w-5xl mx-auto px-6 pb-8">
        <div className="flex flex-col gap-5">
          <AudioRecorder onRecordingComplete={handleRecordingComplete} isLoading={isLoading} />

          {ENABLE_LEGACY_TEST_UPLOAD && (
            <AudioFileUpload onFileSelected={handleFileUpload} isLoading={isLoading} />
          )}

          {/* Status de Compressão e Armazenamento */}
          {compressionStatus && (
            <div className={`rounded-xl border p-4 ${
              compressionStatus.startsWith('✅')
                ? 'border-green-200 bg-green-50 text-green-700'
                : compressionStatus.startsWith('❌')
                  ? 'border-red-200 bg-red-50 text-red-700'
                  : 'border-blue-200 bg-blue-50 text-blue-700'
            }`}>
              <p className="text-sm font-medium">{compressionStatus}</p>
            </div>
          )}

          {/* Informações de Áudio Armazenado (legacy) */}
          {ENABLE_LEGACY_LOCAL_BACKUP && savedAudioInfo && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4">
              <div className="flex items-start gap-3">
                <div className="text-green-600 text-xl mt-0.5">💾</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900 mb-1">
                    Áudio salvo como backup local
                  </p>
                  <p className="text-xs text-green-700 mb-2">
                    Tamanho: <strong>{savedAudioInfo.size}</strong> | ID: <code className="bg-white px-2 py-1 rounded text-xs">{savedAudioInfo.id.substring(0, 20)}...</code>
                  </p>
                  <p className="text-xs text-green-700">
                    Se o processamento falhar, você poderá recuperar este arquivo. Não feche a aba até confirmar o sucesso.
                  </p>
                </div>
              </div>
            </div>
          )}

          {processingMeta && (
            <div className="rounded-xl border border-[#dde2e8] bg-[#f9fafb] p-4">
              <p className="text-xs font-semibold text-[#607080] tracking-widest uppercase mb-3">
                Diagnóstico do Processamento
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-[#1a2e45]">
                <p>Tamanho original: <strong>{formatBytes(processingMeta.originalBytes)}</strong></p>
                <p>Tamanho enviado: <strong>{formatBytes(processingMeta.sentBytes)}</strong></p>
                <p>Compressão aplicada: <strong>{processingMeta.compressed ? 'Sim' : 'Não'}</strong></p>
                <p>Chunking no servidor: <strong>{processingMeta.chunked ? `Sim (${processingMeta.chunksProcessed} partes)` : 'Não'}</strong></p>
              </div>
            </div>
          )}

          <TranscriptionResult
            content={transcriptionContent}
            model={selectedModel}
            isLoading={isLoading}
            errorMessage={processingError}
          />
        </div>
      </div>

      {/* Histórico de Consultas */}
      {history.length > 0 && (
        <div className="max-w-5xl mx-auto px-6 pb-8">
          <div className="bg-white border border-[#dde2e8] rounded-xl p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <p className="text-xs font-semibold text-[#607080] tracking-widest uppercase">
                Histórico da Sessão
              </p>
              <span className="text-xs bg-[#f0fdf4] text-[#5dd462] px-3 py-1 rounded-full font-medium">
                {history.length} consulta{history.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="space-y-3">
              {history.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => {
                    setTranscriptionContent(entry.content);
                    setSelectedModel(entry.model);
                  }}
                  className="w-full text-left p-4 rounded-lg border border-[#dde2e8] bg-[#f9fafb] hover:bg-[#f4f6f9] hover:border-[#003f87] transition"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1a2e45] mb-1">
                        {getModelById(entry.model).name}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-[#607080]">
                        <span>📅 {entry.timestamp}</span>
                        <span>⏱️ {Math.floor(entry.duration / 60)}m {entry.duration % 60}s</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <div className="text-sm font-medium text-[#003f87] bg-white rounded-md px-3 py-1.5 border border-[#dde2e8]">
                        Ver
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Backup Local de Áudios (legacy) */}
      {ENABLE_LEGACY_LOCAL_BACKUP && (
        <div className="max-w-5xl mx-auto px-6 pb-8">
          <LocalAudioBackup refreshTrigger={backupRefreshTrigger} />
        </div>
      )}

      {/* Como usar — passos horizontais */}
      <div className="max-w-5xl mx-auto px-6 pb-14">
        <div className="bg-white border border-[#dde2e8] rounded-xl p-6 sm:p-8">
          <p className="text-xs font-semibold text-[#607080] mb-6 tracking-widest uppercase">Como usar</p>
          <ol className="flex flex-col sm:flex-row gap-5">
            {[
              'Escolha entre consulta presencial e teleconsulta.',
              'Autorize o microfone — na teleconsulta, compartilhe também a aba com áudio.',
              'Inicie a gravação e conduza a consulta normalmente.',
              'Pare ao final e aguarde o resultado gerado.',
              'Copie o conteúdo para o prontuário eletrônico.',
            ].map((step, i) => (
              <li key={i} className="flex gap-3 flex-1">
                <span className="flex-shrink-0 w-5 h-5 mt-0.5 rounded-full bg-[#1a2e45] text-white text-[10px] font-semibold flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="text-sm text-[#607080] leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </div>

        {lastRecordingTime && (
          <p className="text-xs text-[#607080] text-right mt-4">
            Último processamento: {lastRecordingTime}
          </p>
        )}
      </div>

    </main>
  );
}