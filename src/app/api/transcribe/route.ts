import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { NextRequest, NextResponse } from 'next/server';
import { isValidAuthToken } from '@/lib/auth';
import { getModelById, TranscriptionModelType, TRANSCRIPTION_MODELS } from '@/lib/transcriptionModels';

const GEMINI_MODEL = 'gemini-2.5-flash';
// Audios maiores que este limite são enviados via Files API (upload separado ao Google),
// em vez de inline base64, evitando o erro 413 do Gemini para payloads grandes.
// O inline base64 cresce ~33%; por isso usamos um limite conservador para evitar 413.
const FILES_API_THRESHOLD_BYTES = 6 * 1024 * 1024; // 6 MB
const CHUNK_SIZE_BYTES = 15 * 1024 * 1024;

/**
 * IMPORTANTE: O processamento chunked pode causar alucinações no Gemini
 * porque ele processa cada chunk como se fosse um áudio separado.
 * 
 * Fluxo recomendado:
 * 1. Cliente tenta comprimir o áudio primeiro
 * 2. Se < 18MB após compressão → Enviar direto
 * 3. Se > 18MB mesmo após compressão → PODE dividir em chunks se absolutamente necessário
 *    (mas pode gerar resultados inconsistentes)
 */

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('A chave da API Gemini não está configurada.');
  }

  return new GoogleGenerativeAI(apiKey);
};

const getErrorDetails = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const maybeMessage = Reflect.get(error, 'message');

    if (typeof maybeMessage === 'string') {
      return maybeMessage;
    }
  }

  return 'Erro desconhecido ao processar o áudio.';
};

/**
 * Divide um buffer de áudio em chunks menores
 * Retorna array de buffers, cada um com tamanho <= CHUNK_SIZE_BYTES
 */
function divideAudioIntoChunks(buffer: Buffer, chunkSize: number = CHUNK_SIZE_BYTES): Buffer[] {
  const chunks: Buffer[] = [];
  let offset = 0;

  while (offset < buffer.length) {
    const end = Math.min(offset + chunkSize, buffer.length);
    chunks.push(buffer.subarray(offset, end));
    offset = end;
  }

  return chunks;
}

/**
 * Processa um chunk de áudio pequeno via inline base64 com Gemini.
 */
async function processAudioChunk(
  client: GoogleGenerativeAI,
  geminiModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  transcriptionPrompt: string,
  base64Audio: string,
  mimeType: string,
  chunkIndex: number,
  totalChunks: number
): Promise<string> {
  const prompt =
    totalChunks > 1
      ? `${transcriptionPrompt}\n\nNOTA: Este é o CHUNK ${chunkIndex + 1}/${totalChunks} de um áudio dividido. Transcreva apenas este segmento.`
      : transcriptionPrompt;

  const response = await geminiModel.generateContent([
    prompt,
    {
      inlineData: {
        mimeType,
        data: base64Audio,
      },
    },
  ]);

  return response.response.text();
}

/**
 * Processa áudio usando a Gemini Files API.
 * Faz upload do buffer diretamente para os servidores do Google e usa a URI no generateContent.
 * Suporta arquivos de até 2 GB — sem restrição de tamanho inline.
 */
async function processAudioViaFilesAPI(
  geminiModel: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
  fileManager: GoogleAIFileManager,
  transcriptionPrompt: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  console.log(`📤 Enviando via Files API (${buffer.length} bytes)...`);

  const uploadResult = await fileManager.uploadFile(buffer, {
    mimeType,
    displayName: `consultation-${Date.now()}`,
  });

  const file = uploadResult.file;
  console.log(`✅ Upload concluído: ${file.uri}`);

  try {
    const response = await geminiModel.generateContent([
      transcriptionPrompt,
      {
        fileData: {
          mimeType: file.mimeType,
          fileUri: file.uri,
        },
      },
    ]);

    return response.response.text();
  } finally {
    // Remover o arquivo do Google após o processamento para não acumular no storage
    await fileManager.deleteFile(file.name).catch((err: unknown) => {
      console.warn('Aviso: não foi possível remover arquivo do Gemini Files API:', err);
    });
  }
}

/**
 * Combina resultados de múltiplos chunks
 */
function combineChunkResults(results: string[], totalChunks: number): string {
  if (totalChunks === 1) {
    return results[0];
  }

  // Se o modelo é SOAP, tentar combinar as seções
  // Caso contrário, apenas concatenar com marcadores
  const combinedText = results
    .map((result, i) => `--- PARTE ${i + 1}/${totalChunks} ---\n${result}`)
    .join('\n\n');

  return combinedText;
}

export async function POST(request: NextRequest) {
  const authToken = request.cookies.get('auth_token')?.value;

  if (!(await isValidAuthToken(authToken))) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const audioBlob = formData.get('audio') as Blob;
    const mimeType = audioBlob?.type || 'audio/webm';
    const model = (formData.get('model') as TranscriptionModelType) || 'soap';

    // Validate model
    if (!TRANSCRIPTION_MODELS[model]) {
      return NextResponse.json(
        { error: 'Modelo de transcrição inválido' },
        { status: 400 }
      );
    }

    if (!audioBlob) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    console.log('🎵 Audio blob size:', audioBlob.size, 'bytes');
    console.log('🎵 Audio blob type:', mimeType);

    // Convert blob to buffer
    const buffer = Buffer.from(await audioBlob.arrayBuffer());

    // Decidir se precisa dividir em chunks
    const needsChunking = buffer.length > CHUNK_SIZE_BYTES;
    const chunks = needsChunking ? divideAudioIntoChunks(buffer) : [buffer];

    console.log(`🧭 Decisão chunking: ${needsChunking ? 'SIM' : 'NÃO'} (limite ${CHUNK_SIZE_BYTES} bytes)`);
    console.log(`📦 Total de chunks: ${chunks.length}`);

    const client = getGeminiClient();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('A chave da API Gemini não está configurada.');
    const geminiModel = client.getGenerativeModel({ model: GEMINI_MODEL });
    const fileManager = new GoogleAIFileManager(apiKey);
    const transcriptionModel = getModelById(model);

    const results: string[] = [];

    // Arquivos grandes: usar Files API (sem limite inline) para evitar 413 do Gemini.
    // Arquivos pequenos: usar inline base64 (mais rápido, sem round-trip de upload).
    if (buffer.length > FILES_API_THRESHOLD_BYTES) {
      console.log(`📦 Áudio grande (${buffer.length} bytes) → usando Files API`);
      const result = await processAudioViaFilesAPI(
        geminiModel,
        fileManager,
        transcriptionModel.prompt,
        buffer,
        mimeType
      );
      results.push(result);
    } else {
      for (let i = 0; i < chunks.length; i++) {
        console.log(`\n🔄 Processando chunk ${i + 1}/${chunks.length} (${chunks[i].length} bytes)`);

        const base64Chunk = chunks[i].toString('base64');

        try {
          const chunkResult = await processAudioChunk(
            client,
            geminiModel,
            transcriptionModel.prompt,
            base64Chunk,
            mimeType,
            i,
            chunks.length
          );

          results.push(chunkResult);
          console.log(`✅ Chunk ${i + 1} processado com sucesso`);
        } catch (chunkError) {
          console.error(`❌ Erro ao processar chunk ${i + 1}:`, chunkError);
          throw new Error(`Falha ao processar parte ${i + 1}/${chunks.length}: ${getErrorDetails(chunkError)}`);
        }
      }
    }

    // Combinar resultados
    const finalResult = combineChunkResults(results, chunks.length);

    console.log('✅ Processamento concluído com sucesso');

    return NextResponse.json({
      content: finalResult,
      model: model,
      chunked: chunks.length > 1,
      chunksProcessed: chunks.length,
    });
  } catch (error) {
    const details = getErrorDetails(error);
    const maybeStatus = typeof Reflect.get(error as object, 'status') === 'number'
      ? Number(Reflect.get(error as object, 'status'))
      : 500;

    console.error('❌ Erro ao processar áudio:', error);
    return NextResponse.json(
      { error: 'Failed to process audio', details },
      { status: maybeStatus >= 400 && maybeStatus < 600 ? maybeStatus : 500 }
    );
  }
}

