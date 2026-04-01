import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserFromRequest } from '@/lib/authSession';
import { getPatientById } from '@/lib/patientManager';
import { sendPatientPortalWelcomeEmail } from '@/lib/emailService';
import { rateLimitMiddleware } from '@/lib/rateLimit';
import { routeIdSchema } from '@/lib/schemas/patients';
import { parseWithSchema } from '@/lib/schemas/apiValidation';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

type EmailNotificationResult = {
  status: 'sent' | 'skipped-no-email' | 'failed';
  message: string;
};

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, 'patients:id:send-welcome-email', {
      windowMs: 60_000,
      maxRequests: 30,
      message: 'Muitas tentativas de envio de e-mail em pouco tempo. Tente novamente em instantes.',
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

    const idValidation = parseWithSchema(routeIdSchema, await params);
    if (!idValidation.success) {
      return idValidation.response;
    }

    const { id } = idValidation.data;
    const patient = await getPatientById(id, user.username);

    if (!patient) {
      return NextResponse.json({ error: 'Paciente não encontrado' }, { status: 404 });
    }

    let emailNotification: EmailNotificationResult;

    if (!patient.email) {
      emailNotification = {
        status: 'skipped-no-email',
        message: 'Paciente sem e-mail cadastrado. Nenhum e-mail foi enviado.',
      };
    } else {
      const appBaseUrl = process.env.APP_URL || request.nextUrl.origin;
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
        console.error('[patients/:id/send-portal-welcome-email] email error:', emailError);
        emailNotification = {
          status: 'failed',
          message: 'Falha ao enviar o e-mail de boas-vindas.',
        };
      }
    }

    return NextResponse.json({ emailNotification });
  } catch (error) {
    console.error('[patients/:id/send-portal-welcome-email] POST error:', error);
    return NextResponse.json(
      { error: 'Erro ao enviar e-mail de boas-vindas para o paciente.' },
      { status: 500 }
    );
  }
}
