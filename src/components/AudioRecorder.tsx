'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob, duration: number) => void;
  isLoading?: boolean;
}

class RecordingSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecordingSetupError';
  }
}

type CaptureMode = 'inPerson' | 'teleconsult';

type SourceIndicatorStatus = 'idle' | 'active' | 'warning' | 'inactive';

interface SourceIndicator {
  label: string;
  detail: string;
  status: SourceIndicatorStatus;
}

interface SourceIndicators {
  display: SourceIndicator;
  microphone: SourceIndicator;
}

interface RecordingResources {
  audioContext: AudioContext;
  inputStreams: MediaStream[];
  sourceNodes: MediaStreamAudioSourceNode[];
  mixNode: GainNode;
  destinationNode: MediaStreamAudioDestinationNode;
  mediaRecorder: MediaRecorder;
}

const CAPTURE_MODE_OPTIONS: Array<{
  value: CaptureMode;
  title: string;
  description: string;
}> = [
  {
    value: 'inPerson',
    title: 'Consulta presencial',
    description: 'Captura apenas o microfone do navegador para gravar a conversa no consultório.',
  },
  {
    value: 'teleconsult',
    title: 'Teleconsulta',
    description: 'Combina o seu microfone com o áudio da aba ou janela compartilhada da chamada.',
  },
];

const SOURCE_STATUS_LABELS: Record<SourceIndicatorStatus, string> = {
  idle: 'Aguardando',
  active: 'Conectado',
  warning: 'Parcial',
  inactive: 'Não usado',
};

const SOURCE_STATUS_CLASSES: Record<SourceIndicatorStatus, string> = {
  idle: 'border-slate-200 bg-slate-50 text-slate-700',
  active: 'border-green-200 bg-green-50 text-green-700',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  inactive: 'border-gray-200 bg-gray-50 text-gray-500',
};

const createSourceIndicators = (mode: CaptureMode): SourceIndicators => ({
  display:
    mode === 'teleconsult'
      ? {
          label: 'Áudio da teleconsulta',
          detail: 'Aguardando a seleção da aba ou janela da chamada.',
          status: 'idle',
        }
      : {
          label: 'Áudio da teleconsulta',
          detail: 'Não utilizado neste modo de captura.',
          status: 'inactive',
        },
  microphone: {
    label: 'Microfone local',
    detail:
      mode === 'teleconsult'
        ? 'Será solicitado após a seleção da aba compartilhada.'
        : 'Será usado para capturar a conversa presencial.',
    status: 'idle',
  },
});

const createStartingIndicators = (mode: CaptureMode): SourceIndicators => ({
  display:
    mode === 'teleconsult'
      ? {
          label: 'Áudio da teleconsulta',
          detail: 'Abrindo a janela para selecionar a aba ou janela da chamada.',
          status: 'idle',
        }
      : {
          label: 'Áudio da teleconsulta',
          detail: 'Não utilizado neste modo de captura.',
          status: 'inactive',
        },
  microphone: {
    label: 'Microfone local',
    detail:
      mode === 'teleconsult'
        ? 'Aguardando a etapa do microfone local.'
        : 'Solicitando acesso ao microfone local.',
    status: 'idle',
  },
});

export default function AudioRecorder({ onRecordingComplete, isLoading = false }: AudioRecorderProps) {
  const [captureMode, setCaptureMode] = useState<CaptureMode>('inPerson');
  const [isRecording, setIsRecording] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isPrepared, setIsPrepared] = useState(false);
  const [duration, setDuration] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [warningMessage, setWarningMessage] = useState('');
  const [lastCompletedMode, setLastCompletedMode] = useState<CaptureMode>('inPerson');
  const [sourceIndicators, setSourceIndicators] = useState<SourceIndicators>(() =>
    createSourceIndicators('inPerson')
  );
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingResourcesRef = useRef<RecordingResources | null>(null);
  const preparedInputStreamsRef = useRef<MediaStream[] | null>(null);

  const clearTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const cleanupRecordingResources = useCallback(async () => {
    clearTimer();

    const resources = recordingResourcesRef.current;

    if (!resources) {
      return;
    }

    resources.mediaRecorder.ondataavailable = null;
    resources.mediaRecorder.onstop = null;
    resources.mediaRecorder.onerror = null;

    if (resources.mediaRecorder.state !== 'inactive') {
      try {
        resources.mediaRecorder.stop();
      } catch {
        // Ignore cleanup stop errors.
      }
    }

    resources.sourceNodes.forEach((sourceNode) => sourceNode.disconnect());
    resources.mixNode.disconnect();
    resources.destinationNode.disconnect();
    resources.inputStreams.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });

    if (resources.audioContext.state !== 'closed') {
      await resources.audioContext.close();
    }

    recordingResourcesRef.current = null;
  }, [clearTimer]);

  const cleanupPreparedStreams = useCallback(async () => {
    const preparedStreams = preparedInputStreamsRef.current;

    if (!preparedStreams) {
      return;
    }

    preparedStreams.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });

    preparedInputStreamsRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      void cleanupRecordingResources();
      void cleanupPreparedStreams();
    };
  }, [cleanupPreparedStreams, cleanupRecordingResources]);

  useEffect(() => {
    if (!isRecording && !isPrepared) {
      setSourceIndicators(createSourceIndicators(captureMode));
    }
  }, [captureMode, isRecording, isPrepared]);

  const getPreferredRecordingMimeType = () => {
    const preferredMimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];

    return preferredMimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
  };

  const getErrorMessage = (error: unknown) => {
    if (error instanceof RecordingSetupError) {
      return error.message;
    }

    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      return captureMode === 'teleconsult'
        ? 'Autorize o compartilhamento da aba com áudio para iniciar a teleconsulta.'
        : 'Autorize o acesso ao microfone para iniciar a gravação da consulta presencial.';
    }

    if (error instanceof DOMException && error.name === 'NotFoundError') {
      return captureMode === 'teleconsult'
        ? 'Nenhuma fonte de áudio compartilhável foi encontrada para a teleconsulta.'
        : 'Nenhum microfone disponível foi encontrado para iniciar a gravação.';
    }

    if (error instanceof DOMException && error.name === 'NotReadableError') {
      return 'O dispositivo de áudio está ocupado por outro aplicativo ou não pôde ser lido. Feche capturas concorrentes e tente novamente.';
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'Não foi possível iniciar a gravação. Verifique as permissões do navegador e tente novamente.';
  };

  const getMicrophoneStream = async (isTeleconsult: boolean = false) => {
    // For teleconsult mode, use less restrictive audio constraints
    // to work better with shared tab audio
    const audioConstraints = isTeleconsult
      ? {
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        }
      : {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        };

    return navigator.mediaDevices.getUserMedia(audioConstraints);
  };

  const getDisplayStream = async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      if (displayStream.getAudioTracks().length === 0) {
        displayStream.getTracks().forEach((track) => track.stop());
        throw new RecordingSetupError(
          'A aba ou janela compartilhada não enviou áudio. No Google Meet, escolha a aba da chamada e ative a opção de compartilhar áudio antes de confirmar.'
        );
      }

      return displayStream;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        throw new RecordingSetupError('O compartilhamento da teleconsulta foi cancelado ou bloqueado antes da seleção da aba.');
      }

      if (error instanceof DOMException && error.name === 'NotFoundError') {
        throw new RecordingSetupError(
          'O navegador não encontrou uma aba ou janela com áudio compartilhável para a teleconsulta. No Edge, mantenha o Google Meet em uma aba do mesmo navegador.'
        );
      }

      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new RecordingSetupError('A seleção da fonte de compartilhamento foi interrompida antes de concluir.');
      }

      throw error;
    }
  };

  const getTeleconsultMicrophoneWarning = (error: unknown) => {
    if (error instanceof DOMException && error.name === 'NotAllowedError') {
      return 'O microfone local não foi liberado. Verifique as permissões do navegador para o microfone e tente novamente. Dica: Certifique-se de que nenhum outro aplicativo está usando o microfone do Google Meet.';
    }

    if (error instanceof DOMException && error.name === 'NotFoundError') {
      return 'Nenhum microfone local foi encontrado. Verifique se seu dispositivo de áudio está conectado e funcionando.';
    }

    if (error instanceof DOMException && error.name === 'NotReadableError') {
      return 'O microfone local está em uso por outro aplicativo. Feche outras aplicações que usam áudio (como o próprio Google Meet aberto em outra aba) e tente novamente. A teleconsulta será gravada apenas com o áudio compartilhado.';
    }

    return 'Não foi possível acessar o microfone local. Tente novamente ou recarregue a página. A teleconsulta será gravada apenas com o áudio compartilhado da chamada.';
  };

  const getInputStreams = async () => {
    if (captureMode === 'inPerson') {
      const microphoneStream = await getMicrophoneStream(false);
      return {
        streams: [microphoneStream],
        indicators: {
          display: createSourceIndicators('inPerson').display,
          microphone: {
            label: 'Microfone local',
            detail: 'Microfone local conectado e pronto para gravação.',
            status: 'active' as const,
          },
        },
      };
    }

    const displayStream = await getDisplayStream();
    let warning: string | undefined;
    const streams: MediaStream[] = [displayStream];

    try {
      // Add a small delay to allow the browser to release the microphone
      // from the display share process before trying to access it again
      await new Promise((resolve) => setTimeout(resolve, 100));
      const microphoneStream = await getMicrophoneStream(true);
      streams.push(microphoneStream);
    } catch (error) {
      warning = getTeleconsultMicrophoneWarning(error);
    }

    return {
      streams,
      warning,
      indicators: {
        display: {
          label: 'Áudio da teleconsulta',
          detail: 'Áudio da aba ou janela compartilhada conectado.',
          status: 'active' as const,
        },
        microphone: warning
          ? {
              label: 'Microfone local',
              detail: 'Microfone local indisponível. A gravação seguirá apenas com o áudio da chamada.',
              status: 'warning' as const,
            }
          : {
              label: 'Microfone local',
              detail: 'Microfone local conectado e combinado ao áudio da chamada.',
              status: 'active' as const,
            },
      },
    };
  };

  const isExpectedRecordingError = (error: unknown) =>
    error instanceof RecordingSetupError ||
    (error instanceof DOMException &&
      ['NotAllowedError', 'NotFoundError', 'NotReadableError', 'AbortError', 'InvalidStateError'].includes(
        error.name
      ));

  const prepareRecording = async () => {
    try {
      setErrorMessage('');
      setWarningMessage('');
      setIsPreparing(true);
      setSourceIndicators(createStartingIndicators(captureMode));
      const { streams: inputStreams, warning, indicators } = await getInputStreams();

      preparedInputStreamsRef.current = inputStreams;
      setSourceIndicators(indicators);

      if (warning) {
        setWarningMessage(warning);
      }

      setIsPreparing(false);
      setIsPrepared(true);
    } catch (error) {
      if (isExpectedRecordingError(error)) {
        console.warn('Falha esperada ao preparar a gravação:', error);
      } else {
        console.error('Erro ao preparar a gravação:', error);
      }

      await cleanupPreparedStreams();
      setIsPreparing(false);
      setIsPrepared(false);
      setWarningMessage('');
      setSourceIndicators(createSourceIndicators(captureMode));
      setErrorMessage(getErrorMessage(error));
    }
  };

  const cancelPrepare = async () => {
    await cleanupPreparedStreams();
    setIsPrepared(false);
    setWarningMessage('');
    setErrorMessage('');
    setSourceIndicators(createSourceIndicators(captureMode));
  };

  const startRecording = async () => {
    try {
      const inputStreams = preparedInputStreamsRef.current;

      if (!inputStreams) {
        throw new Error('As fontes de áudio não foram preparadas corretamente. Clique em "Preparar" novamente.');
      }

      setErrorMessage('');
      const audioContext = new AudioContext();
      const mixNode = audioContext.createGain();
      const destinationNode = audioContext.createMediaStreamDestination();
      const mimeType = getPreferredRecordingMimeType();
      const mediaRecorder = mimeType
        ? new MediaRecorder(destinationNode.stream, { mimeType })
        : new MediaRecorder(destinationNode.stream);

      await audioContext.resume();
      audioChunksRef.current = [];

      const sourceNodes = inputStreams
        .filter((stream) => stream.getAudioTracks().length > 0)
        .map((stream) => audioContext.createMediaStreamSource(new MediaStream(stream.getAudioTracks())));

      if (sourceNodes.length === 0) {
        await audioContext.close();
        throw new Error('Nenhuma fonte de áudio válida foi encontrada para a gravação.');
      }

      sourceNodes.forEach((sourceNode) => sourceNode.connect(mixNode));
      mixNode.connect(destinationNode);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recordingResourcesRef.current = {
        audioContext,
        inputStreams,
        sourceNodes,
        mixNode,
        destinationNode,
        mediaRecorder,
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setDuration(0);
      timerIntervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      if (error instanceof Error) {
        console.error('Erro ao iniciar a gravação:', error);
      }

      await cleanupRecordingResources();
      await cleanupPreparedStreams();
      setIsPrepared(false);
      setIsRecording(false);
      setSourceIndicators(createSourceIndicators(captureMode));
      setErrorMessage(getErrorMessage(error));
    }
  };

  const stopRecording = async () => {
    if (!isRecording) {
      return;
    }

    setIsRecording(false);
    clearTimer();

    const resources = recordingResourcesRef.current;

    if (!resources) {
      setSourceIndicators(createSourceIndicators(captureMode));
      setErrorMessage('A gravação não pôde ser finalizada corretamente. Tente novamente.');
      return;
    }

    if (resources.mediaRecorder.state !== 'inactive') {
      await new Promise<void>((resolve, reject) => {
        resources.mediaRecorder.onstop = () => resolve();
        resources.mediaRecorder.onerror = () => reject(new Error('Não foi possível finalizar a gravação de áudio.'));
        resources.mediaRecorder.stop();
      });
    }

    const recordedChunks = audioChunksRef.current;
    const audioMimeType =
      resources.mediaRecorder.mimeType || recordedChunks[0]?.type || getPreferredRecordingMimeType() || 'audio/webm';
    await cleanupRecordingResources();
    await cleanupPreparedStreams();
    setSourceIndicators(createSourceIndicators(captureMode));
    setIsPrepared(false);

    if (recordedChunks.length === 0) {
      setWarningMessage('');
      setErrorMessage('Nenhum áudio foi captado. Verifique as permissões e tente novamente.');
      return;
    }

    const audioBlob = new Blob(recordedChunks, { type: audioMimeType });

    if (audioBlob.size === 0) {
      setWarningMessage('');
      setErrorMessage('A gravação foi concluída, mas o arquivo de áudio ficou vazio. Tente novamente.');
      return;
    }

    setLastCompletedMode(captureMode);
    onRecordingComplete(audioBlob, duration);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const completedModeTitle =
    lastCompletedMode === 'inPerson' ? 'consulta presencial' : 'teleconsulta';
  const recordingLabel = captureMode === 'inPerson' ? 'Gravando consulta presencial...' : 'Gravando teleconsulta...';

  return (
    <div className="w-full bg-white rounded-xl border border-[#cfe0e8] p-6 sm:p-8">
      <p className="text-xs font-semibold text-[#4b6573] mb-5 tracking-widest uppercase">
        Gravação
      </p>

      <div className="flex flex-col items-center gap-6">
        <div className="w-full grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CAPTURE_MODE_OPTIONS.map((option) => {
            const isSelected = captureMode === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setCaptureMode(option.value)}
                disabled={isRecording || isLoading || isPrepared || isPreparing}
                className={`rounded-xl border-2 p-5 text-left transition transform hover:scale-105 ${
                  isSelected
                    ? 'border-[#1ea58c] bg-gradient-to-br from-[#effaf7] to-[#e5f4f8] shadow-md'
                    : 'border-[#cfe0e8] bg-white hover:border-[#155b79] hover:shadow-sm'
                } disabled:cursor-not-allowed disabled:opacity-70`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition flex-shrink-0 ${
                    isSelected
                      ? 'border-[#1ea58c] bg-[#1ea58c]'
                      : 'border-[#cfe0e8]'
                  }`}>
                    {isSelected && (
                      <span className="text-white text-xs font-bold">✓</span>
                    )}
                  </div>
                  <p className="font-bold text-[#155b79] text-base">{option.title}</p>
                </div>
              </button>
            );
          })}
        </div>

        {captureMode === 'teleconsult' && (
          <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Para teleconsulta, o navegador abrirá a janela de compartilhamento. Para melhor resultado,
            mantenha o Google Meet e o OmniNote no mesmo navegador e escolha a aba da chamada com a
            opção de compartilhar áudio ativada. Compartilhar a tela inteira pode funcionar em alguns
            cenários. Já uma janela isolada, outro navegador ou aplicativo externo frequentemente não expõe
            o áudio ao navegador.
          </div>
        )}

        <div className="w-full rounded-lg border border-[#cfe0e8] bg-[#edf4f6] p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-sm font-medium text-[#0c161c]">Fontes detectadas</p>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                isRecording
                  ? 'bg-red-100 text-red-700'
                  : isPrepared
                    ? 'bg-green-100 text-green-700'
                    : 'bg-white text-[#0c161c] border border-[#cfe0e8]'
              }`}
            >
              {isRecording ? 'Capturando agora' : isPrepared ? 'Pronto para iniciar consulta' : 'Pronto para testar o ambiente'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(Object.values(sourceIndicators) as SourceIndicator[]).map((indicator) => (
              <div key={indicator.label} className="rounded-lg border border-[#cfe0e8] bg-white p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-sm font-medium text-[#0c161c]">{indicator.label}</p>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${SOURCE_STATUS_CLASSES[indicator.status]}`}
                  >
                    {SOURCE_STATUS_LABELS[indicator.status]}
                  </span>
                </div>
                <p className="text-sm text-[#4b6573]">{indicator.detail}</p>
              </div>
            ))}
          </div>
        </div>

        {warningMessage && (
          <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {warningMessage}
          </div>
        )}

        {errorMessage && (
          <div className="w-full rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {isPrepared && !isRecording && (
          <div className="w-full bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
            <p className="text-sm text-blue-700 font-medium">
              ✓ Todos os dispositivos de áudio foram verificados e estão funcionando. Você já pode iniciar a gravação!
            </p>
          </div>
        )}

        {isRecording && (
          <div className="w-full text-center bg-red-50 rounded-xl border border-red-200 p-6">
            <div className="flex justify-center mb-3">
              <div className="inline-block animate-pulse">
                <div className="w-5 h-5 bg-red-500 rounded-full"></div>
              </div>
            </div>
            <p className="text-lg font-semibold text-[#0c161c] mb-2">{recordingLabel}</p>
            <p className="text-4xl font-mono font-semibold text-[#0c161c]">{formatDuration(duration)}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {!isRecording && !isPrepared ? (
            <button
              onClick={prepareRecording}
              disabled={isLoading || isPreparing}
              className="flex-1 sm:flex-none px-6 py-3 bg-[#1a6a8d] hover:bg-[#155b79] text-white font-medium tracking-wide rounded-md disabled:bg-gray-400 transition-all disabled:cursor-not-allowed"
            >
              {isPreparing ? 'Verificando dispositivos...' : 'Preparar'}
            </button>
          ) : isPrepared && !isRecording ? (
            <>
              <button
                onClick={startRecording}
                disabled={isLoading}
                className="flex-1 sm:flex-none px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium tracking-wide rounded-md disabled:bg-gray-400 transition-all disabled:cursor-not-allowed"
              >
                {captureMode === 'inPerson' ? 'Iniciar Consulta Presencial' : 'Iniciar Teleconsulta'}
              </button>
              <button
                onClick={cancelPrepare}
                className="flex-1 sm:flex-none px-6 py-3 bg-gray-400 hover:bg-gray-500 text-white font-medium tracking-wide rounded-md transition-all"
              >
                Cancelar
              </button>
            </>
          ) : isRecording ? (
            <button
              onClick={stopRecording}
              className="flex-1 sm:flex-none px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium tracking-wide rounded-md transition-all"
            >
              Parar Gravação
            </button>
          ) : null}
        </div>

        {!isRecording && duration > 0 && (
          <div className="w-full bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <p className="text-sm text-green-700 font-medium">
              Gravação de {formatDuration(duration)} em {completedModeTitle} concluída com sucesso
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
