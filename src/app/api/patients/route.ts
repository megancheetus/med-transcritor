import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserFromRequest } from '@/lib/authSession';
import {
  getPatientsPageByUsername,
  createPatient,
  initializePatientsTable,
} from '@/lib/patientManager';
import { resolveEmailAppBaseUrl, sendPatientPortalWelcomeEmail } from '@/lib/emailService';
import { rateLimitMiddleware } from '@/lib/rateLimit';
import { patientCreateSchema, patientListQuerySchema } from '@/lib/schemas/patients';
import { parseWithSchema } from '@/lib/schemas/apiValidation';

export const runtime = 'nodejs';

type EmailNotificationResult = {
  status: 'sent' | 'skipped-no-email' | 'disabled' | 'failed';
  message: string;
};

/**
 * GET /api/patients
 * Obtém pacientes paginados do usuário logado
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, 'patients:get', {
      windowMs: 60_000,
      maxRequests: 120,
      message: 'Muitas consultas de pacientes em pouco tempo. Tente novamente em instantes.',
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

    // Inicializar tabela se necessário
    await initializePatientsTable();

    const queryValidation = parseWithSchema(patientListQuerySchema, {
      cursor: request.nextUrl.searchParams.get('cursor') || undefined,
      limit: request.nextUrl.searchParams.get('limit') || undefined,
      search: request.nextUrl.searchParams.get('search') || undefined,
    });

    if (!queryValidation.success) {
      return queryValidation.response;
    }

    const result = await getPatientsPageByUsername(user.username, queryValidation.data);

    return NextResponse.json({
      patients: result.patients,
      count: result.patients.length,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    });
  } catch (error) {
    console.error('[patients] GET error:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar pacientes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/patients
 * Cria um novo paciente para o usuário logado
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, 'patients:post', {
      windowMs: 60_000,
      maxRequests: 60,
      message: 'Muitas criações de pacientes em pouco tempo. Tente novamente em instantes.',
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

    // Inicializar tabela se necessário
    await initializePatientsTable();

    const payloadValidation = parseWithSchema(patientCreateSchema, await request.json());

    if (!payloadValidation.success) {
      return payloadValidation.response;
    }

    const payload = payloadValidation.data;
    const { notifyPatientByEmail, ...patientPayload } = payload;

    const patient = await createPatient(user.username, patientPayload);
    let emailNotification: EmailNotificationResult;

    if (!notifyPatientByEmail) {
      emailNotification = {
        status: 'disabled',
        message: 'Envio de e-mail desativado pelo profissional.',
      };
    } else if (!patient.email) {
      emailNotification = {
        status: 'skipped-no-email',
        message: 'Paciente sem e-mail cadastrado. Nenhum e-mail foi enviado.',
      };
    } else {
      const appBaseUrl = resolveEmailAppBaseUrl();
      const firstAccessUrl = `${appBaseUrl}/paciente/primeiro-acesso`;
      const loginUrl = `${appBaseUrl}/paciente/login`;

      try {
        await sendPatientPortalWelcomeEmail({
          to: patient.email,
          patientName: patient.nomeCompleto,
          professionalName: user.fullName || user.username,
          firstAccessUrl,
          loginUrl,
        });
        emailNotification = {
          status: 'sent',
          message: 'E-mail de boas-vindas enviado com sucesso para o paciente.',
        };
      } catch (emailError) {
        console.error('[patients] welcome email error:', emailError);
        emailNotification = {
          status: 'failed',
          message: 'Paciente criado, mas houve falha ao enviar o e-mail de boas-vindas.',
        };
      }
    }

    return NextResponse.json({
      ...patient,
      emailNotification,
    }, { status: 201 });
  } catch (error) {
    console.error('[patients] POST error:', error);

    if (
      error instanceof Error &&
      error.message.includes('duplicate key')
    ) {
      return NextResponse.json(
        { error: 'CPF já cadastrado para este usuário' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Erro ao criar paciente' },
      { status: 500 }
    );
  }
}
