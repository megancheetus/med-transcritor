import { NextRequest, NextResponse } from 'next/server';
import { rateLimitMiddleware, getClientIp } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';
import { authenticatePatientByCpf } from '@/lib/patientPortalAuth';
import { createPatientAuthToken } from '@/lib/patientSession';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  try {
    const rateLimitResponse = await rateLimitMiddleware(request, 'patient:login', {
      windowMs: 15 * 60 * 1000,
      maxRequests: 5,
      message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { cpf, senha } = await request.json();

    if (!cpf || !senha) {
      return NextResponse.json({ error: 'CPF e senha são obrigatórios.' }, { status: 400 });
    }

    const patient = await authenticatePatientByCpf(cpf, senha);
    const tokenValue = await createPatientAuthToken(patient.id);

    const response = NextResponse.json(
      {
        message: 'Login realizado com sucesso.',
        patient: {
          id: patient.id,
          nomeCompleto: patient.nomeCompleto,
          cpf: patient.cpf,
        },
      },
      { status: 200 }
    );

    response.cookies.set('patient_auth_token', tokenValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 86400,
      path: '/',
    });

    logger.info('Patient login successful', { patientId: patient.id, ip }, request);
    return response;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'FIRST_ACCESS_REQUIRED') {
        return NextResponse.json(
          { error: 'Primeiro acesso não concluído. Crie sua senha para continuar.' },
          { status: 403 }
        );
      }

      if (error.message === 'CPF_AMBIGUOUS') {
        return NextResponse.json(
          { error: 'Este CPF está vinculado a mais de um cadastro. Entre em contato com a clínica.' },
          { status: 409 }
        );
      }

      if (error.message === 'INVALID_CREDENTIALS') {
        return NextResponse.json({ error: 'CPF ou senha inválidos.' }, { status: 401 });
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'Desconhecido';
    logger.error('Patient login error', { error: errorMessage, ip }, request);
    return NextResponse.json({ error: 'Erro ao processar login do paciente.' }, { status: 500 });
  }
}
