import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextRequest, NextResponse } from 'next/server';
import { isValidAuthToken } from '@/lib/auth';

const ALLOWED_AUDIO_TYPES = [
  'audio/webm',
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/ogg',
];

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

  return 'Erro desconhecido ao gerar upload token.';
};

export async function POST(request: NextRequest) {
  const authToken = request.cookies.get('auth_token')?.value;

  if (!(await isValidAuthToken(authToken))) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_AUDIO_TYPES,
        tokenPayload: JSON.stringify({ uploadedAt: Date.now() }),
      }),
      onUploadCompleted: async ({ blob }) => {
        console.log(`✅ Upload direto concluído: ${blob.url}`);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const details = getErrorDetails(error);
    console.error('❌ Falha ao gerar token de upload:', error);
    return NextResponse.json({ error: 'Falha ao iniciar upload', details }, { status: 500 });
  }
}