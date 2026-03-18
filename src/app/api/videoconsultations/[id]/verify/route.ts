import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';
import { rateLimitMiddleware } from '@/lib/rateLimit';

export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

function normalizeCpf(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * POST /api/videoconsultations/:id/verify
 * Valida CPF do paciente antes de liberar acesso à sala.
 * Body: { token: string; cpf: string }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  // Rate limit: 10 tentativas por IP / 15 minutos
  const limited = await rateLimitMiddleware(request, 'verify-cpf', {
    windowMs: 15 * 60 * 1000,
    maxRequests: 10,
    message: 'Muitas tentativas de verificação. Aguarde alguns minutos.',
  });
  if (limited) return limited;

  try {
    const { id } = await context.params;
    const body = await request.json() as { token?: unknown; cpf?: unknown };

    if (typeof body.token !== 'string' || !body.token.trim()) {
      return NextResponse.json({ error: 'Token inválido.' }, { status: 400 });
    }
    if (typeof body.cpf !== 'string' || !body.cpf.trim()) {
      return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 });
    }

    const inputCpf = normalizeCpf(body.cpf);
    if (inputCpf.length !== 11) {
      return NextResponse.json({ error: 'CPF deve ter 11 dígitos.' }, { status: 400 });
    }

    const pool = getPostgresPool();

    // Busca o CPF do paciente vinculado à sala, validando também o token público
    const result = await pool.query<{ cpf: string }>(
      `SELECT p.cpf
       FROM videoconsulta_rooms vcr
       JOIN patients p ON p.id = vcr.patient_id
       WHERE vcr.id = $1 AND vcr.room_token = $2
         AND vcr.status NOT IN ('ended', 'expired')`,
      [id, body.token]
    );

    if (result.rows.length === 0) {
      // Não diferenciamos "sala não encontrada" de "token errado" para evitar enumeration
      return NextResponse.json({ valid: false }, { status: 200 });
    }

    const storedCpf = normalizeCpf(result.rows[0].cpf);
    const valid = storedCpf === inputCpf;

    return NextResponse.json({ valid });
  } catch (error) {
    console.error('[verify-cpf] erro:', error);
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 });
  }
}
