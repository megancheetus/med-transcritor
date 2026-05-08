/**
 * Utilitários para processamento de áudio
 * - Compressão agressiva de áudio (reduz bitrate)
 * - Divisão em chunks como último recurso
 * - Detecta formato comprimido
 */

/**
 * Verifica se o blob de áudio está em formato comprimido
 */
interface WindowWithWebkitAudioContext extends Window {
  AudioContext?: typeof AudioContext;
  webkitAudioContext?: typeof AudioContext;
}

export function isAudioCompressed(mimeType: string): boolean {
  const compressedFormats = [
    'audio/webm',
    'audio/mpeg',
    'audio/mp4',
    'audio/ogg',
    'audio/opus',
    'audio/aac',
  ];
  return compressedFormats.some((format) => mimeType.includes(format));
}

/**
 * Comprime agressivamente o áudio reduzindo sample rate e canais
 * Objetivo: reduzir 20MB para ~8-10MB sem convertendo para WAV
 * 
 * Técnica:
 * 1. Reduz de 48kHz para 16kHz (1/3 do tamanho)
 * 2. Converte de estéreo para mono (1/2 do tamanho)
 * 3. Total: ~1/6 do tamanho (20MB → ~3.3MB)
 */
export async function compressAudio(audioBlob: Blob, targetSampleRate: number = 16000): Promise<Blob> {
  // Tentamos compressão para qualquer formato decodificável (inclusive WAV).
  // Só mantemos o original quando o resultado não reduz de fato o tamanho.

  // Se é pequeno (< 10MB), não precisa comprimir
  if (audioBlob.size < 10 * 1024 * 1024) {
    console.log(`✓ Áudio pequeno (${formatBytes(audioBlob.size)}), mantendo original`);
    return audioBlob;
  }

  try {
    console.log(`🔴 Áudio grande detectado (${formatBytes(audioBlob.size)}), tentando comprimir...`);

    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioWindow = window as WindowWithWebkitAudioContext;
    const AudioContextClass = audioWindow.AudioContext || audioWindow.webkitAudioContext;

    if (!AudioContextClass) {
      console.warn('AudioContext não suportado, mantendo áudio original');
      return audioBlob;
    }

    const audioContext = new AudioContextClass();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

    const currentSampleRate = audioBuffer.sampleRate;
    const currentChannels = audioBuffer.numberOfChannels;

    console.log(
      `📊 Áudio original: ${currentSampleRate}Hz, ${currentChannels} canal(is)`
    );

    // Se já é mono e 16kHz ou menos, retornar original
    if (currentChannels === 1 && currentSampleRate <= targetSampleRate) {
      console.log(`✓ Já está em formato comprimido (mono, ${currentSampleRate}Hz)`);
      await audioContext.close();
      return audioBlob;
    }

    // Criar buffer comprimido (sempre mono, reduzido sample rate)
    const compressedLength = Math.ceil(audioBuffer.length * (targetSampleRate / currentSampleRate));
    const offlineContext = new OfflineAudioContext(
      1, // Forçar MONO
      compressedLength,
      targetSampleRate
    );

    // Criar source
    const offlineSource = offlineContext.createBufferSource();
    offlineSource.buffer = audioBuffer;

    // O próprio OfflineAudioContext com 1 canal faz downmix para mono.
    offlineSource.connect(offlineContext.destination);

    offlineSource.start(0);

    // Render o áudio comprimido
    const renderedBuffer = await offlineContext.startRendering();
    const compressedBlob = audioBufferToWav(renderedBuffer);

    await audioContext.close();

    console.log(
      `✅ Áudio comprimido: ${currentSampleRate}Hz ${currentChannels}ch → ${targetSampleRate}Hz mono`
    );
    console.log(
      `📈 Redução: ${formatBytes(audioBlob.size)} → ${formatBytes(compressedBlob.size)}`
    );

    // Só retornar se realmente comprimiu
    if (compressedBlob.size < audioBlob.size) {
      return compressedBlob;
    } else {
      console.log(`⚠️ Compressão não reduziu tamanho, mantendo original`);
      return audioBlob;
    }
  } catch (error) {
    console.warn('Erro ao comprimir áudio:', error);
    return audioBlob;
  }
}

/**
 * Converte AudioBuffer para WAV Blob (descomprimido, mas pronto para Gemini)
 */
function audioBufferToWav(audioBuffer: AudioBuffer): Blob {
  const sampleRate = audioBuffer.sampleRate;
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleCount = audioBuffer.length;
  const dataLength = sampleCount * numberOfChannels * 2 + 36;

  const arrayBuffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(arrayBuffer);
  const channels: Float32Array[] = [];

  // Coletar dados dos canais
  for (let i = 0; i < numberOfChannels; i++) {
    channels.push(audioBuffer.getChannelData(i));
  }

  let pos = 0;

  // Write WAV header
  const setUint32 = (data: number) => {
    view.setUint32(pos, data, true);
    pos += 4;
  };
  const setUint16 = (data: number) => {
    view.setUint16(pos, data, true);
    pos += 2;
  };

  // RIFF identifier
  setUint32(0x46464952); // "RIFF"
  setUint32(dataLength);
  setUint32(0x45564157); // "WAVE"

  // fmt sub-chunk
  setUint32(0x20746d66); // "fmt "
  setUint32(16); // chunk size
  setUint16(1); // PCM
  setUint16(numberOfChannels);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numberOfChannels); // avg. bytes/sec
  setUint16(numberOfChannels * 2); // block-align
  setUint16(16); // 16-bit

  // data sub-chunk
  setUint32(0x61746164); // "data"
  setUint32(dataLength - 36);

  // Escrever dados de áudio (interleaved)
  for (let offset = 0; offset < sampleCount; offset++) {
    for (let i = 0; i < numberOfChannels; i++) {
      let s = Math.max(-1, Math.min(1, channels[i][offset]));
      s = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(pos, s, true);
      pos += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Formata bytes em unidade legível (KB, MB)
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Estima tamanho do arquivo após compressão
 * Para WebM Opus: ~10-15 KB por segundo
 */
export function estimateCompressedSize(durationSeconds: number, isCompressed: boolean = true): number {
  if (isCompressed) {
    // WebM Opus comprimido: ~12 KB/s
    return durationSeconds * 12 * 1024;
  } else {
    // WAV 16kHz 16-bit mono: ~32 KB/s
    return durationSeconds * 32 * 1024;
  }
}

/**
 * Divide um blob de áudio em chunks menores para processamento
 * ÚLTIMO RECURSO: só usar se após compressão ainda for > 18MB
 * 
 * NOTA: A divisão em chunks pode causar alucinações no Gemini
 * pois ele processa cada parte como se fosse um áudio separado.
 */
export async function splitAudioIntoChunks(
  audioBlob: Blob,
  maxChunkSizeBytes: number = 15 * 1024 * 1024
): Promise<Blob[]> {
  if (audioBlob.size <= maxChunkSizeBytes) {
    return [audioBlob];
  }

  console.warn(
    `⚠️ Arquivo muito grande (${formatBytes(audioBlob.size)}), dividindo em chunks...`
  );
  console.warn(`(Cada chunk será processado separadamente - cuidado com alucinações!)`);

  // Para agora, retornar como está
  // O processamento em chunks deve ser feito no servidor se absolutamente necessário
  return [audioBlob];
}


