import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserFromRequest } from '@/lib/authSession';
import { rateLimitMiddleware } from '@/lib/rateLimit';
import { listPatientPortalAccountsByProfessional } from '@/lib/patientPortalAuth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, 'patients:portal-accounts:get', {
      windowMs: 60_000,
      maxRequests: 120,
      message: 'Muitas consultas em pouco tempo. Tente novamente em instantes.',
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

    const result = await listPatientPortalAccountsByProfessional(user.username);

    return NextResponse.json({
      accounts: result.accounts,
      summary: result.summary,
    });
  } catch (error) {
    console.error('[patients/portal-accounts] GET error:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar contas do portal de pacientes.' },
      { status: 500 }
    );
  }
}
