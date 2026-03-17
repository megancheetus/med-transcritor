'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { compressAudio, formatBytes } from '@/lib/audioUtils';
import { audioStorageManager } from '@/lib/audioStorageManager';
import { HistoryEntry } from '@/lib/history';
import { TranscriptionModelType } from '@/lib/transcriptionModels';
import { CookieConsentBanner } from '@/components/CookieConsentBanner';

// Em Vercel, uploads para API route podem ser rejeitados antes do handler (~4.5 MB).
// Mantemos margem para evitar 413 no edge/proxy.
const NATIVE_QUALITY_MAX_BYTES = 4 * 1024 * 1024;
const HISTORY_STORAGE_KEY_BASE = 'omninote_session_history';

interface ProcessingMeta {
  originalBytes: number;
  sentBytes: number;
  compressed: boolean;
  chunked: boolean;
  chunksProcessed: number;
}

interface TranscriptionWorkspaceContextValue {
  selectedModel: TranscriptionModelType;
  setSelectedModel: (model: TranscriptionModelType) => void;
  transcriptionContent: string;
  setTranscriptionContent: (content: string) => void;
  isLoading: boolean;
  processingError: string;
  compressionStatus: string;
  processingMeta: ProcessingMeta | null;
  lastRecordingTime: string;
  recordingDuration: number;
  history: HistoryEntry[];
  handleRecordingComplete: (audioBlob: Blob, duration: number) => Promise<void>;
  handleFileUpload: (file: File, duration: number) => Promise<void>;
}

const TranscriptionWorkspaceContext = createContext<TranscriptionWorkspaceContextValue | null>(null);

interface TranscriptionWorkspaceProviderProps {
  storageNamespace: string;
  children: React.ReactNode;
}

function sanitizeHistoryEntries(payload: unknown): HistoryEntry[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .map((entry): HistoryEntry | null => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }

      const candidate = entry as {
        id?: unknown;
        timestamp?: unknown;
        model?: unknown;
        duration?: unknown;
        audioId?: unknown;
      };

      if (
        typeof candidate.id !== 'string' ||
        typeof candidate.timestamp !== 'string' ||
        typeof candidate.model !== 'string' ||
        typeof candidate.duration !== 'number'
      ) {
        return null;
      }

      const sanitizedEntry: HistoryEntry = {
        id: candidate.id,
        timestamp: candidate.timestamp,
        model: candidate.model as TranscriptionModelType,
        duration: candidate.duration,
      };

      if (typeof candidate.audioId === 'string') {
        sanitizedEntry.audioId = candidate.audioId;
      }

      return sanitizedEntry;
    })
    .filter((entry): entry is HistoryEntry => entry !== null);
}

export function TranscriptionWorkspaceProvider({ storageNamespace, children }: TranscriptionWorkspaceProviderProps) {
  const router = useRouter();
  const [selectedModel, setSelectedModel] = useState<TranscriptionModelType>('soap');
  const [transcriptionContent, setTranscriptionContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastRecordingTime, setLastRecordingTime] = useState('');
  const [processingError, setProcessingError] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [compressionStatus, setCompressionStatus] = useState('');
  const [processingMeta, setProcessingMeta] = useState<ProcessingMeta | null>(null);
  const historyStorageKey = useMemo(
    () => `${HISTORY_STORAGE_KEY_BASE}:${storageNamespace}`,
    [storageNamespace]
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const raw = window.localStorage.getItem(historyStorageKey);
      if (!raw) {
        setHistory([]);
        return;
      }

      const parsed = JSON.parse(raw) as unknown;
      const sanitized = sanitizeHistoryEntries(parsed);
      setHistory(sanitized);
      window.localStorage.setItem(historyStorageKey, JSON.stringify(sanitized));
    } catch (error) {
      console.warn('Não foi possível carregar histórico local:', error);
    }
  }, [historyStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(historyStorageKey, JSON.stringify(history));
  }, [history, historyStorageKey]);

  useEffect(() => {
    let cancelled = false;

    const loadRemoteHistory = async () => {
      try {
        const rawLocalHistory = window.localStorage.getItem(historyStorageKey);
        const localHistory = rawLocalHistory ? sanitizeHistoryEntries(JSON.parse(rawLocalHistory) as unknown) : [];

        const response = await fetch('/api/history', {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          if (response.status === 401) {
            router.push('/login');
          }
          return;
        }

        const data = await response.json();
        if (!Array.isArray(data?.history)) {
          return;
        }

        const remoteHistory = data.history as HistoryEntry[];

        if (remoteHistory.length === 0 && localHistory.length > 0) {
          const migrationResponse = await fetch('/api/history', {
            method: 'POST',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(localHistory),
          });

          if (!migrationResponse.ok) {
            throw new Error('Não foi possível migrar o histórico local para o servidor');
          }

          const migrationData = await migrationResponse.json();
          if (!cancelled && Array.isArray(migrationData?.history)) {
            setHistory(sanitizeHistoryEntries(migrationData.history));
          }
          return;
        }

        if (!cancelled) {
          setHistory(sanitizeHistoryEntries(remoteHistory));
        }
      } catch (error) {
        console.warn('Não foi possível sincronizar histórico remoto:', error);
      }
    };

    void loadRemoteHistory();

    return () => {
      cancelled = true;
    };
  }, [historyStorageKey, router, storageNamespace]);

  const persistHistoryEntry = useCallback(async (entry: HistoryEntry) => {
    try {
      const response = await fetch('/api/history', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Sessão expirada ou inválida. Faça login novamente.');
        }

        throw new Error('Não foi possível sincronizar o histórico');
      }

      const data = await response.json();
      if (Array.isArray(data?.history)) {
        setHistory(sanitizeHistoryEntries(data.history));
        return;
      }
    } catch (error) {
      console.warn('Falha ao persistir histórico remoto:', error);
    }

    setHistory((prev) => [entry, ...prev.filter((currentEntry) => currentEntry.id !== entry.id)]);
  }, []);

  const handleRecordingComplete = useCallback(async (audioBlob: Blob, duration: number) => {
    setIsLoading(true);
    setTranscriptionContent('');
    setProcessingError('');
    setCompressionStatus('');
    setProcessingMeta(null);
    setRecordingDuration(duration);

    let audioId: string | undefined;

    try {
      let audioToSend = audioBlob;

      if (audioBlob.size > NATIVE_QUALITY_MAX_BYTES) {
        setCompressionStatus('Comprimindo áudio antes do envio...');
        const targetRates = [8000, 4000, 2000];
        const chunkThresholdBytes = NATIVE_QUALITY_MAX_BYTES;

        for (const targetRate of targetRates) {
          const compressed = await compressAudio(audioToSend, targetRate);
          if (compressed.size < audioToSend.size) {
            audioToSend = compressed;
          }
          if (audioToSend.size <= chunkThresholdBytes) {
            break;
          }
        }

        if (audioToSend.size < audioBlob.size) {
          setCompressionStatus(`Compressão aplicada: ${formatBytes(audioBlob.size)} -> ${formatBytes(audioToSend.size)}`);
        } else {
          setCompressionStatus(
            `Não houve redução (${formatBytes(audioBlob.size)}). Enviando original; API usará fallback para arquivos grandes se necessário.`
          );
        }
      }

      setCompressionStatus('Enviando para processamento...');

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

        if (response.status === 413) {
          throw new Error(
            `Arquivo muito grande para envio (${formatBytes(audioToSend.size)}). Tente novamente ou grave um trecho mais curto.`
          );
        }

        throw new Error(errorMsg);
      }

      if (audioId) {
        try {
          await audioStorageManager.updateAudioStatus(audioId, 'completed');
        } catch (error) {
          console.warn('Não foi possível atualizar status:', error);
        }
      }

      setCompressionStatus('Transcrição concluída com sucesso.');
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

      const newEntry: HistoryEntry = {
        id: Date.now().toString(),
        timestamp,
        model: selectedModel,
        duration,
        audioId,
      };
      await persistHistoryEntry(newEntry);
    } catch (error) {
      const errorMsg = (error as Error).message;
      setProcessingError(errorMsg);
      setCompressionStatus(`Erro: ${errorMsg}`);

      if (errorMsg.includes('Sessão expirada') || errorMsg.includes('Não autenticado')) {
        setTimeout(() => {
          router.push('/login');
        }, 1200);
      }

      if (audioId) {
        try {
          await audioStorageManager.updateAudioStatus(audioId, 'failed', errorMsg);
        } catch (updateError) {
          console.warn('Não foi possível atualizar status de erro:', updateError);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [persistHistoryEntry, router, selectedModel]);

  const handleFileUpload = useCallback(async (file: File, duration: number) => {
    setIsLoading(true);
    setTranscriptionContent('');
    setProcessingError('');
    setCompressionStatus('');
    setProcessingMeta(null);
    setRecordingDuration(duration);

    let audioId: string | undefined;

    try {
      let audioToSend: Blob = file;
      if (file.size > NATIVE_QUALITY_MAX_BYTES) {
        setCompressionStatus('Comprimindo arquivo antes do envio...');
        const targetRates = [8000, 4000, 2000];
        const chunkThresholdBytes = NATIVE_QUALITY_MAX_BYTES;

        for (const targetRate of targetRates) {
          const compressed = await compressAudio(audioToSend, targetRate);
          if (compressed.size < audioToSend.size) {
            audioToSend = compressed;
          }
          if (audioToSend.size <= chunkThresholdBytes) {
            break;
          }
        }

        if (audioToSend.size < file.size) {
          setCompressionStatus(`Compressão aplicada: ${formatBytes(file.size)} -> ${formatBytes(audioToSend.size)}`);
        } else {
          setCompressionStatus(
            `Não houve redução (${formatBytes(file.size)}). Enviando original; API usará fallback para arquivos grandes se necessário.`
          );
        }
      }

      setCompressionStatus('Enviando arquivo para processamento...');

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

        if (response.status === 413) {
          throw new Error(
            `Arquivo muito grande para envio (${formatBytes(audioToSend.size)}). Tente novamente ou grave um trecho mais curto.`
          );
        }

        throw new Error(errorMsg);
      }

      if (audioId) {
        try {
          await audioStorageManager.updateAudioStatus(audioId, 'completed');
        } catch (error) {
          console.warn('Não foi possível atualizar status:', error);
        }
      }

      setCompressionStatus(
        data.chunked
          ? `Processado em ${data.chunksProcessed} partes (${formatBytes(audioToSend.size)})`
          : 'Transcrição concluída com sucesso.'
      );

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

      const newEntry: HistoryEntry = {
        id: Date.now().toString(),
        timestamp,
        model: selectedModel,
        duration,
        audioId,
      };
      await persistHistoryEntry(newEntry);
    } catch (error) {
      const errorMsg = (error as Error).message;
      setProcessingError(errorMsg);
      setCompressionStatus(`Erro: ${errorMsg}`);

      if (errorMsg.includes('Sessão expirada') || errorMsg.includes('Não autenticado')) {
        setTimeout(() => {
          router.push('/login');
        }, 1200);
      }

      if (audioId) {
        try {
          await audioStorageManager.updateAudioStatus(audioId, 'failed', errorMsg);
        } catch (updateError) {
          console.warn('Não foi possível atualizar status de erro:', updateError);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [persistHistoryEntry, router, selectedModel]);

  const value = useMemo(
    () => ({
      selectedModel,
      setSelectedModel,
      transcriptionContent,
      setTranscriptionContent,
      isLoading,
      processingError,
      compressionStatus,
      processingMeta,
      lastRecordingTime,
      recordingDuration,
      history,
      handleRecordingComplete,
      handleFileUpload,
    }),
    [
      selectedModel,
      transcriptionContent,
      isLoading,
      processingError,
      compressionStatus,
      processingMeta,
      lastRecordingTime,
      recordingDuration,
      history,
      handleRecordingComplete,
      handleFileUpload,
    ]
  );

  return (
    <>
      <TranscriptionWorkspaceContext.Provider value={value}>{children}</TranscriptionWorkspaceContext.Provider>
      <CookieConsentBanner />
    </>
  );
}

export function useTranscriptionWorkspace() {
  const context = useContext(TranscriptionWorkspaceContext);
  if (!context) {
    throw new Error('useTranscriptionWorkspace deve ser usado dentro de TranscriptionWorkspaceProvider');
  }
  return context;
}
