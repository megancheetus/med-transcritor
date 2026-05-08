import { get } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedPatientFromRequest } from '@/lib/patientSession';
import { getPatientPortalMessageForPatient } from '@/lib/patientPortalMessageManager';
import { parseWithSchema } from '@/lib/schemas/apiValidation';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const messageIdSchema = z.object({
  id: z.string().uuid('Identificador de mensagem inválido.'),
});

function dataUrlToResponse(
  dataUrl: string,
  fileName: string,
  fallbackMimeType?: string | null
): NextResponse {
  const match = dataUrl.match(/^data:([^;,]+)?(?:;base64)?,(.*)$/i);

  if (!match) {
    return NextResponse.json({ error: 'Anexo inline inválido.' }, { status: 400 });
  }

  const mimeType = match[1] || fallbackMimeType || 'application/octet-stream';
  const rawData = match[2] || '';
  const buffer = Buffer.from(rawData, 'base64');

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `inline; filename="${fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const patient = await getAuthenticatedPatientFromRequest(request);

    if (!patient) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const idValidation = parseWithSchema(messageIdSchema, await params);
    if (!idValidation.success) {
      return idValidation.response;
    }

    const message = await getPatientPortalMessageForPatient(patient.id, idValidation.data.id);

    if (!message) {
      return NextResponse.json({ error: 'Mensagem não encontrada.' }, { status: 404 });
    }

    if (!message.attachmentUrl) {
      return NextResponse.json({ error: 'Mensagem sem anexo.' }, { status: 404 });
    }

    const fileName = message.attachmentName || 'anexo';

    if (message.attachmentUrl.startsWith('data:')) {
      return dataUrlToResponse(message.attachmentUrl, fileName, message.attachmentMimeType);
    }

    const blobObject = await get(message.attachmentUrl, {
      access: 'private',
      useCache: false,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    if (!blobObject) {
      return NextResponse.json({ error: 'Anexo não encontrado no storage.' }, { status: 404 });
    }

    if (!('stream' in blobObject) || !blobObject.stream) {
      return NextResponse.json({ error: 'Falha ao ler anexo no storage.' }, { status: 500 });
    }

    return new NextResponse(blobObject.stream, {
      status: 200,
      headers: {
        'Content-Type': message.attachmentMimeType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    console.error('[paciente/messages/:id/attachment] GET error:', error);
    return NextResponse.json({ error: 'Erro ao carregar anexo.' }, { status: 500 });
  }
}
