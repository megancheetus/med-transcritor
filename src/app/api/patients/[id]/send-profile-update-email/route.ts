import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserFromRequest } from '@/lib/authSession';
import { getPatientById } from '@/lib/patientManager';
import {
  getMedicalRecordsByPatientPaginated,
  initializeMedicalRecordsTable,
} from '@/lib/medicalRecordManager';
import { sendPatientProfileUpdatedEmail } from '@/lib/emailService';
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
    const rateLimitResponse = await rateLimitMiddleware(request, 'patients:id:send-profile-update-email', {
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
      await initializeMedicalRecordsTable();
      const latestRecords = await getMedicalRecordsByPatientPaginated(user.username, {
        patientId: id,
        limit: 1,
      });

      const latestRecord = latestRecords.records[0];
      const summary = latestRecord
        ? latestRecord.cid10Codes?.join(', ') ||
          latestRecord.soapAvaliacao ||
          latestRecord.soapPlano ||
          latestRecord.resumo ||
          undefined
        : undefined;

      const appBaseUrl = process.env.APP_URL || request.nextUrl.origin;
      const loginUrl = `${appBaseUrl}/paciente/login`;
      const dashboardUrl = `${appBaseUrl}/paciente/dashboard`;

      try {
        await sendPatientProfileUpdatedEmail({
          to: patient.email,
          patientName: patient.nomeCompleto,
          professionalName: user.fullName || user.username,
          loginUrl,
          dashboardUrl,
          recordDate: latestRecord?.data,
          recordType: latestRecord?.tipoDocumento,
          summary,
        });

        emailNotification = {
          status: 'sent',
          message: 'E-mail de atualização enviado com sucesso para o paciente.',
        };
      } catch (emailError) {
        console.error('[patients/:id/send-profile-update-email] email error:', emailError);
        emailNotification = {
          status: 'failed',
          message: 'Falha ao enviar o e-mail de atualização do perfil.',
        };
      }
    }

    return NextResponse.json({ emailNotification });
  } catch (error) {
    console.error('[patients/:id/send-profile-update-email] POST error:', error);
    return NextResponse.json(
      { error: 'Erro ao enviar e-mail de atualização para o paciente.' },
      { status: 500 }
    );
  }
}
