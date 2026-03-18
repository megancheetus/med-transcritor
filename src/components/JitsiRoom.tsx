'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type JitsiLeaveReason = 'manual-hangup' | 'conference-left' | 'ready-to-close' | 'initialization-error';
type RoomRole = 'professional' | 'patient';
type ConnectionVisualState = 'connecting' | 'active' | 'reconnecting' | 'device-warning' | 'error';
type PrecheckState = 'idle' | 'running' | 'passed' | 'failed';
type ConnectionQuality = 'good' | 'fair' | 'poor' | 'unknown';

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_SECONDS = 5;

interface JitsiRoomProps {
  roomId: string;
  role: RoomRole;
  displayName: string;
  patientId?: string;
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

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function getQualityLabel(q: ConnectionQuality) {
  switch (q) {
    case 'good': return { text: 'Boa', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
    case 'fair': return { text: 'Regular', cls: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' };
    case 'poor': return { text: 'Fraca', cls: 'bg-red-500/20 text-red-300 border-red-500/30' };
    default:     return { text: '...', cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };
  }
}

interface JaasMeetingConfig {
  domain: string;
  appId: string;
  roomName: string;
  jwt: string;
  expiresAt: string;
}

interface ClinicalPatient {
  id: string;
  nome: string;
  nomeCompleto: string;
  idade: number;
  sexo: string;
  dataNascimento: string;
  telefone?: string;
  email?: string;
}

interface ClinicalRecord {
  id: string;
  data: string;
  tipoDocumento: string;
  profissional: string;
  especialidade: string;
  resumo?: string;
  conteudo: string;
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
  patientId,
  publicAccessToken,
  onJoin,
  onLeave,
}: JitsiRoomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiApi | null>(null);
  const hasLeftRef = useRef(false);
  const manualHangupRef = useRef(false);
  const joinedAtRef = useRef<number | null>(null);
  const joinReportedRef = useRef(false);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const callDurationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const tokenExpiryWarnTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tokenExpiryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [precheckState, setPrecheckState] = useState<PrecheckState>('idle');
  const [precheckMessage, setPrecheckMessage] = useState('');
  const [precheckDetails, setPrecheckDetails] = useState('');
  const [precheckApproved, setPrecheckApproved] = useState(false);
  const [statusState, setStatusState] = useState<ConnectionVisualState>('connecting');
  const [statusMessage, setStatusMessage] = useState('Conectando na sala...');
  const [statusDetail, setStatusDetail] = useState('Validando acesso e carregando conferência.');
  const [reconnectActive, setReconnectActive] = useState(false);
  const [reconnectReason, setReconnectReason] = useState('');
  const [reconnectCountdown, setReconnectCountdown] = useState(RECONNECT_DELAY_SECONDS);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [reconnectCycle, setReconnectCycle] = useState(0);
  const [participantCount, setParticipantCount] = useState(1);
  const [callDuration, setCallDuration] = useState(0);
  const [tokenExpiringSoon, setTokenExpiringSoon] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarLoading, setSidebarLoading] = useState(false);
  const [clinicalPatient, setClinicalPatient] = useState<ClinicalPatient | null>(null);
  const [clinicalRecords, setClinicalRecords] = useState<ClinicalRecord[]>([]);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>('unknown');
  const [videoMuted, setVideoMuted] = useState(false);
  const [audioFallbackOffered, setAudioFallbackOffered] = useState(false);
  const [audioFallbackActive, setAudioFallbackActive] = useState(false);
  const [lastEvent, setLastEvent] = useState<string>('Aguardando inicialização do Jitsi');

  const clearReconnectTimers = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (reconnectIntervalRef.current) {
      clearInterval(reconnectIntervalRef.current);
      reconnectIntervalRef.current = null;
    }

    if (callDurationIntervalRef.current) {
      clearInterval(callDurationIntervalRef.current);
      callDurationIntervalRef.current = null;
    }

    if (tokenExpiryWarnTimeoutRef.current) {
      clearTimeout(tokenExpiryWarnTimeoutRef.current);
      tokenExpiryWarnTimeoutRef.current = null;
    }

    if (tokenExpiryTimeoutRef.current) {
      clearTimeout(tokenExpiryTimeoutRef.current);
      tokenExpiryTimeoutRef.current = null;
    }
  }, []);

  const runPrecheck = useCallback(async () => {
    setPrecheckState('running');
    setPrecheckMessage('Executando verificação de dispositivos...');
    setPrecheckDetails('Solicitando acesso ao microfone e câmera.');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPrecheckState('failed');
      setPrecheckMessage('Navegador sem suporte para mídia');
      setPrecheckDetails('Use uma versão recente de Chrome, Edge, Firefox ou Safari.');
      return;
    }

    let stream: MediaStream | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const hasMic = devices.some((device) => device.kind === 'audioinput');
      const hasCamera = devices.some((device) => device.kind === 'videoinput');

      if (hasMic && hasCamera) {
        setPrecheckState('passed');
        setPrecheckMessage('Dispositivos prontos para teleconsulta');
        setPrecheckDetails('Microfone e câmera detectados e com permissão concedida.');
      } else {
        setPrecheckState('failed');
        setPrecheckMessage('Dispositivos incompletos');
        setPrecheckDetails('Conecte microfone e câmera para uma melhor experiência de chamada.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao verificar dispositivos.';
      const lower = message.toLowerCase();
      setPrecheckState('failed');

      if (lower.includes('notallowed') || lower.includes('permission')) {
        setPrecheckMessage('Permissão negada para câmera/microfone');
        setPrecheckDetails('Libere as permissões no navegador e clique em verificar novamente.');
      } else if (lower.includes('notfound')) {
        setPrecheckMessage('Dispositivo não encontrado');
        setPrecheckDetails('Conecte câmera/microfone e tente novamente.');
      } else {
        setPrecheckMessage('Falha no pré-check de dispositivos');
        setPrecheckDetails(message);
      }
    } finally {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    }
  }, []);

  useEffect(() => {
    if (precheckState === 'idle') {
      void runPrecheck();
    }
  }, [precheckState, runPrecheck]);

  const logEvent = useCallback((message: string, payload?: unknown) => {
    console.log(`[JitsiRoom:${roomId}] ${message}`, payload);
    setLastEvent(message);
  }, [roomId]);

  const loadClinicalData = useCallback(async () => {
    if (role !== 'professional' || !patientId) return;
    setSidebarLoading(true);
    try {
      const [patientRes, recordsRes] = await Promise.all([
        fetch(`/api/patients/${patientId}`),
        fetch(`/api/medical-records?patientId=${patientId}`),
      ]);
      if (patientRes.ok) {
        const p = await patientRes.json() as ClinicalPatient;
        setClinicalPatient(p);
      }
      if (recordsRes.ok) {
        const data = await recordsRes.json() as { records: ClinicalRecord[] };
        setClinicalRecords((data.records ?? []).slice(0, 5));
      }
    } catch (err) {
      console.warn('[JitsiRoom] Falha ao carregar dados clínicos:', err);
    } finally {
      setSidebarLoading(false);
    }
  }, [patientId, role]);

  const patchRoom = useCallback(async (action: 'start' | 'end', durationSeconds?: number) => {
    try {
      const body: Record<string, unknown> = { action };
      if (durationSeconds !== undefined) body.duracaoSegundos = durationSeconds;
      await fetch(`/api/videoconsultations/${roomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.warn('[JitsiRoom] Falha ao registrar telemetria:', err);
    }
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
    clearReconnectTimers();

    const durationSeconds = joinedAtRef.current
      ? Math.max(0, Math.round((Date.now() - joinedAtRef.current) / 1000))
      : 0;

    logEvent(`Saindo da sala. Motivo: ${reason}`);
    if (role === 'professional') {
      void patchRoom('end', durationSeconds);
    }
    await onLeave?.({ durationSeconds, reason });
  }, [clearReconnectTimers, logEvent, onLeave, patchRoom, role]);

  const triggerReconnect = useCallback((reason: string) => {
    if (manualHangupRef.current || hasLeftRef.current) {
      return;
    }

    if (reconnectActive) {
      return;
    }

    const nextAttempt = reconnectAttemptRef.current + 1;
    reconnectAttemptRef.current = nextAttempt;
    setReconnectAttempt(nextAttempt);

    if (nextAttempt > MAX_RECONNECT_ATTEMPTS) {
      setStatusState('error');
      setStatusMessage('Não foi possível reconectar automaticamente');
      setStatusDetail('Tente reconectar manualmente ou encerre a consulta.');
      setReconnectActive(false);
      setReconnectReason(reason);
      clearReconnectTimers();
      apiRef.current?.dispose();
      apiRef.current = null;
      return;
    }

    clearReconnectTimers();
    setReconnectReason(reason);
    setReconnectActive(true);
    setReconnectCountdown(RECONNECT_DELAY_SECONDS);
    setStatusState('reconnecting');
    setStatusMessage('Reconectando à sala...');
    setStatusDetail(`Tentativa ${nextAttempt} de ${MAX_RECONNECT_ATTEMPTS}.`);

    apiRef.current?.dispose();
    apiRef.current = null;

    reconnectIntervalRef.current = setInterval(() => {
      setReconnectCountdown((prev) => {
        if (prev <= 1) {
          if (reconnectIntervalRef.current) {
            clearInterval(reconnectIntervalRef.current);
            reconnectIntervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    reconnectTimeoutRef.current = setTimeout(() => {
      setReconnectActive(false);
      setLoading(true);
      setStatusState('connecting');
      setStatusMessage('Reconectando à sala...');
      setStatusDetail('Restabelecendo conexão com a teleconsulta.');
      setReconnectCycle((prev) => prev + 1);
    }, RECONNECT_DELAY_SECONDS * 1000);
  }, [clearReconnectTimers, reconnectActive]);

  const handleReconnectNow = useCallback(() => {
    clearReconnectTimers();
    setReconnectActive(false);
    setReconnectCountdown(0);
    setLoading(true);
    setStatusState('connecting');
    setStatusMessage('Reconectando à sala...');
    setStatusDetail('Tentativa manual de reconexão em andamento.');
    setReconnectCycle((prev) => prev + 1);
  }, [clearReconnectTimers]);

  const handleExitCall = useCallback(async () => {
    await safeLeave('conference-left');
  }, [safeLeave]);

  useEffect(() => {
    if (!precheckApproved) {
      return;
    }

    let active = true;

    const initJitsi = async () => {
      try {
        if (hasLeftRef.current) {
          return;
        }

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

        const isPatient = role === 'patient';

        const patientToolbarButtons = [
          'microphone',
          'camera',
          'desktop',
          'chat',
          'tileview',
          'fullscreen',
          'hangup',
          'settings',
          'videoquality',
        ];

        const professionalToolbarButtons = [
          ...patientToolbarButtons,
          'security',
          'mute-everyone',
          'participants-pane',
          'recording',
          'invite',
          'stats',
          'shortcuts',
          'filmstrip',
        ];

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
            startWithAudioMuted: isPatient,
            startWithVideoMuted: false,
            toolbarButtons: isPatient ? patientToolbarButtons : professionalToolbarButtons,
            disableRemoteMute: isPatient,
          },
          interfaceConfigOverwrite: {
            MOBILE_APP_PROMO: false,
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: isPatient,
          },
        });

        api.addEventListener('videoConferenceJoined', (payload) => {
          if (!active) return;
          clearReconnectTimers();
          reconnectAttemptRef.current = 0;
          setReconnectAttempt(0);
          setReconnectActive(false);
          joinedAtRef.current = Date.now();
          setCallDuration(0);
          setTokenExpiringSoon(false);
          if (callDurationIntervalRef.current) clearInterval(callDurationIntervalRef.current);
          callDurationIntervalRef.current = setInterval(() => setCallDuration((s) => s + 1), 1000);

          // Watcher de expiração do JWT
          const expiresMs = new Date(meetingConfig.expiresAt).getTime() - Date.now();
          const warnMs = expiresMs - 5 * 60 * 1000; // avisar 5 min antes
          if (warnMs > 0) {
            tokenExpiryWarnTimeoutRef.current = setTimeout(() => {
              setTokenExpiringSoon(true);
            }, warnMs);
          } else {
            setTokenExpiringSoon(true);
          }
          if (expiresMs > 0) {
            tokenExpiryTimeoutRef.current = setTimeout(() => {
              // Token expirou: reconectar para obter um novo
              triggerReconnect('O token da sessão expirou. Renovando conexão automaticamente.');
            }, expiresMs);
          }

          setLoading(false);
          setStatusState('active');
          setStatusMessage('Teleconsulta ativa');
          setStatusDetail('Conexão estabelecida. Você já pode iniciar o atendimento.');
          logEvent('Conferência iniciada', payload);
          if (role === 'professional') void patchRoom('start');
          if (role === 'professional') void loadClinicalData();
          void reportJoin();
        });

        api.addEventListener('videoConferenceLeft', (payload) => {
          logEvent('Conferência encerrada pelo Jitsi', payload);

          if (manualHangupRef.current) {
            setStatusState('error');
            setStatusMessage('Consulta encerrada');
            setStatusDetail('A chamada foi finalizada por você.');
            void safeLeave('conference-left');
            return;
          }

          triggerReconnect('A conferência foi encerrada inesperadamente.');
        });

        api.addEventListener('readyToClose', (payload) => {
          logEvent('Iframe sinalizou pronto para fechar', payload);

          if (manualHangupRef.current) {
            setStatusState('error');
            setStatusMessage('Finalizando teleconsulta');
            setStatusDetail('A interface solicitou o fechamento da sala.');
            void safeLeave('ready-to-close');
            return;
          }

          triggerReconnect('A sala sinalizou fechamento antes do esperado.');
        });

        api.addEventListener('participantJoined', (payload) => {
          setStatusState('active');
          setStatusMessage('Participante conectado');
          setStatusDetail('Todos na sala estão online.');
          setParticipantCount((prev) => prev + 1);
          logEvent('Participante entrou na sala', payload);
        });

        api.addEventListener('participantLeft', (payload) => {
          setStatusState('active');
          setStatusMessage('Participante desconectado');
          setStatusDetail('Aguardando retorno do participante. Sua conexão permanece ativa.');
          setParticipantCount((prev) => Math.max(1, prev - 1));
          logEvent('Participante saiu da sala', payload);
        });

        api.addEventListener('audioMuteStatusChanged', (payload) => {
          logEvent('Status do microfone alterado', payload);
        });

        api.addEventListener('videoMuteStatusChanged', (payload) => {
          const p = payload as { muted?: boolean } | undefined;
          if (p && typeof p.muted === 'boolean') setVideoMuted(p.muted);
          logEvent('Status da câmera alterado', payload);
        });

        api.addEventListener('screenSharingStatusChanged', (payload) => {
          logEvent('Status de compartilhamento de tela alterado', payload);
        });

        api.addEventListener('connectionQualityChanged', (payload) => {
          const p = payload as { connectionQuality?: number } | undefined;
          const score = p?.connectionQuality ?? -1;
          let quality: ConnectionQuality;
          if (score >= 70) {
            quality = 'good';
          } else if (score >= 40) {
            quality = 'fair';
            logEvent(`Qualidade de conexão regular (score: ${score})`);
          } else if (score >= 0) {
            quality = 'poor';
            logEvent(`Qualidade de conexão fraca (score: ${score})`);
            // Adaptação automática: reduz resolução quando a conexão é fraca
            apiRef.current?.executeCommand('setVideoQuality', 180);
          } else {
            quality = 'unknown';
          }
          // Restaura resolução ao recuperar qualidade
          if (quality === 'good') {
            apiRef.current?.executeCommand('setVideoQuality', 720);
          } else if (quality === 'fair') {
            apiRef.current?.executeCommand('setVideoQuality', 360);
          }
          setConnectionQuality(quality);
        });

        api.addEventListener('cameraError', (payload) => {
          setStatusState('device-warning');
          setStatusMessage('Erro de câmera detectado');
          setStatusDetail('Confira permissões de câmera e dispositivo selecionado.');
          setAudioFallbackOffered(true);
          logEvent('Erro de câmera', payload);
        });

        api.addEventListener('micError', (payload) => {
          setStatusState('device-warning');
          setStatusMessage('Erro de microfone detectado');
          setStatusDetail('Confira permissões de microfone e dispositivo selecionado.');
          logEvent('Erro de microfone', payload);
        });

        api.addEventListener('suspendDetected', (payload) => {
          logEvent('Suspensão detectada', payload);
          triggerReconnect('A aba foi suspensa e a conexão precisa ser retomada.');
        });

        api.addEventListener('browserSupport', (payload) => {
          logEvent('Validação de suporte do navegador', payload);
        });

        api.addEventListener('errorOccurred', (payload) => {
          setStatusState('error');
          setStatusMessage('Erro reportado pela API do Jitsi');
          setStatusDetail('Tentando manter a chamada. Verifique sua conexão de internet.');
          logEvent('Erro interno do Jitsi', payload);

          if (!manualHangupRef.current) {
            triggerReconnect('A API reportou uma falha de conexão.');
          }
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
      clearReconnectTimers();
      apiRef.current = null;
    };
  }, [
    clearReconnectTimers,
    displayName,
    loadClinicalData,
    loadMeetingConfig,
    logEvent,
    patchRoom,
    precheckApproved,
    reconnectCycle,
    reportJoin,
    role,
    safeLeave,
    triggerReconnect,
  ]);
  if (!precheckApproved) {
    const precheckClass =
      precheckState === 'passed'
        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
        : precheckState === 'running'
        ? 'border-sky-300 bg-sky-50 text-sky-700'
        : precheckState === 'failed'
        ? 'border-amber-300 bg-amber-50 text-amber-700'
        : 'border-slate-300 bg-slate-50 text-slate-700';

    return (
      <div className="flex h-screen items-center justify-center bg-[#0c161c] p-4">
        <div className="w-full max-w-xl rounded-xl border border-[#26414f] bg-[#10202a] p-6 text-white shadow-xl">
          <h2 className="text-xl font-bold">Pré-check da teleconsulta</h2>
          <p className="mt-1 text-sm text-slate-300">
            Antes de entrar, vamos validar microfone e câmera para evitar falhas na chamada.
          </p>

          <div className={`mt-4 rounded-lg border p-4 ${precheckClass}`}>
            <p className="text-sm font-semibold">{precheckMessage || 'Aguardando verificação'}</p>
            <p className="mt-1 text-xs opacity-90">{precheckDetails || 'Clique em verificar para iniciar.'}</p>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                void runPrecheck();
              }}
              className="rounded-md border border-[#37627a] bg-[#173447] px-4 py-2 text-sm font-medium text-white hover:bg-[#1f455c]"
            >
              {precheckState === 'running' ? 'Verificando...' : 'Verificar novamente'}
            </button>

            <button
              onClick={() => {
                setPrecheckApproved(true);
              }}
              className="rounded-md bg-[#1ea58c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#18956e]"
            >
              {precheckState === 'passed' ? 'Entrar na sala' : 'Entrar mesmo assim'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleHangup = async () => {
    manualHangupRef.current = true;

    if (apiRef.current) {
      logEvent('Encerramento manual solicitado pelo usuário');
      apiRef.current.executeCommand('hangup');

      setTimeout(() => {
        if (!hasLeftRef.current) {
          void safeLeave('manual-hangup');
        }
      }, 1200);
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
        {statusState === 'active' && (
          <>
            <p className="mt-0.5 text-xs font-mono opacity-75">Duração: {formatDuration(callDuration)}</p>
            {audioFallbackActive && (
              <span className="mt-1 inline-block rounded border border-orange-500/30 bg-orange-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-orange-300">
                Modo só áudio
              </span>
            )}
            {connectionQuality !== 'unknown' && (() => {
              const ql = getQualityLabel(connectionQuality);
              return (
                <span className={`mt-1 inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold ${ql.cls}`}>
                  Conexão: {ql.text}
                </span>
              );
            })()}
          </>
        )}
      </div>

      {/* Banner de fallback de áudio */}
      {audioFallbackOffered && !audioFallbackActive && (
        <div className="absolute left-4 top-28 z-20 w-full max-w-lg rounded-lg border border-orange-400/40 bg-orange-500/15 p-3 text-orange-100 backdrop-blur">
          <p className="text-sm font-semibold">Problema com a câmera detectado</p>
          <p className="mt-1 text-xs opacity-90">
            Não foi possível usar sua câmera. Você pode continuar a consulta apenas com áudio.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => {
                apiRef.current?.executeCommand('toggleVideo');
                setAudioFallbackActive(true);
                setAudioFallbackOffered(false);
                setVideoMuted(true);
                setStatusState('active');
                setStatusMessage('Modo só áudio ativo');
                setStatusDetail('Câmera desativada. Consulta prosseguindo por áudio.');
              }}
              className="rounded-md bg-orange-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-orange-400"
            >
              Continuar apenas com áudio
            </button>
            <button
              onClick={() => setAudioFallbackOffered(false)}
              className="rounded-md border border-orange-200/50 px-3 py-1.5 text-xs text-orange-100 hover:bg-orange-100/10"
            >
              Dispensar
            </button>
          </div>
        </div>
      )}

      {tokenExpiringSoon && !reconnectActive && (
        <div className="absolute left-4 top-28 z-20 w-full max-w-lg rounded-lg border border-yellow-400/40 bg-yellow-500/15 p-3 text-yellow-100 backdrop-blur">
          <p className="text-sm font-semibold">Sessão próxima do limite</p>
          <p className="mt-1 text-xs opacity-90">
            O token desta teleconsulta expira em breve. A reconexão será feita automaticamente — você não perderá a chamada.
          </p>
          <button
            onClick={() => setTokenExpiringSoon(false)}
            className="mt-2 text-xs underline opacity-75 hover:opacity-100"
          >
            Dispensar aviso
          </button>
        </div>
      )}

      {reconnectActive && (
        <div className="absolute left-4 top-28 z-20 w-full max-w-lg rounded-lg border border-amber-300/40 bg-amber-500/15 p-3 text-amber-100 backdrop-blur">
          <p className="text-sm font-semibold">Reconexão automática em andamento</p>
          <p className="mt-1 text-xs opacity-90">
            {reconnectReason} Nova tentativa em {reconnectCountdown}s (tentativa {reconnectAttempt} de {MAX_RECONNECT_ATTEMPTS}).
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleReconnectNow}
              className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-400"
            >
              Reconectar agora
            </button>
            <button
              onClick={() => {
                void handleExitCall();
              }}
              className="rounded-md border border-amber-200/50 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-100/10"
            >
              Encerrar consulta
            </button>
          </div>
        </div>
      )}

      {!reconnectActive && reconnectAttempt > MAX_RECONNECT_ATTEMPTS && (
        <div className="absolute left-4 top-28 z-20 w-full max-w-lg rounded-lg border border-red-300/40 bg-red-500/15 p-3 text-red-100 backdrop-blur">
          <p className="text-sm font-semibold">Não foi possível reconectar automaticamente</p>
          <p className="mt-1 text-xs opacity-90">
            Verifique sua internet e tente reconectar manualmente ou encerre a consulta.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={handleReconnectNow}
              className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-400"
            >
              Tentar reconectar
            </button>
            <button
              onClick={() => {
                void handleExitCall();
              }}
              className="rounded-md border border-red-200/50 px-3 py-1.5 text-xs font-semibold text-red-100 hover:bg-red-100/10"
            >
              Encerrar consulta
            </button>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-4 z-20 max-w-md rounded-md bg-black/60 px-3 py-2 text-xs text-white">
        Último evento: {lastEvent}
      </div>

      {/* Barra de controles de dispositivo — visível apenas quando na chamada */}
      {statusState === 'active' && connectionQuality !== 'unknown' && (() => {
        const ql = getQualityLabel(connectionQuality);
        return (
          <div className="absolute bottom-4 left-1/2 z-20 -translate-x-1/2 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/70 px-4 py-2 backdrop-blur">
            <span className={`rounded border px-2 py-1 text-[10px] font-semibold ${ql.cls}`}>
              Conexão: {ql.text}
            </span>
          </div>
        );
      })()}

      <button
        onClick={() => {
          void handleHangup();
        }}
        className="absolute right-4 top-4 z-20 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
      >
        {role === 'patient' ? 'Sair da consulta' : 'Encerrar consulta'}
      </button>

      {/* Botão de painel clínico — apenas profissional */}
      {role === 'professional' && (
        <button
          onClick={() => setSidebarOpen((prev) => !prev)}
          className="absolute right-4 top-16 z-20 rounded-md border border-[#37627a] bg-[#10202a]/90 px-3 py-2 text-xs font-medium text-white hover:bg-[#1f455c] backdrop-blur"
          title="Dados clínicos do paciente"
        >
          {sidebarOpen ? 'Fechar painel' : 'Dados do paciente'}
        </button>
      )}

      {/* Painel lateral clínico */}
      {role === 'professional' && sidebarOpen && (
        <div className="absolute right-4 top-32 z-20 flex h-[calc(100vh-9rem)] w-80 flex-col overflow-hidden rounded-xl border border-[#26414f] bg-[#10202a]/95 text-white shadow-2xl backdrop-blur">
          {/* Cabeçalho do painel */}
          <div className="flex items-center justify-between border-b border-[#26414f] px-4 py-3">
            <span className="text-sm font-semibold text-[#1ea58c]">Dados clínicos</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {sidebarLoading && (
              <p className="text-xs text-slate-400 animate-pulse">Carregando dados do paciente...</p>
            )}

            {!sidebarLoading && !clinicalPatient && (
              <p className="text-xs text-slate-400">Dados do paciente não disponíveis.</p>
            )}

            {clinicalPatient && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Identificação
                </h3>
                <div className="rounded-lg border border-[#26414f] bg-[#0c161c] p-3 space-y-1.5 text-sm">
                  <p className="font-semibold text-white">{clinicalPatient.nomeCompleto || clinicalPatient.nome}</p>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-slate-300">
                    <span className="text-slate-500">Idade</span>
                    <span>{clinicalPatient.idade} anos</span>
                    <span className="text-slate-500">Sexo</span>
                    <span>{clinicalPatient.sexo === 'M' ? 'Masculino' : clinicalPatient.sexo === 'F' ? 'Feminino' : 'Outro'}</span>
                    <span className="text-slate-500">Nascimento</span>
                    <span>{clinicalPatient.dataNascimento ? new Date(clinicalPatient.dataNascimento).toLocaleDateString('pt-BR') : '—'}</span>
                    {clinicalPatient.telefone && (
                      <>
                        <span className="text-slate-500">Telefone</span>
                        <span>{clinicalPatient.telefone}</span>
                      </>
                    )}
                    {clinicalPatient.email && (
                      <>
                        <span className="text-slate-500">Email</span>
                        <span className="truncate">{clinicalPatient.email}</span>
                      </>
                    )}
                  </div>
                </div>
              </section>
            )}

            {clinicalRecords.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Últimos registros
                </h3>
                <div className="space-y-2">
                  {clinicalRecords.map((rec) => (
                    <div key={rec.id} className="rounded-lg border border-[#26414f] bg-[#0c161c] p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-[#1ea58c]">{rec.tipoDocumento}</span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(rec.data).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 font-medium">{rec.especialidade} — {rec.profissional}</p>
                      {rec.resumo ? (
                        <p className="mt-1 text-xs text-slate-400 line-clamp-3">{rec.resumo}</p>
                      ) : (
                        <p className="mt-1 text-xs text-slate-400 line-clamp-3">{rec.conteudo}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {!sidebarLoading && clinicalRecords.length === 0 && clinicalPatient && (
              <p className="text-xs text-slate-400">Nenhum registro anterior encontrado.</p>
            )}
          </div>
        </div>
      )}

      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
