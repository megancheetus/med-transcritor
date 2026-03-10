import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { getModelById, TranscriptionModelType, TRANSCRIPTION_MODELS } from '@/lib/transcriptionModels';

const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_INLINE_AUDIO_BYTES = 18 * 1024 * 1024;

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

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

export async function POST(request: NextRequest) {
  const authToken = request.cookies.get('auth_token')?.value;

  if (authToken !== 'authenticated') {
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

    if (audioBlob.size > MAX_INLINE_AUDIO_BYTES) {
      return NextResponse.json(
        {
          error: 'Áudio muito grande para envio direto.',
          details: 'Grave um trecho menor ou use áudio comprimido. O limite atual para envio inline é de aproximadamente 18 MB.',
        },
        { status: 413 }
      );
    }

    console.log('Audio blob size:', audioBlob.size);
    console.log('Audio blob type:', mimeType);

    // Convert blob to base64
    const buffer = await audioBlob.arrayBuffer();
    const base64Audio = Buffer.from(buffer).toString('base64');

    console.log('Base64 size:', base64Audio.length);

    // Use Gemini API to process the audio
    const client = getGeminiClient();
    const geminiModel = client.getGenerativeModel({ model: GEMINI_MODEL });
    const transcriptionModel = getModelById(model);

    console.log('Sending to Gemini with model:', model);

    const response = await geminiModel.generateContent([
      transcriptionModel.prompt,
      {
        inlineData: {
          mimeType,
          data: base64Audio,
        },
      },
    ]);

    const result = response.response.text();

    console.log('Gemini response:', result);

    return NextResponse.json({ 
      content: result,
      model: model,
    });
  } catch (error) {
    const details = getErrorDetails(error);
    const maybeStatus = typeof Reflect.get(error as object, 'status') === 'number'
      ? Number(Reflect.get(error as object, 'status'))
      : 500;

    console.error('Error processing audio:', error);
    return NextResponse.json(
      { error: 'Failed to process audio', details },
      { status: maybeStatus >= 400 && maybeStatus < 600 ? maybeStatus : 500 }
    );
  }
}
