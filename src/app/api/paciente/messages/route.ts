import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimitMiddleware } from '@/lib/rateLimit';
import { getAuthenticatedPatientFromRequest } from '@/lib/patientSession';
import { listPatientPortalMessages } from '@/lib/patientPortalMessageManager';
import { parseWithSchema } from '@/lib/schemas/apiValidation';

export const runtime = 'nodejs';

const patientMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, 'patient:messages:get', {
      windowMs: 60_000,
      maxRequests: 120,
      message: 'Muitas consultas de mensagens em pouco tempo. Tente novamente em instantes.',
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const patient = await getAuthenticatedPatientFromRequest(request);

    if (!patient) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const queryValidation = parseWithSchema(patientMessagesQuerySchema, {
      limit: request.nextUrl.searchParams.get('limit') || undefined,
    });

    if (!queryValidation.success) {
      return queryValidation.response;
    }

    const result = await listPatientPortalMessages(patient.id, queryValidation.data.limit ?? 50);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[paciente/messages] GET error:', error);
    return NextResponse.json({ error: 'Erro ao buscar mensagens do paciente.' }, { status: 500 });
  }
}
