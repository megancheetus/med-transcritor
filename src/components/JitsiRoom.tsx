'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type JitsiLeaveReason = 'manual-hangup' | 'conference-left' | 'ready-to-close' | 'initialization-error';
type RoomRole = 'professional' | 'patient';

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
  const [statusMessage, setStatusMessage] = useState('Conectando na sala...');
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
        setStatusMessage('Conectando na sala...');
        setLastEvent('Carregando configuração do JaaS');
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
          setStatusMessage('Teleconsulta ativa');
          logEvent('Conferência iniciada', payload);
          void reportJoin();
        });

        api.addEventListener('videoConferenceLeft', (payload) => {
          logEvent('Conferência encerrada pelo Jitsi', payload);
          void safeLeave('conference-left');
        });

        api.addEventListener('readyToClose', (payload) => {
          logEvent('Iframe sinalizou pronto para fechar', payload);
          void safeLeave('ready-to-close');
        });

        api.addEventListener('participantJoined', (payload) => {
          setStatusMessage('Participante conectado');
          logEvent('Participante entrou na sala', payload);
        });

        api.addEventListener('participantLeft', (payload) => {
          setStatusMessage('Um participante saiu da sala');
          logEvent('Participante saiu da sala', payload);
        });

        api.addEventListener('audioMuteStatusChanged', (payload) => {
          logEvent('Status do microfone alterado', payload);
        });

        api.addEventListener('videoMuteStatusChanged', (payload) => {
          logEvent('Status da câmera alterado', payload);
        });

        api.addEventListener('cameraError', (payload) => {
          setStatusMessage('Erro de câmera detectado');
          logEvent('Erro de câmera', payload);
        });

        api.addEventListener('micError', (payload) => {
          setStatusMessage('Erro de microfone detectado');
          logEvent('Erro de microfone', payload);
        });

        api.addEventListener('suspendDetected', (payload) => {
          setStatusMessage('Navegador suspendeu a aba ou conexão');
          logEvent('Suspensão detectada', payload);
        });

        api.addEventListener('browserSupport', (payload) => {
          logEvent('Validação de suporte do navegador', payload);
        });

        api.addEventListener('errorOccurred', (payload) => {
          setStatusMessage('Erro reportado pela API do Jitsi');
          logEvent('Erro interno do Jitsi', payload);
        });

        apiRef.current = api;
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : 'Erro ao iniciar teleconsulta.';
        logEvent('Falha na inicialização do Jitsi', err);
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
      <div className="absolute left-4 top-4 z-20 rounded-md bg-black/60 px-3 py-2 text-sm text-white">
        {statusMessage}
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
