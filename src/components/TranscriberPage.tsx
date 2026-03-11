'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import AudioRecorder from '@/components/AudioRecorder';
import TranscriptionResult from '@/components/TranscriptionResult';
import { TranscriptionModelType, getAllModels, getModelById } from '@/lib/transcriptionModels';

interface HistoryEntry {
  id: string;
  timestamp: string;
  model: TranscriptionModelType;
  content: string;
  duration: number; // em segundos
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

  const handleRecordingComplete = async (audioBlob: Blob, duration: number) => {
    setIsLoading(true);
    setTranscriptionContent('');
    setProcessingError('');
    setRecordingDuration(duration);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      formData.append('model', selectedModel);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.details || data?.error || `API error: ${response.statusText}`);
      }

      setTranscriptionContent(data.content);
      const timestamp = new Date().toLocaleString('pt-BR');
      setLastRecordingTime(timestamp);

      // Add to history
      const newEntry: HistoryEntry = {
        id: Date.now().toString(),
        timestamp,
        model: selectedModel,
        content: data.content,
        duration,
      };
      setHistory((prev) => [newEntry, ...prev]);
    } catch (error) {
      console.error('Error:', error);
      setProcessingError((error as Error).message);
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