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
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
          console.log('Stream remoto recebido');
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = stream;
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
          // Sinalizacao desabilitada por enquanto - WebRTC P2P via STUN servers
          console.log('Signal (WebSocket desabilitado):', signal);
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

        // Exibir video local
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
          console.log('✅ Vídeo local exibido');
          console.log('📹 Tracks locais:', {
            audio: localStream.getAudioTracks().length,
            video: localStream.getVideoTracks().length,
          });
        } else {
          console.warn('⚠️ localVideoRef.current não definido');
        }

        webrtcRef.current = webrtc;
        setIsInitializing(false);

        // Iniciar polling para sinalizacao HTTP
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

  // Enviar signal de sinalizacao via HTTP
  const sendSignal = useCallback(
    async (type: string, signal: any) => {
      try {
        const response = await fetch(
          `/api/videoconsultations/${roomId}/signal`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type,
              signal,
              fromRole: role,
            }),
          }
        );

        if (!response.ok) {
          console.error('❌ Erro ao enviar signal:', response.statusText);
        } else {
          console.log(`✅ Signal ${type} enviado`);
        }
      } catch (err) {
        console.error('❌ Erro ao enviar signal:', err);
      }
    },
    [roomId, role]
  );

  // Poll para sinalizacao HTTP
  const startSignalingPolling = useCallback(
    (webrtc: WebRTCManager) => {
      console.log('🔄 Iniciando polling de sinalizacao...');

      // Se profissional, enviar oferta imediatamente
      if (role === 'professional') {
        setTimeout(async () => {
          try {
            const offer = await webrtc.createOffer();
            await sendSignal('offer', offer);
            console.log('📤 Oferta enviada pelo profissional');
          } catch (err) {
            console.error('❌ Erro ao criar oferta:', err);
          }
        }, 1000);
      }

      // Polling a cada 2 segundos
      const interval = setInterval(async () => {
        try {
          const response = await fetch(
            `/api/videoconsultations/${roomId}/signal?fromRole=${role}`,
            {
              method: 'GET',
            }
          );

          if (!response.ok) return;

          const { signals } = await response.json();

          for (const sig of signals) {
            console.log(`📨 Signal recebido: ${sig.type}`);

            if (sig.type === 'offer') {
              await webrtc.setRemoteDescription(sig.signal);
              const answer = await webrtc.createAnswer();
              await sendSignal('answer', answer);
              console.log('📤 Answer enviado');
            } else if (sig.type === 'answer') {
              await webrtc.setRemoteDescription(sig.signal);
              console.log('📥 Answer recebido');
            } else if (sig.type === 'ice-candidate') {
              if (sig.signal) {
                try {
                  await webrtc.addIceCandidate(new RTCIceCandidate(sig.signal));
                  console.log('❄️ ICE candidate adicionado');
                } catch (err) {
                  console.warn('⚠️ Erro ao adicionar ICE candidate:', err);
                }
              }
            }
          }
        } catch (err) {
          console.warn('⚠️ Erro ao fazer poll de signals:', err);
        }
      }, 2000);

      pollingIntervalRef.current = interval;
    },
    [roomId, role, sendSignal]
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
