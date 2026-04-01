import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAuthenticatedUserFromRequest } from '@/lib/authSession';
import { listProfessionalSentPortalMessages } from '@/lib/patientPortalMessageManager';
import { rateLimitMiddleware } from '@/lib/rateLimit';
import { parseWithSchema } from '@/lib/schemas/apiValidation';

export const runtime = 'nodejs';

const professionalMessagesQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  patientId: z.string().uuid().optional(),
  readStatus: z.enum(['all', 'read', 'unread']).optional(),
  limit: z.coerce.number().int().min(1).max(300).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, 'patients:portal-messages:get', {
      windowMs: 60_000,
      maxRequests: 120,
      message: 'Muitas consultas de mensagens em pouco tempo. Tente novamente em instantes.',
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

    const queryValidation = parseWithSchema(professionalMessagesQuerySchema, {
      search: request.nextUrl.searchParams.get('search') || undefined,
      patientId: request.nextUrl.searchParams.get('patientId') || undefined,
      readStatus: request.nextUrl.searchParams.get('readStatus') || undefined,
      limit: request.nextUrl.searchParams.get('limit') || undefined,
    });

    if (!queryValidation.success) {
      return queryValidation.response;
    }

    const result = await listProfessionalSentPortalMessages(user.username, queryValidation.data);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[patients/portal-messages] GET error:', error);
    return NextResponse.json({ error: 'Erro ao buscar histórico de mensagens.' }, { status: 500 });
  }
}
