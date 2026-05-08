import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getAuthenticatedUserFromRequest } from '@/lib/authSession';
import { rateLimitMiddleware } from '@/lib/rateLimit';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const INLINE_FALLBACK_MAX_BYTES = 1024 * 1024;

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'anexo';
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, 'patients:portal-messages:upload:post', {
      windowMs: 60_000,
      maxRequests: 40,
      message: 'Muitos uploads em pouco tempo. Tente novamente em instantes.',
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const user = await getAuthenticatedUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!user.isAdmin && !user.moduleAccess.prontuario) {
      return NextResponse.json({ error: 'Seu plano não possui acesso ao módulo de prontuário' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Arquivo não enviado.' }, { status: 400 });
    }

    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Arquivo deve ter no máximo 10MB.' }, { status: 400 });
    }

    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de arquivo não permitido. Use PDF, TXT, MD ou DOC/DOCX.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Fallback para ambientes sem Vercel Blob (ex.: dev local).
    // Mantemos limite menor para evitar payloads muito grandes em data URL.
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      if (file.size > INLINE_FALLBACK_MAX_BYTES) {
        return NextResponse.json(
          {
            error:
              'Anexo maior que 1MB sem storage configurado. Configure BLOB_READ_WRITE_TOKEN para anexos maiores.',
          },
          { status: 503 }
        );
      }

      const dataUrl = `data:${file.type};base64,${fileBuffer.toString('base64')}`;

      return NextResponse.json({
        attachment: {
          url: dataUrl,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        },
      });
    }

    const extension = file.name.includes('.') ? file.name.split('.').pop() : undefined;
    const safeName = sanitizeFileName(file.name);
    const blobPath = `patient-messages/${user.username}/${Date.now()}-${randomUUID()}${extension ? `.${extension}` : ''}-${safeName}`;

    const blob = await put(blobPath, fileBuffer, {
      access: 'private',
      contentType: file.type,
      addRandomSuffix: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({
      attachment: {
        url: blob.url,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      },
    });
  } catch (error) {
    console.error('[patients/portal-messages/upload] POST error:', error);
    const details =
      error instanceof Error ? error.message : typeof error === 'string' ? error : 'erro desconhecido';
    return NextResponse.json({ error: `Erro ao fazer upload do anexo (${details}).` }, { status: 500 });
  }
}
