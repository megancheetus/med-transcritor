/**
 * Gerenciador de WebRTC P2P para Teleconsultas
 * Usa ICE servers públicos do Google para conectividade
 */

export interface WebRTCConfig {
  iceServers: RTCIceServer[];
}

export const DEFAULT_WEBRTC_CONFIG: WebRTCConfig = {
  iceServers: [
    {
      urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
    },
    {
      urls: ['stun:stun2.l.google.com:19302', 'stun:stun3.l.google.com:19302'],
    },
    {
      urls: ['stun:stun4.l.google.com:19302'],
    },
  ],
};

export class WebRTCManager {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private signalingCallback: ((signal: any) => Promise<void>) | null = null;

  private onRemoteStreamCallback: ((stream: MediaStream) => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;
  private onConnectionStateCallback: ((state: RTCPeerConnectionState) => void) | null = null;
  private onIceConnectionStateCallback: ((state: RTCIceConnectionState) => void) | null = null;

  /**
   * Inicializa o gerenciador de WebRTC
   */
  async initialize(
    signalingCallback: (signal: any) => Promise<void>,
    config: WebRTCConfig = DEFAULT_WEBRTC_CONFIG
  ) {
    this.signalingCallback = signalingCallback;

    try {
      console.log('📹 Iniciando verificação de dispositivosde mídia...');
      
      // Verificar se mediaDevices está disponível
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser não suporta acesso a câmera/microfone');
      }
      
      console.log('✅ mediaDevices está disponível');
      console.log('🎤 Solicitando acesso a câmera e microfone...');
      
      // Solicitar acesso a câmera e microfone - SIMPLES E COMPATÍVEL
      const constraints = {
        audio: true,
        video: true,
      };
      
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        console.error('❌ Falha com constraints simples:', err);
        // Tentar apenas áudio
        console.log('🎧 Tentando apenas áudio...');
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }

      console.log('✅ Acesso concedido! Streams obtidas:', {
        áudio: this.localStream.getAudioTracks().length,
        vídeo: this.localStream.getVideoTracks().length,
      });

      // Criar peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: config.iceServers,
      });

      // Adicionar tracks locais
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });

      // Configurar event listeners
      this.setupPeerConnectionListeners();

      return this.localStream;
    } catch (error) {
      let err: Error;
      
      if (error instanceof Error) {
        console.error('❌ Erro ao acessar mídia:', {
          nome: error.name,
          mensagem: error.message,
        });
        
        // Diagnosticar tipo de erro
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          console.error('🔒 PERMISSÃO BLOQUEADA - O usuário não permitiu ou o navegador bloqueou');
          err = new Error('Permission denied: Acesso ao microfone/câmera foi bloqueado. Verifique as permissões do navegador.');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
          console.error('🎥 DISPOSITIVO NÃO ENCONTRADO - Câmera ou microfone não estão disponíveis');
          err = new Error('Nenhuma câmera ou microfone encontrado. Verifique se estão conectados.');
        } else {
          err = error;
        }
      } else {
        err = new Error('Erro desconhecido ao acessar mídia');
      }
      
      this.onErrorCallback?.(err);
      throw err;
    }
  }

  /**
   * Configura os event listeners da peer connection
   */
  private setupPeerConnectionListeners() {
    if (!this.peerConnection) return;

    // Quando recebi remotas da outra pessoa
    this.peerConnection.ontrack = (event) => {
      console.log('🎬 Track remoto recebido!', {
        kind: event.track.kind,
        enabled: event.track.enabled,
        readyState: event.track.readyState,
        streams: event.streams.length,
      });
      if (event.streams && event.streams[0]) {
        const incomingStream = event.streams[0];
        console.log('✅ Stream remoto ATIVO:', {
          audioTracks: incomingStream.getAudioTracks().length,
          videoTracks: incomingStream.getVideoTracks().length,
        });
        // Only call callback when stream changes — ontrack fires once per track
        // (audio then video), but they share the same stream object. Re-assigning
        // srcObject on the second ontrack interrupts the browser's decode pipeline
        // and loadedmetadata never fires.
        if (this.remoteStream !== incomingStream) {
          this.remoteStream = incomingStream;
          this.onRemoteStreamCallback?.(this.remoteStream);
        }
      }
    };

    // Mudanças de estado de conexão
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('🔗 Connection state changed:', state, {
        iceConnectionState: this.peerConnection?.iceConnectionState,
        signalingState: this.peerConnection?.signalingState,
      });
      this.onConnectionStateCallback?.(state as RTCPeerConnectionState);
    };

    // Mudanças de estado ICE
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState;
      console.log('❄️ ICE connection state changed:', state);
      this.onIceConnectionStateCallback?.(state as RTCIceConnectionState);
    };

    // Enviar ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.signalingCallback?.({
          type: 'ice-candidate',
          candidate: event.candidate,
        });
      }
    };

    // Data channel
    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannelListeners();
    };
  }

  /**
   * Cria uma oferta SDP
   */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection não inicializada');
    }

    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });

    await this.peerConnection.setLocalDescription(offer);

    if (!this.peerConnection.localDescription) {
      throw new Error('Falha ao criar oferta');
    }

    return this.peerConnection.localDescription;
  }

  /**
   * Cria uma resposta SDP
   */
  async createAnswer(): Promise<RTCSessionDescriptionInit> {
    if (!this.peerConnection) {
      throw new Error('Peer connection não inicializada');
    }

    const answer = await this.peerConnection.createAnswer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });

    await this.peerConnection.setLocalDescription(answer);

    if (!this.peerConnection.localDescription) {
      throw new Error('Falha ao criar resposta');
    }

    return this.peerConnection.localDescription;
  }

  /**
   * Define a descrição remota
   */
  async setRemoteDescription(description: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection não inicializada');
    }

    await this.peerConnection.setRemoteDescription(description);
  }

  /**
   * Adiciona um ICE candidate
   */
  async addIceCandidate(candidate: RTCIceCandidate): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('Peer connection não inicializada');
    }

    try {
      await this.peerConnection.addIceCandidate(candidate);
    } catch (error) {
      console.warn('Erro ao adicionar ICE candidate:', error);
    }
  }

  /**
   * Obtém o stream local
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Obtém o stream remoto
   */
  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  /**
   * Desliga câmera e microfone locais
   */
  toggleAudio(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  /**
   * Desliga vídeo local
   */
  toggleVideo(enabled: boolean): void {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((track) => {
        track.enabled = enabled;
      });
    }
  }

  /**
   * Fecha a conexão e para os tracks
   */
  close(): void {
    // Para todos os tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => track.stop());
    }

    // Fecha data channel
    if (this.dataChannel) {
      this.dataChannel.close();
    }

    // Fecha peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
    }

    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
  }

  /**
   * Define callback para stream remoto
   */
  onRemoteStream(callback: (stream: MediaStream) => void): void {
    this.onRemoteStreamCallback = callback;
  }

  /**
   * Define callback para erros
   */
  onError(callback: (error: Error) => void): void {
    this.onErrorCallback = callback;
  }

  /**
   * Define callback para mudanças de estado de conexão
   */
  onConnectionStateChange(callback: (state: RTCPeerConnectionState) => void): void {
    this.onConnectionStateCallback = callback;
  }

  /**
   * Define callback para mudanças de estado ICE
   */
  onIceConnectionStateChange(callback: (state: RTCIceConnectionState) => void): void {
    this.onIceConnectionStateCallback = callback;
  }

  /**
   * Configurar data channel para texto
   */
  private setupDataChannelListeners() {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      console.log('Data channel aberto');
    };

    this.dataChannel.onmessage = (event) => {
      console.log('Mensagem recebida:', event.data);
    };

    this.dataChannel.onclose = () => {
      console.log('Data channel fechado');
    };

    this.dataChannel.onerror = (event) => {
      console.error('Erro em data channel:', event);
    };
  }

  /**
   * Obtém estatísticas de conexão
   */
  async getStats(): Promise<RTCStatsReport | null> {
    if (!this.peerConnection) {
      return null;
    }

    return await this.peerConnection.getStats();
  }

  /**
   * Obter estado de conexão
   */
  getConnectionState(): RTCPeerConnectionState {
    return this.peerConnection?.connectionState || 'new';
  }

  /**
   * Obter estado ICE
   */
  getIceConnectionState(): RTCIceConnectionState {
    return this.peerConnection?.iceConnectionState || 'new';
  }

  /**
   * Verifica se está conectado
   */
  isConnected(): boolean {
    return this.peerConnection?.connectionState === 'connected';
  }
}
