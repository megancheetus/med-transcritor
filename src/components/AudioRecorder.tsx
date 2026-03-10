'use client';

import { useEffect, useRef, useState } from 'react';

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
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

  useEffect(() => {
    return () => {
      void cleanupRecordingResources();
    };
  }, []);

  useEffect(() => {
    if (!isRecording) {
      setSourceIndicators(createSourceIndicators(captureMode));
    }
  }, [captureMode, isRecording]);

  const clearTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const cleanupRecordingResources = async () => {
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
  };

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

  const getMicrophoneStream = async () =>
    navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

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
      return 'O microfone local não foi liberado. A teleconsulta será gravada apenas com o áudio compartilhado da chamada.';
    }

    if (error instanceof DOMException && error.name === 'NotFoundError') {
      return 'Nenhum microfone local foi encontrado. A teleconsulta será gravada apenas com o áudio compartilhado da chamada.';
    }

    if (error instanceof DOMException && error.name === 'NotReadableError') {
      return 'O microfone local está em uso por outro aplicativo. A teleconsulta será gravada apenas com o áudio compartilhado da chamada.';
    }

    return 'Não foi possível acessar o microfone local. A teleconsulta será gravada apenas com o áudio compartilhado da chamada.';
  };

  const getInputStreams = async () => {
    if (captureMode === 'inPerson') {
      const microphoneStream = await getMicrophoneStream();
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
      const microphoneStream = await getMicrophoneStream();
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

  const startRecording = async () => {
    try {
      setErrorMessage('');
      setWarningMessage('');
      setSourceIndicators(createStartingIndicators(captureMode));
      const { streams: inputStreams, warning, indicators } = await getInputStreams();
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
        inputStreams.forEach((stream) => {
          stream.getTracks().forEach((track) => track.stop());
        });
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

      setSourceIndicators(indicators);

      if (warning) {
        setWarningMessage(warning);
      }

      mediaRecorder.start(1000);
      setIsRecording(true);
      setDuration(0);
      timerIntervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      if (isExpectedRecordingError(error)) {
        console.warn('Falha esperada ao iniciar a gravação:', error);
      } else {
        console.error('Erro ao iniciar a gravação:', error);
      }

      await cleanupRecordingResources();
      setIsRecording(false);
      setWarningMessage('');
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
    setSourceIndicators(createSourceIndicators(captureMode));

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
    onRecordingComplete(audioBlob);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const modeTitle = captureMode === 'inPerson' ? 'consulta presencial' : 'teleconsulta';
  const completedModeTitle =
    lastCompletedMode === 'inPerson' ? 'consulta presencial' : 'teleconsulta';
  const recordingLabel = captureMode === 'inPerson' ? 'Gravando consulta presencial...' : 'Gravando teleconsulta...';

  return (
    <div className="w-full bg-white rounded-xl border border-[#dde2e8] p-6 sm:p-8">
      <p className="text-xs font-semibold text-[#607080] mb-5 tracking-widest uppercase">
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
                disabled={isRecording || isLoading}
                className={`rounded-lg border p-4 text-left transition ${
                  isSelected
                    ? 'border-[#1a2e45] bg-[#f4f6f9]'
                    : 'border-[#dde2e8] bg-white hover:border-[#4a7fa5]'
                } disabled:cursor-not-allowed disabled:opacity-70`}
              >
                <p className="text-sm font-medium text-[#1a2e45]">{option.title}</p>
                <p className="mt-2 text-sm text-[#607080]">{option.description}</p>
              </button>
            );
          })}
        </div>

        {captureMode === 'teleconsult' && (
          <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Para teleconsulta, o navegador abrirá a janela de compartilhamento. Para melhor resultado,
            mantenha o Google Meet e o MedTranscritor no mesmo navegador e escolha a aba da chamada com a
            opção de compartilhar áudio ativada. Compartilhar a tela inteira pode funcionar em alguns
            cenários. Já uma janela isolada, outro navegador ou aplicativo externo frequentemente não expõe
            o áudio ao navegador.
          </div>
        )}

        <div className="w-full rounded-lg border border-[#dde2e8] bg-[#f4f6f9] p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-sm font-medium text-[#1a2e45]">Fontes detectadas</p>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                isRecording ? 'bg-red-100 text-red-700' : 'bg-white text-[#1a2e45] border border-[#dde2e8]'
              }`}
            >
              {isRecording ? 'Capturando agora' : 'Pronto para iniciar'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {Object.values(sourceIndicators).map((indicator) => (
              <div key={indicator.label} className="rounded-lg border border-[#dde2e8] bg-white p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-sm font-medium text-[#1a2e45]">{indicator.label}</p>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${SOURCE_STATUS_CLASSES[indicator.status]}`}
                  >
                    {SOURCE_STATUS_LABELS[indicator.status]}
                  </span>
                </div>
                <p className="text-sm text-[#607080]">{indicator.detail}</p>
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

        {isRecording && (
          <div className="w-full text-center bg-red-50 rounded-xl border border-red-200 p-6">
            <div className="flex justify-center mb-3">
              <div className="inline-block animate-pulse">
                <div className="w-5 h-5 bg-red-500 rounded-full"></div>
              </div>
            </div>
            <p className="text-lg font-semibold text-[#1a2e45] mb-2">{recordingLabel}</p>
            <p className="text-4xl font-mono font-semibold text-[#1a2e45]">{formatDuration(duration)}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {!isRecording ? (
            <button
              onClick={startRecording}
              disabled={isLoading}
              className="flex-1 sm:flex-none px-6 py-3 bg-[#1a2e45] hover:bg-[#234060] text-white font-medium tracking-wide rounded-md disabled:bg-gray-400 transition-all disabled:cursor-not-allowed"
            >
              {captureMode === 'inPerson' ? 'Iniciar Consulta Presencial' : 'Iniciar Teleconsulta'}
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex-1 sm:flex-none px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium tracking-wide rounded-md transition-all"
            >
              Parar Gravação
            </button>
          )}
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
