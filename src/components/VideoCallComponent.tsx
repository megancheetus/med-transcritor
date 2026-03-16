'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { WebRTCManager } from '@/lib/webrtcManager';
import { Mic, MicOff, Video, VideoOff, Phone, Copy, Check } from 'lucide-react';

interface VideoCallComponentProps {
  roomId: string;
  roomToken: string;
  role: 'professional' | 'patient';
  professionalName?: string;
  patientName?: string;
  onEndCall?: (duration: number) => Promise<void>;
  onRecordingToggle?: (recording: boolean) => void;
}

export function VideoCallComponent({
  roomId,
  roomToken,
  role,
  professionalName,
  patientName,
  onEndCall,
  onRecordingToggle,
}: VideoCallComponentProps) {
  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const webrtcRef = useRef<WebRTCManager | null>(null);

  // States
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [copied, setCopied] = useState(false);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Inicializar WebRTC
  useEffect(() => {
    const initialize = async () => {
      try {
        setError(null);
        setIsInitializing(true);

        // Criar WebRTC manager
        const webrtc = new WebRTCManager();

        // Setup de callbacks ANTES de inicializar
        webrtc.onRemoteStream((stream) => {
          console.log('📨 Stream remoto recebido');
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
            console.log('✅ Remote video srcObject setado');
            console.log('📹 Remote video element:', {
              hasRef: !!remoteVideoRef.current,
              hasSrcObject: !!remoteVideoRef.current.srcObject,
              tracks: {
                audio: stream.getAudioTracks().length,
                video: stream.getVideoTracks().length,
              },
              videoTracks: stream.getVideoTracks().map(t => ({
                kind: t.kind,
                enabled: t.enabled,
                readyState: t.readyState,
              })),
            });
            
            // Configurar event listeners AGORA que temos um ref válido
            setupVideoEventListeners(remoteVideoRef, 'REMOTE');
          } else {
            console.error('❌ remoteVideoRef.current é nulo');
          }
        });

        webrtc.onError((err) => {
          console.error('Erro WebRTC:', err);
          const errorMsg = err.message || 'Erro ao acessar câmera/microfone';
          setError(errorMsg);
        });

        webrtc.onConnectionStateChange((state) => {
          console.log('Connection state:', state);
          if (state === 'connected') {
            setIsConnected(true);
            // Iniciar contador de duração
            if (!durationIntervalRef.current) {
              durationIntervalRef.current = setInterval(() => {
                setCallDuration((prev) => prev + 1);
              }, 1000);
            }
          } else if (state === 'failed' || state === 'disconnected') {
            setIsConnected(false);
          }
        });

        console.log('Solicitando acesso a câmera e microfone...');
        
        // Inicializar mídia - ISTO VAI PEDIR PERMISSÃO AO NAVEGADOR
        const localStream = await webrtc.initialize(async (signal) => {
          // Sinalizacao desabilitada - usar HTTP polling em vez de WebSocket
          console.log('📡 Signal gerado (WebSocket desabilitado):', signal);
        });

        console.log('✅ Acesso à mídia concedido');

        // Criar MediaRecorder para gravação opcional
        mediaRecorderRef.current = new MediaRecorder(localStream, {
          mimeType: MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : 'audio/mp4',
        });

        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };

        // Exibir video local - com retry automático se ref ainda não estiver pronto
        const attachLocalStream = () => {
          console.log('🎬 Tentando atribuir srcObject ao vídeo local...', {
            hasRef: !!localVideoRef.current,
            refType: typeof localVideoRef.current,
          });
          
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
            console.log('✅ Vídeo local srcObject setado');
            console.log('📹 Local video element:', {
              hasRef: !!localVideoRef.current,
              hasSrcObject: !!localVideoRef.current.srcObject,
              tracks: {
                audio: localStream.getAudioTracks().length,
                video: localStream.getVideoTracks().length,
              },
              videoTracks: localStream.getVideoTracks().map(t => ({
                kind: t.kind,
                enabled: t.enabled,
                readyState: t.readyState,
              })),
            });
            
            // Configurar event listeners AGORA que temos um ref válido
            setupVideoEventListeners(localVideoRef, 'LOCAL');
          } else {
            console.warn('⚠️ localVideoRef ainda nulo, tentando novamente em 100ms...');
            // Retry com pequeno delay - deixa React render os elementos
            setTimeout(attachLocalStream, 100);
          }
        };
        
        attachLocalStream();

        webrtcRef.current = webrtc;
        setIsInitializing(false);

        // Iniciar polling HTTP para sinalizacao
        startSignalingPolling(webrtc);
      } catch (err) {
        let errorMessage = 'Erro ao inicializar chamada';
        
        if (err instanceof Error) {
          // Detectar erro de permissão
          if (err.message.includes('Permission denied') || 
              err.message.includes('NotAllowedError') ||
              err.name === 'NotAllowedError') {
            errorMessage = 'Permission denied: Acesso ao microfone/câmera foi bloqueado';
          } else {
            errorMessage = err.message;
          }
        }
        
        console.error('❌ Erro na inicialização:', errorMessage);
        setError(errorMessage);
        setIsInitializing(false);
      }
    };

    initialize();

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [roomId, role]);

  // Adicionar event listeners aos elementos video quando srcObject é setado
  const setupVideoEventListeners = useCallback((videoRef: React.RefObject<HTMLVideoElement | null>, name: string, retries = 0) => {
    const video = videoRef.current;
    if (!video) {
      if (retries < 3) {
        console.log(`⚠️ ${name} video ref não está available, retrying... (${retries + 1}/3)`);
        setTimeout(() => setupVideoEventListeners(videoRef, name, retries + 1), 50);
      } else {
        console.log(`❌ ${name} video ref nunca ficou disponível`);
      }
      return;
    }

    const handlers = {
      loadstart: () => console.log(`📺 ${name}: loadstart`),
      loadedmetadata: () => {
        console.log(`📺 ${name}: loadedmetadata (${video.videoWidth}x${video.videoHeight})`);
        if (video.paused) {
          console.log(`⏯️ ${name}: Tentando play() após loadedmetadata...`);
          video.play().catch(e => console.warn(`⚠️ Erro ao play ${name}:`, e));
        }
      },
      loadeddata: () => console.log(`📺 ${name}: loadeddata`),
      canplay: () => {
        console.log(`📺 ${name}: canplay`);
        if (video.paused) {
          console.log(`⏯️ ${name}: Tentando play() em canplay...`);
          video.play().catch(e => console.warn(`⚠️ Erro ao play ${name}:`, e));
        }
      },
      canplaythrough: () => console.log(`📺 ${name}: canplaythrough`),
      playing: () => console.log(`✅ ${name}: PLAYING!`),
      pause: () => console.log(`⏸️ ${name}: paused`),
      ended: () => console.log(`⏹️ ${name}: ended`),
      error: () => console.error(`❌ ${name}: ERROR -`, video.error?.message),
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      video.addEventListener(event, handler as EventListener);
    });

    // Retorna função para remover listeners
    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        video.removeEventListener(event, handler as EventListener);
      });
    };
  }, []);

  // Monitorar status dos vídeos E forçar play() periodicamente
  useEffect(() => {
    if (isInitializing || error) return;

    const interval = setInterval(() => {
      // Só forçar play() se metadata foi carregado (readyState >= 1)
      if (localVideoRef.current && localVideoRef.current.readyState >= 1 && localVideoRef.current.paused) {
        localVideoRef.current.play().catch(e => console.log('⚠️ Não conseguiu triggerar play local:', e));
      }

      if (remoteVideoRef.current && remoteVideoRef.current.readyState >= 1 && remoteVideoRef.current.paused) {
        remoteVideoRef.current.play().catch(e => console.log('⚠️ Não conseguiu triggerar play remoto:', e));
      }

      const localStatus = {
        ref: !!localVideoRef.current,
        srcObject: !!localVideoRef.current?.srcObject,
        readyState: localVideoRef.current?.readyState,
        paused: localVideoRef.current?.paused,
        width: localVideoRef.current?.videoWidth,
        height: localVideoRef.current?.videoHeight,
        srcObjectStreams: (localVideoRef.current?.srcObject as MediaStream)?.getTracks?.().length || 0,
      };

      const remoteStatus = {
        ref: !!remoteVideoRef.current,
        srcObject: !!remoteVideoRef.current?.srcObject,
        readyState: remoteVideoRef.current?.readyState,
        paused: remoteVideoRef.current?.paused,
        width: remoteVideoRef.current?.videoWidth,
        height: remoteVideoRef.current?.videoHeight,
        srcObjectStreams: (remoteVideoRef.current?.srcObject as MediaStream)?.getTracks?.().length || 0,
      };

      console.log('🎬 VIDEO STATUS:', { local: localStatus, remote: remoteStatus, isConnected });
    }, 3000);

    return () => clearInterval(interval);
  }, [isInitializing, error, isConnected]);


  // Sinalizacao HTTP polling
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startSignalingPolling = useCallback(
    (webrtc: WebRTCManager) => {
      console.log('🔄 Iniciando polling de sinalizacao HTTP...');

      let offerSent = false;

      // Polling a cada 1000ms (mais frequente para melhor sincronização)
      const interval = setInterval(async () => {
        try {
          // Se profissional e ainda não enviou oferta, enviar agora
          if (role === 'professional' && !offerSent) {
            try {
              const offer = await webrtc.createOffer();
              const response = await fetch(
                `/api/videoconsultations/${roomId}/signal`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    type: 'offer',
                    signal: offer,
                    fromRole: role,
                  }),
                }
              );
              if (response.ok) {
                console.log('📤 Oferta enviada pelo profissional');
                offerSent = true;
              }
            } catch (err) {
              console.error('❌ Erro ao criar/enviar oferta:', err);
            }
          }

          // Fazer GET para buscar signals do outro usuário
          const response = await fetch(
            `/api/videoconsultations/${roomId}/signal?fromRole=${role}`,
            { method: 'GET' }
          );

          if (!response.ok) {
            console.log('⚠️ GET retornou status:', response.status);
            return;
          }

          const { signals } = await response.json();
          if (!signals || signals.length === 0) return;

          console.log(`📬 Recebidos ${signals.length} signal(s)`);

          for (const sig of signals) {
            console.log(`📨 Signal recebido: ${sig.type}`);

            if (sig.type === 'offer') {
              setIsConnected(true);
              console.log('🎬 Processando OFFER...');
              await webrtc.setRemoteDescription(sig.signal);
              const answer = await webrtc.createAnswer();
              await fetch(`/api/videoconsultations/${roomId}/signal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'answer',
                  signal: answer,
                  fromRole: role,
                }),
              });
              console.log('📤 Answer enviado como resposta');
            } else if (sig.type === 'answer') {
              setIsConnected(true);
              console.log('🎬 Processando ANSWER...');
              await webrtc.setRemoteDescription(sig.signal);
              console.log('📥 Answer processado');
            } else if (sig.type === 'ice-candidate') {
              if (sig.signal) {
                try {
                  console.log('❄️ Adicionando ICE candidate...');
                  await webrtc.addIceCandidate(new RTCIceCandidate(sig.signal));
                  console.log('✅ ICE candidate adicionado');
                } catch (err) {
                  console.warn('⚠️ Erro ao adicionar ICE candidate:', err);
                }
              }
            }
          }
        } catch (err) {
          console.warn('⚠️ Erro no polling:', err);
        }
      }, 1000); // Reduzido de 2000 para 1000ms

      pollingIntervalRef.current = interval;
    },
    [roomId, role]
  );

  // Toggle áudio
  const handleToggleAudio = useCallback(() => {
    const newState = !audioEnabled;
    setAudioEnabled(newState);
    webrtcRef.current?.toggleAudio(newState);
  }, [audioEnabled]);

  // Toggle vídeo
  const handleToggleVideo = useCallback(() => {
    const newState = !videoEnabled;
    setVideoEnabled(newState);
    webrtcRef.current?.toggleVideo(newState);
  }, [videoEnabled]);

  // Iniciar/parar gravação
  const handleToggleRecording = useCallback(async () => {
    if (!mediaRecorderRef.current) return;

    if (isRecording) {
      // Parar gravação
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      onRecordingToggle?.(false);

      // Preparar blob para envio
      const audioBlob = new Blob(recordedChunksRef.current, {
        type: mediaRecorderRef.current.mimeType,
      });

      // Aqui você poderia enviar para transcrição
      console.log('Áudio gravado:', audioBlob);
      recordedChunksRef.current = [];
    } else {
      // Iniciar gravação
      recordedChunksRef.current = [];
      mediaRecorderRef.current.start();
      setIsRecording(true);
      onRecordingToggle?.(true);
    }
  }, [isRecording, onRecordingToggle]);

  // Encerrar chamada
  const handleEndCall = useCallback(async () => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }

    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }

    // Fechar WebRTC
    webrtcRef.current?.close();

    // Callback
    if (onEndCall) {
      await onEndCall(callDuration);
    }
  }, [callDuration, isRecording, onEndCall]);

  // Copiar link (apenas prof)
  const handleCopyLink = useCallback(() => {
    // Nota: roomToken deveria ser passado como prop, por enquanto usa room ID
    // Paciente acessa com: /room/[id]?token=[roomToken]
    const link = `${window.location.origin}/room/${roomId}?token=${roomToken}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [roomId, roomToken]);

  // Formatar duração
  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isInitializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0c161c]">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#1ea58c] mb-4 animate-spin">
            <div className="h-8 w-8 rounded-full border-4 border-[#0c161c] border-t-white"></div>
          </div>
          <p className="text-white text-lg font-medium">Inicializando chamada...</p>
          <p className="text-[#7b8d97] text-sm mt-2">Verificando permissões de câmera e microfone...</p>
          <p className="text-[#7b8d97] text-xs mt-4">Se não conseguir acessar, verifique se o navegador tem permissão</p>
        </div>
      </div>
    );
  }

  if (error) {
    // Erro de permissão - mostrar instruções
    if (error.includes('Permission denied') || error.includes('NotAllowedError') || error.includes('denied')) {
      return (
        <div className="flex h-screen items-center justify-center bg-[#0c161c] p-4">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold text-white mb-2">Acesso Bloqueado</h2>
            <p className="text-[#7b8d97] mb-6">
              O navegador bloqueou acesso ao microfone/câmera. Você precisa autorizar manualmente.
            </p>
            <div className="bg-[#155b79]/20 border border-[#1ea58c] rounded-lg p-4 mb-6 text-left">
              <p className="text-white font-medium mb-3">Como autorizar no Edge/Chrome:</p>
              <ol className="text-[#7b8d97] text-sm space-y-2">
                <li>✓ Clique no 🔒 (cadeado) na barra de endereço</li>
                <li>✓ Procure "Microfone" - mude para <strong>Permitir</strong></li>
                <li>✓ Procure "Câmera" - mude para <strong>Permitir</strong></li>
                <li>✓ Clique "Recarregar" abaixo</li>
              </ol>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-6 py-3 bg-[#1ea58c] hover:bg-[#18956e] text-white font-medium rounded-lg transition mb-3"
            >
              🔄 Recarregar Página
            </button>
            <button
              onClick={() => {
                // Resetar erro e tentar novamente
                setError(null);
                setIsInitializing(true);
              }}
              className="w-full px-6 py-3 bg-[#155b79] hover:bg-[#1d6b8f] text-white font-medium rounded-lg transition border border-[#1ea58c]"
            >
              🔁 Tentar Novamente
            </button>
          </div>
        </div>
      );
    }

    // Outro erro genérico
    return (
      <div className="flex h-screen items-center justify-center bg-[#0c161c] p-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-2">Erro ao Inicializar</h2>
          <p className="text-[#7b8d97] mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-[#1ea58c] hover:bg-[#18956e] text-white font-medium rounded-lg transition"
          >
            Recarregar Página
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[#0c161c]">
      {/* Video container */}
      <div className="flex-1 flex gap-2 p-4 overflow-hidden">
        {/* Video remoto (maior) */}
        <div className="flex-1 bg-black rounded-lg overflow-hidden relative">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          {!isConnected && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <p className="text-white text-center">
                Aguardando {role === 'professional' ? 'paciente' : 'profissional'}...
              </p>
            </div>
          )}
          <div className="absolute top-4 left-4 bg-[#155b79]/80 text-white px-3 py-2 rounded-lg text-sm font-medium">
            {role === 'professional' ? patientName : professionalName}
          </div>
        </div>

        {/* Video local (menor, canto) */}
        <div className="w-40 h-40 bg-black rounded-lg overflow-hidden relative border-2 border-[#1ea58c]">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-2 left-2 bg-[#155b79]/80 text-white px-2 py-1 rounded text-xs font-medium">
            Você
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-500/10 border-l-4 border-red-500 p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Control bar */}
      <div className="bg-[#155b79] border-t border-[#1ea58c] p-6 flex items-center justify-between">
        {/* Left: Timer */}
        <div className="text-white font-mono text-xl font-bold">
          {formatDuration(callDuration)}
        </div>

        {/* Center: Controls */}
        <div className="flex gap-4">
          {/* Audio toggle */}
          <button
            onClick={handleToggleAudio}
            className={`p-3 rounded-full transition ${
              audioEnabled
                ? 'bg-[#1ea58c] hover:bg-[#18956e]'
                : 'bg-red-500 hover:bg-red-600'
            } text-white`}
            title={audioEnabled ? 'Desligar microfone' : 'Ligar microfone'}
          >
            {audioEnabled ? <Mic size={20} /> : <MicOff size={20} />}
          </button>

          {/* Video toggle */}
          <button
            onClick={handleToggleVideo}
            className={`p-3 rounded-full transition ${
              videoEnabled
                ? 'bg-[#1ea58c] hover:bg-[#18956e]'
                : 'bg-red-500 hover:bg-red-600'
            } text-white`}
            title={videoEnabled ? 'Desligar câmera' : 'Ligar câmera'}
          >
            {videoEnabled ? <Video size={20} /> : <VideoOff size={20} />}
          </button>

          {/* Recording toggle (apenas profissional) */}
          {role === 'professional' && (
            <button
              onClick={handleToggleRecording}
              className={`p-3 rounded-full transition ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                  : 'bg-[#1ea58c] hover:bg-[#18956e]'
              } text-white`}
              title={isRecording ? 'Parar de gravar' : 'Gravar consulta'}
            >
              <div className="w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></div>
            </button>
          )}

          {/* End call */}
          <button
            onClick={handleEndCall}
            className="p-3 rounded-full bg-red-500 hover:bg-red-600 transition text-white"
            title="Encerrar chamada"
          >
            <Phone size={20} className="rotate-135" />
          </button>
        </div>

        {/* Right: Copy link or info */}
        <div className="flex items-center gap-2">
          {role === 'professional' && (
            <button
              onClick={handleCopyLink}
              className={`p-2 rounded-lg transition flex items-center gap-2 text-sm font-medium ${
                copied
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-[#1ea58c] hover:bg-[#18956e] text-white'
              }`}
              title="Copiar link de acesso"
            >
              {copied ? (
                <>
                  <Check size={16} /> Copiado
                </>
              ) : (
                <>
                  <Copy size={16} /> Link
                </>
              )}
            </button>
          )}
          {isRecording && (
            <div className="flex items-center gap-2 text-red-400 font-medium text-sm">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              Gravando...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
