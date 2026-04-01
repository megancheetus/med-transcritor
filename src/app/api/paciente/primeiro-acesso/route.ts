import { NextRequest, NextResponse } from 'next/server';
import { rateLimitMiddleware } from '@/lib/rateLimit';
import { setPatientFirstAccessPassword } from '@/lib/patientPortalAuth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, 'patient:first-access', {
      windowMs: 15 * 60 * 1000,
      maxRequests: 10,
      message: 'Muitas tentativas. Tente novamente em 15 minutos.',
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { cpf, senha } = await request.json();

    if (!cpf || !senha) {
      return NextResponse.json({ error: 'CPF e senha são obrigatórios.' }, { status: 400 });
    }

    await setPatientFirstAccessPassword(cpf, senha);

    return NextResponse.json(
      { message: 'Senha criada com sucesso. Agora você já pode fazer login.' },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'INVALID_CPF') {
        return NextResponse.json({ error: 'CPF inválido.' }, { status: 400 });
      }

      if (error.message === 'WEAK_PASSWORD') {
        return NextResponse.json({ error: 'A senha deve ter pelo menos 8 caracteres.' }, { status: 400 });
      }

      if (error.message === 'PATIENT_NOT_FOUND') {
        return NextResponse.json({ error: 'CPF não encontrado em nossa base.' }, { status: 404 });
      }

      if (error.message === 'PASSWORD_ALREADY_SET') {
        return NextResponse.json({ error: 'Senha já cadastrada. Use a tela de login.' }, { status: 409 });
      }

      if (error.message === 'CPF_AMBIGUOUS') {
        return NextResponse.json(
          { error: 'Este CPF está vinculado a mais de um cadastro. Entre em contato com a clínica.' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json({ error: 'Erro ao processar primeiro acesso.' }, { status: 500 });
  }
}
