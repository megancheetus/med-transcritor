'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type JitsiLeaveReason = 'manual-hangup' | 'conference-left' | 'ready-to-close' | 'initialization-error';
type RoomRole = 'professional' | 'patient';
type ConnectionVisualState = 'connecting' | 'active' | 'reconnecting' | 'device-warning' | 'error';

interface JitsiRoomProps {
  roomId: string;
  role: RoomRole;
  displayName: string;
  publicAccessToken?: string | null;
  onJoin?: (details: { role: RoomRole }) => Promise<void> | void;
  onLeave?: (details: { durationSeconds: number; reason: JitsiLeaveReason }) => Promise<void> | void;
}

interface JitsiApi {
  addEventListener: (event: string, listener: (payload?: unknown) => void) => void;
  executeCommand: (command: string, ...args: unknown[]) => void;
  dispose: () => void;
}

interface JitsiExternalAPIOptions {
  roomName: string;
  parentNode: HTMLElement;
  jwt?: string;
  userInfo?: {
    displayName?: string;
  };
  configOverwrite?: Record<string, unknown>;
  interfaceConfigOverwrite?: Record<string, unknown>;
}

interface JitsiExternalAPIConstructor {
  new (domain: string, options: JitsiExternalAPIOptions): JitsiApi;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI?: JitsiExternalAPIConstructor;
  }
}

const JITSI_SCRIPT_ID = 'jitsi-external-api-script';

function getStatusClasses(state: ConnectionVisualState): string {
  switch (state) {
    case 'active':
      return 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100';
    case 'reconnecting':
      return 'border-amber-400/30 bg-amber-500/15 text-amber-100';
    case 'device-warning':
      return 'border-orange-400/30 bg-orange-500/15 text-orange-100';
    case 'error':
      return 'border-red-400/30 bg-red-500/15 text-red-100';
    case 'connecting':
    default:
      return 'border-sky-400/30 bg-sky-500/15 text-sky-100';
  }
}

interface JaasMeetingConfig {
  domain: string;
  appId: string;
  roomName: string;
  jwt: string;
  expiresAt: string;
}

const loadJitsiScript = (domain: string, appId: string) => {
  return new Promise<void>((resolve, reject) => {
    if (window.JitsiMeetExternalAPI) {
      resolve();
      return;
    }

    const existingScript = document.getElementById(JITSI_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener(
        'error',
        () => reject(new Error('Falha ao carregar a API do Jitsi.')),
        { once: true }
      );
      return;
    }

    const script = document.createElement('script');
    script.id = JITSI_SCRIPT_ID;
    script.src = `https://${domain}/${appId}/external_api.js`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Falha ao carregar a API do Jitsi.'));
    document.body.appendChild(script);
  });
};

export default function JitsiRoom({
  roomId,
  role,
  displayName,
  publicAccessToken,
  onJoin,
  onLeave,
}: JitsiRoomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiApi | null>(null);
  const hasLeftRef = useRef(false);
  const joinedAtRef = useRef<number | null>(null);
  const joinReportedRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusState, setStatusState] = useState<ConnectionVisualState>('connecting');
  const [statusMessage, setStatusMessage] = useState('Conectando na sala...');
  const [statusDetail, setStatusDetail] = useState('Validando acesso e carregando conferência.');
  const [participantCount, setParticipantCount] = useState(1);
  const [lastEvent, setLastEvent] = useState<string>('Aguardando inicialização do Jitsi');

  const logEvent = useCallback((message: string, payload?: unknown) => {
    console.log(`[JitsiRoom:${roomId}] ${message}`, payload);
    setLastEvent(message);
  }, [roomId]);

  const loadMeetingConfig = useCallback(async (): Promise<JaasMeetingConfig> => {
    const query = new URLSearchParams({ role });
    if (publicAccessToken) {
      query.set('token', publicAccessToken);
    }

    const response = await fetch(`/api/videoconsultations/${roomId}/jaas?${query.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Erro ao carregar configuração do JaaS.');
    }

    return data as JaasMeetingConfig;
  }, [publicAccessToken, role, roomId]);

  const reportJoin = useCallback(async () => {
    if (joinReportedRef.current) {
      return;
    }

    joinReportedRef.current = true;
    await onJoin?.({ role });
  }, [onJoin, role]);

  const safeLeave = useCallback(async (reason: JitsiLeaveReason) => {
    if (hasLeftRef.current) return;
    hasLeftRef.current = true;

    const durationSeconds = joinedAtRef.current
      ? Math.max(0, Math.round((Date.now() - joinedAtRef.current) / 1000))
      : 0;

    logEvent(`Saindo da sala. Motivo: ${reason}`);
    await onLeave?.({ durationSeconds, reason });
  }, [logEvent, onLeave]);

  useEffect(() => {
    let active = true;

    const initJitsi = async () => {
      try {
        setLoading(true);
        setError(null);
        setStatusState('connecting');
        setStatusMessage('Conectando na sala...');
        setStatusDetail('Validando acesso e carregando conferência.');
        setLastEvent('Carregando configuração do JaaS');
        setParticipantCount(1);
        hasLeftRef.current = false;
        joinedAtRef.current = null;
        joinReportedRef.current = false;

        const meetingConfig = await loadMeetingConfig();
        logEvent('Configuração do JaaS carregada', {
          domain: meetingConfig.domain,
          appId: meetingConfig.appId,
          roomName: meetingConfig.roomName,
          expiresAt: meetingConfig.expiresAt,
        });

        setLastEvent('Carregando script externo do JaaS');
        await loadJitsiScript(meetingConfig.domain, meetingConfig.appId);
        logEvent('Script externo do JaaS carregado');

        if (!active || !containerRef.current || !window.JitsiMeetExternalAPI) {
          return;
        }

        const api = new window.JitsiMeetExternalAPI(meetingConfig.domain, {
          roomName: meetingConfig.roomName,
          parentNode: containerRef.current,
          jwt: meetingConfig.jwt,
          userInfo: {
            displayName,
          },
          configOverwrite: {
            prejoinPageEnabled: false,
            disableDeepLinking: true,
            startWithAudioMuted: false,
            startWithVideoMuted: false,
          },
          interfaceConfigOverwrite: {
            MOBILE_APP_PROMO: false,
          },
        });

        api.addEventListener('videoConferenceJoined', (payload) => {
          if (!active) return;
          joinedAtRef.current = Date.now();
          setLoading(false);
          setStatusState('active');
          setStatusMessage('Teleconsulta ativa');
          setStatusDetail('Conexão estabelecida. Você já pode iniciar o atendimento.');
          logEvent('Conferência iniciada', payload);
          void reportJoin();
        });

        api.addEventListener('videoConferenceLeft', (payload) => {
          setStatusState('error');
          setStatusMessage('Consulta encerrada');
          setStatusDetail('A sala foi encerrada pelo Jitsi.');
          logEvent('Conferência encerrada pelo Jitsi', payload);
          void safeLeave('conference-left');
        });

        api.addEventListener('readyToClose', (payload) => {
          setStatusState('error');
          setStatusMessage('Finalizando teleconsulta');
          setStatusDetail('A interface solicitou o fechamento da sala.');
          logEvent('Iframe sinalizou pronto para fechar', payload);
          void safeLeave('ready-to-close');
        });

        api.addEventListener('participantJoined', (payload) => {
          setStatusState('active');
          setStatusMessage('Participante conectado');
          setStatusDetail('Todos na sala estão online.');
          setParticipantCount((prev) => prev + 1);
          logEvent('Participante entrou na sala', payload);
        });

        api.addEventListener('participantLeft', (payload) => {
          setStatusState('reconnecting');
          setStatusMessage('Participante desconectado');
          setStatusDetail('Aguardando retorno do participante ou nova conexão.');
          setParticipantCount((prev) => Math.max(1, prev - 1));
          logEvent('Participante saiu da sala', payload);
        });

        api.addEventListener('audioMuteStatusChanged', (payload) => {
          logEvent('Status do microfone alterado', payload);
        });

        api.addEventListener('videoMuteStatusChanged', (payload) => {
          logEvent('Status da câmera alterado', payload);
        });

        api.addEventListener('cameraError', (payload) => {
          setStatusState('device-warning');
          setStatusMessage('Erro de câmera detectado');
          setStatusDetail('Confira permissões de câmera e dispositivo selecionado.');
          logEvent('Erro de câmera', payload);
        });

        api.addEventListener('micError', (payload) => {
          setStatusState('device-warning');
          setStatusMessage('Erro de microfone detectado');
          setStatusDetail('Confira permissões de microfone e dispositivo selecionado.');
          logEvent('Erro de microfone', payload);
        });

        api.addEventListener('suspendDetected', (payload) => {
          setStatusState('reconnecting');
          setStatusMessage('Navegador suspendeu a aba ou conexão');
          setStatusDetail('Tente manter esta aba ativa para evitar quedas na chamada.');
          logEvent('Suspensão detectada', payload);
        });

        api.addEventListener('browserSupport', (payload) => {
          logEvent('Validação de suporte do navegador', payload);
        });

        api.addEventListener('errorOccurred', (payload) => {
          setStatusState('error');
          setStatusMessage('Erro reportado pela API do Jitsi');
          setStatusDetail('Tentando manter a chamada. Verifique sua conexão de internet.');
          logEvent('Erro interno do Jitsi', payload);
        });

        apiRef.current = api;
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : 'Erro ao iniciar teleconsulta.';
        logEvent('Falha na inicialização do Jitsi', err);
        setStatusState('error');
        setError(message);
        setLoading(false);
      }
    };

    void initJitsi();

    return () => {
      active = false;
      apiRef.current?.dispose();
      apiRef.current = null;
    };
  }, [displayName, loadMeetingConfig, logEvent, reportJoin, safeLeave]);

  const handleHangup = async () => {
    if (apiRef.current) {
      logEvent('Encerramento manual solicitado pelo usuário');
      apiRef.current.executeCommand('hangup');
    } else {
      await safeLeave('manual-hangup');
    }
  };

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0c161c] p-4">
        <div className="max-w-md rounded-lg border border-red-300 bg-red-50 p-6 text-center">
          <h2 className="text-xl font-bold text-red-700">Erro na teleconsulta</h2>
          <p className="mt-2 text-red-600">{error}</p>
          <button
            onClick={() => {
              void safeLeave('initialization-error');
            }}
            className="mt-4 rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full bg-[#0c161c]">
      <div
        className={`absolute left-4 top-4 z-20 max-w-lg rounded-lg border px-3 py-2 text-sm backdrop-blur ${getStatusClasses(
          statusState
        )}`}
      >
        <p className="font-semibold">{statusMessage}</p>
        <p className="mt-0.5 text-xs opacity-90">{statusDetail}</p>
        <p className="mt-1 text-[11px] opacity-80">
          Participantes na sala: {participantCount} {loading ? '• conectando...' : ''}
        </p>
      </div>

      <div className="absolute bottom-4 left-4 z-20 max-w-md rounded-md bg-black/60 px-3 py-2 text-xs text-white">
        Último evento: {lastEvent}
      </div>

      <button
        onClick={() => {
          void handleHangup();
        }}
        className="absolute right-4 top-4 z-20 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
      >
        Encerrar consulta
      </button>

      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
