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
// Em Vercel, uploads para API route podem ser rejeitados antes do handler (~4.5 MB).
// Mantemos margem para evitar 413 no edge/proxy.
const NATIVE_QUALITY_MAX_BYTES = 4 * 1024 * 1024;

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

      if (audioBlob.size > NATIVE_QUALITY_MAX_BYTES) {
        setCompressionStatus('🗜️ Comprimindo áudio antes do envio...');
        const targetRates = [8000, 4000, 2000];
        const chunkThresholdBytes = NATIVE_QUALITY_MAX_BYTES;

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

        // Se for erro 413 (Payload Too Large), houve rejeição do provedor/plataforma de processamento.
        if (response.status === 413) {
          throw new Error(
            `Arquivo muito grande para envio (${formatBytes(audioToSend.size)}). Tente novamente ou grave um trecho mais curto.`
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

      // Etapa 2: Só comprimir acima de 15MB; abaixo disso manter qualidade nativa
      let audioToSend: Blob = file;
      if (file.size > NATIVE_QUALITY_MAX_BYTES) {
        setCompressionStatus('🗜️ Comprimindo arquivo antes do envio...');
        const targetRates = [8000, 4000, 2000];
        const chunkThresholdBytes = NATIVE_QUALITY_MAX_BYTES;

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

  const activeModel = getModelById(selectedModel);
  const latestEntry = history[0];
  const totalSessionDuration = history.reduce((sum, entry) => sum + entry.duration, 0);
  const storagePercent = Math.min(Math.round((history.length / 20) * 100), 100);

  const formatDurationLabel = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#edf4f6] text-[#0c161c] lg:flex">
      <aside className="hidden lg:flex lg:w-72 lg:flex-col border-r border-[#cfe0e8] bg-white">
        <div className="p-6 flex items-center gap-3 border-b border-[#edf4f6]">
          <Image src="/favicon.png" alt="OmniNote Favicon" width={40} height={40} className="w-10 h-10" priority />
          <div>
            <h1 className="font-bold text-[#155b79] text-lg leading-tight">OmniNote</h1>
            <p className="text-xs text-[#1ea58c] font-semibold">Visão integral e multiprofissional</p>
          </div>
        </div>

        <nav className="p-4 space-y-1">
          <button className="w-full text-left px-3 py-2.5 rounded-lg bg-[#e5f4f8] text-[#155b79] font-semibold">Dashboard</button>
          <button className="w-full text-left px-3 py-2.5 rounded-lg text-[#4b6573] hover:bg-[#f2f8fa] transition">Pacientes</button>
          <button className="w-full text-left px-3 py-2.5 rounded-lg text-[#4b6573] hover:bg-[#f2f8fa] transition">Histórico</button>
          <button className="w-full text-left px-3 py-2.5 rounded-lg text-[#4b6573] hover:bg-[#f2f8fa] transition">Painel de Pacientes</button>
        </nav>

        <div className="p-4 mt-auto">
          <div className="rounded-xl border border-[#cfe0e8] bg-[#f7fbfc] p-4">
            <p className="text-xs font-semibold text-[#155b79] tracking-widest uppercase mb-2">Sessão atual</p>
            <div className="w-full bg-[#dcebf1] rounded-full h-2 mb-2">
              <div className="bg-[#1ea58c] h-2 rounded-full" style={{ width: `${storagePercent}%` }}></div>
            </div>
            <p className="text-xs text-[#4b6573]">{history.length} transcrição(ões) nesta sessão</p>
          </div>
        </div>
      </aside>

      <main className="flex-1">
        <header className="h-16 border-b border-[#cfe0e8] bg-white/90 backdrop-blur px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-[#155b79]">Dashboard OmniNote</h2>
            <p className="text-xs text-[#4b6573] hidden sm:block">Transcrição clínica com visão multiprofissional</p>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg bg-[#f2f8fa] border border-[#cfe0e8]">
              <Image src="/favicon.png" alt="OmniNote Favicon" width={20} height={20} className="w-5 h-5" />
              <span className="text-sm text-[#4b6573]">{activeModel.name}</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-[#4b6573] hover:text-[#155b79] transition"
            >
              Sair
            </button>
          </div>
        </header>

        <div className="p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-[#cfe0e8] rounded-xl p-5 shadow-sm">
              <p className="text-sm text-[#4b6573]">Transcrições na sessão</p>
              <p className="text-2xl font-bold text-[#155b79] mt-1">{history.length}</p>
              <p className="text-xs text-[#1ea58c] mt-2">Atualiza automaticamente após cada processamento</p>
            </div>

            <div className="bg-white border border-[#cfe0e8] rounded-xl p-5 shadow-sm">
              <p className="text-sm text-[#4b6573]">Última gravação</p>
              <p className="text-2xl font-bold text-[#155b79] mt-1">{recordingDuration > 0 ? formatDurationLabel(recordingDuration) : '--:--'}</p>
              <p className="text-xs text-[#1ea58c] mt-2">Duração da gravação mais recente</p>
            </div>

            <div className="bg-white border border-[#cfe0e8] rounded-xl p-5 shadow-sm">
              <p className="text-sm text-[#4b6573]">Tempo total na sessão</p>
              <p className="text-2xl font-bold text-[#155b79] mt-1">{formatDurationLabel(totalSessionDuration)}</p>
              <p className="text-xs text-[#1ea58c] mt-2">Soma das gravações processadas</p>
            </div>
          </div>

          <div className="bg-white border border-[#cfe0e8] rounded-xl p-5 sm:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#155b79]">Atividade de transcrição</h3>
                <p className="text-xs sm:text-sm text-[#4b6573]">Visão semanal de volume</p>
              </div>
            </div>

            <div className="h-40 w-full">
              <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 800 200">
                <defs>
                  <linearGradient id="omniGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#1a6a8d" stopOpacity="0.18"></stop>
                    <stop offset="100%" stopColor="#1a6a8d" stopOpacity="0"></stop>
                  </linearGradient>
                </defs>
                <path d="M0 160 Q 100 130, 200 150 T 400 90 T 600 120 T 800 70 V 200 H 0 Z" fill="url(#omniGradient)"></path>
                <path d="M0 160 Q 100 130, 200 150 T 400 90 T 600 120 T 800 70" fill="none" stroke="#1a6a8d" strokeWidth="3" strokeLinecap="round"></path>
              </svg>
              <div className="flex justify-between mt-3 px-1 text-[10px] sm:text-xs text-[#4b6573] font-medium">
                <span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span><span>Dom</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <section className="xl:col-span-2 space-y-5">
              <div className="bg-white rounded-xl border border-[#cfe0e8] p-5 sm:p-6 shadow-sm">
                <label className="block text-xs font-bold text-[#155b79] tracking-widest uppercase mb-4">
                  Selecione o modelo de transcrição
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {getAllModels().map((model) => (
                    <button
                      key={model.id}
                      onClick={() => {
                        setSelectedModel(model.id);
                        setTranscriptionContent('');
                      }}
                      className={`text-left p-4 rounded-xl border-2 transition ${
                        selectedModel === model.id
                          ? 'border-[#1ea58c] bg-gradient-to-br from-[#effaf7] to-[#e5f4f8] shadow-sm'
                          : 'border-[#cfe0e8] bg-white hover:border-[#155b79]'
                      }`}
                    >
                      <p className="font-semibold text-[#155b79] text-sm">{model.name}</p>
                      <p className="text-xs text-[#4b6573] mt-1">{model.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              <AudioRecorder onRecordingComplete={handleRecordingComplete} isLoading={isLoading} />

              {ENABLE_LEGACY_TEST_UPLOAD && (
                <AudioFileUpload onFileSelected={handleFileUpload} isLoading={isLoading} />
              )}

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

              {ENABLE_LEGACY_LOCAL_BACKUP && savedAudioInfo && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-green-600 text-xl mt-0.5">💾</div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-900 mb-1">Áudio salvo como backup local</p>
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
                <div className="rounded-xl border border-[#cfe0e8] bg-[#f7fbfc] p-4">
                  <p className="text-xs font-semibold text-[#4b6573] tracking-widest uppercase mb-3">Diagnóstico do processamento</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-[#0c161c]">
                    <p>Tamanho original: <strong>{formatBytes(processingMeta.originalBytes)}</strong></p>
                    <p>Tamanho enviado: <strong>{formatBytes(processingMeta.sentBytes)}</strong></p>
                    <p>Compressão aplicada: <strong>{processingMeta.compressed ? 'Sim' : 'Não'}</strong></p>
                    <p>Chunking no servidor: <strong>{processingMeta.chunked ? `Sim (${processingMeta.chunksProcessed} partes)` : 'Não'}</strong></p>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                <p className="text-xs font-semibold text-amber-900 tracking-widest uppercase mb-2">Aviso importante</p>
                <p className="text-sm text-amber-900 leading-relaxed">
                  As informações transcritas podem conter erros, especialmente quando a qualidade do áudio gravado
                  ou enviado estiver reduzida. Todo conteúdo em texto deve ser obrigatoriamente revisado e validado
                  pelo profissional médico antes de qualquer uso clínico.
                </p>
              </div>

              <TranscriptionResult
                content={transcriptionContent}
                model={selectedModel}
                isLoading={isLoading}
                errorMessage={processingError}
              />

              {ENABLE_LEGACY_LOCAL_BACKUP && (
                <LocalAudioBackup refreshTrigger={backupRefreshTrigger} />
              )}
            </section>

            <aside className="space-y-5">
              <div className="bg-white border border-[#cfe0e8] rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-[#edf4f6] flex items-center justify-between">
                  <h4 className="font-bold text-[#155b79] text-sm sm:text-base">Transcrições recentes</h4>
                  <span className="text-xs text-[#4b6573]">Sessão</span>
                </div>

                <div className="max-h-[420px] overflow-y-auto divide-y divide-[#edf4f6]">
                  {history.length === 0 && (
                    <div className="p-5 text-sm text-[#4b6573]">
                      Nenhuma transcrição ainda. Inicie uma gravação para popular o painel.
                    </div>
                  )}

                  {history.slice(0, 6).map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => {
                        setTranscriptionContent(entry.content);
                        setSelectedModel(entry.model);
                      }}
                      className="w-full text-left p-4 hover:bg-[#f7fbfc] transition"
                    >
                      <p className="text-sm font-semibold text-[#0c161c]">{getModelById(entry.model).name}</p>
                      <p className="text-xs text-[#4b6573] mt-1">{entry.timestamp}</p>
                      <p className="text-xs text-[#1ea58c] mt-1">Duração: {formatDurationLabel(entry.duration)}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-[#cfe0e8] rounded-xl p-5 shadow-sm">
                <h4 className="font-bold text-[#155b79] text-sm sm:text-base mb-3">Resumo rápido</h4>
                <ul className="space-y-2 text-sm text-[#4b6573]">
                  <li>Modelo ativo: <strong>{activeModel.name}</strong></li>
                  <li>Último processamento: <strong>{lastRecordingTime || 'Não processado'}</strong></li>
                  <li>Status atual: <strong>{isLoading ? 'Processando...' : 'Pronto'}</strong></li>
                  <li>Último item: <strong>{latestEntry ? formatDurationLabel(latestEntry.duration) : '--:--'}</strong></li>
                </ul>
              </div>

              <div className="bg-white border border-[#cfe0e8] rounded-xl p-5 shadow-sm">
                <h4 className="font-bold text-[#155b79] text-sm sm:text-base mb-3">Como usar</h4>
                <ol className="space-y-2 text-sm text-[#4b6573]">
                  {[
                    'Escolha consulta presencial ou teleconsulta.',
                    'Autorize o microfone e o áudio da aba na teleconsulta.',
                    'Inicie e finalize a gravação da consulta.',
                    'Revise o texto antes de qualquer uso clínico.',
                  ].map((step, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#1a6a8d] text-white text-[10px] font-semibold flex items-center justify-center mt-0.5">{index + 1}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}