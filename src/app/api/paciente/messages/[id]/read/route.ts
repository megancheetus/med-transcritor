import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimitMiddleware } from '@/lib/rateLimit';
import { getAuthenticatedPatientFromRequest } from '@/lib/patientSession';
import { markPatientPortalMessageAsRead } from '@/lib/patientPortalMessageManager';
import { parseWithSchema } from '@/lib/schemas/apiValidation';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const messageIdSchema = z.object({
  id: z.string().uuid('Identificador de mensagem inválido.'),
});

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, 'patient:messages:id:read:post', {
      windowMs: 60_000,
      maxRequests: 240,
      message: 'Muitas ações em pouco tempo. Tente novamente em instantes.',
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const patient = await getAuthenticatedPatientFromRequest(request);

    if (!patient) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const idValidation = parseWithSchema(messageIdSchema, await params);
    if (!idValidation.success) {
      return idValidation.response;
    }

    const updatedMessage = await markPatientPortalMessageAsRead(patient.id, idValidation.data.id);

    if (!updatedMessage) {
      return NextResponse.json({ error: 'Mensagem não encontrada.' }, { status: 404 });
    }

    return NextResponse.json({ message: updatedMessage });
  } catch (error) {
    console.error('[paciente/messages/:id/read] POST error:', error);
    return NextResponse.json({ error: 'Erro ao marcar mensagem como lida.' }, { status: 500 });
  }
}
