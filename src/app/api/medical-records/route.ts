import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserFromRequest } from '@/lib/authSession';
import {
  getMedicalRecordsByPatientPaginated,
  createMedicalRecord,
  initializeMedicalRecordsTable,
  logMedicalRecordAudit,
} from '@/lib/medicalRecordManager';
import { getPatientById, initializePatientsTable } from '@/lib/patientManager';
import { sendPatientProfileUpdatedEmail } from '@/lib/emailService';
import { getRequestAuditContext } from '@/lib/requestAudit';
import { rateLimitMiddleware } from '@/lib/rateLimit';
import {
  medicalRecordCreateSchema,
  medicalRecordListQuerySchema,
} from '@/lib/schemas/medicalRecords';
import { parseWithSchema } from '@/lib/schemas/apiValidation';
import { resolveEmailAppBaseUrl } from '@/lib/emailService';

export const runtime = 'nodejs';

type EmailNotificationResult = {
  status: 'sent' | 'skipped-no-email' | 'disabled' | 'failed';
  message: string;
};

/**
 * GET /api/medical-records?patientId=...
 * Obtém registros médicos paginados de um paciente
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, 'medical-records:get', {
      windowMs: 60_000,
      maxRequests: 120,
      message: 'Muitas consultas de prontuário em pouco tempo. Tente novamente em instantes.',
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

    const queryValidation = parseWithSchema(medicalRecordListQuerySchema, {
      patientId: request.nextUrl.searchParams.get('patientId'),
      cursor: request.nextUrl.searchParams.get('cursor') || undefined,
      limit: request.nextUrl.searchParams.get('limit') || undefined,
      tipoDocumento: request.nextUrl.searchParams.get('tipoDocumento') || undefined,
      profissional: request.nextUrl.searchParams.get('profissional') || undefined,
      dateFrom: request.nextUrl.searchParams.get('dateFrom') || undefined,
      dateTo: request.nextUrl.searchParams.get('dateTo') || undefined,
    });

    if (!queryValidation.success) {
      return queryValidation.response;
    }

    const { patientId, ...filters } = queryValidation.data;

    // Inicializar tabela se necessário
    await initializeMedicalRecordsTable();

    const result = await getMedicalRecordsByPatientPaginated(user.username, {
      patientId,
      ...filters,
    });

    const auditContext = getRequestAuditContext(request);
    await logMedicalRecordAudit({
      username: user.username,
      action: 'view',
      resourceType: 'medical_record_list',
      resourceId: patientId,
      metadataJson: {
        count: result.records.length,
        patientId,
        hasMore: result.hasMore,
        filters: {
          tipoDocumento: filters.tipoDocumento,
          profissional: filters.profissional,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
        },
      },
      ipHash: auditContext.ipHash,
      userAgent: auditContext.userAgent,
    });

    return NextResponse.json({
      records: result.records,
      count: result.records.length,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
    });
  } catch (error) {
    console.error('[medical-records] GET error:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar registros médicos' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/medical-records
 * Cria um novo registro médico
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, 'medical-records:post', {
      windowMs: 60_000,
      maxRequests: 60,
      message: 'Muitas criações de prontuário em pouco tempo. Tente novamente em instantes.',
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
    await initializeMedicalRecordsTable();

    const payload = await request.json();
    const payloadValidation = parseWithSchema(medicalRecordCreateSchema, payload);

    if (!payloadValidation.success) {
      return payloadValidation.response;
    }

    const validatedPayload = payloadValidation.data;

    const record = await createMedicalRecord(
      validatedPayload.patientId,
      user.username,
      {
        patientId: validatedPayload.patientId,
        data: validatedPayload.data,
        tipoDocumento: validatedPayload.tipoDocumento,
        profissional: validatedPayload.profissional,
        especialidade: validatedPayload.especialidade,
        conteudo: validatedPayload.conteudo,
        resumo: validatedPayload.resumo,
        soapSubjetivo: validatedPayload.soapSubjetivo,
        soapObjetivo: validatedPayload.soapObjetivo,
        soapAvaliacao: validatedPayload.soapAvaliacao,
        soapPlano: validatedPayload.soapPlano,
        cid10Codes: validatedPayload.cid10Codes,
        medications: validatedPayload.medications,
        allergies: validatedPayload.allergies,
        followUpDate: validatedPayload.followUpDate,
        bioimpedance: validatedPayload.bioimpedance,
      }
    );

    let emailNotification: EmailNotificationResult;

    if (!validatedPayload.notifyPatientByEmail) {
      emailNotification = {
        status: 'disabled',
        message: 'Envio de e-mail desativado pelo profissional.',
      };
    } else {
      await initializePatientsTable();
      const patient = await getPatientById(validatedPayload.patientId, user.username);

      if (!patient?.email) {
        emailNotification = {
          status: 'skipped-no-email',
          message: 'Paciente sem e-mail cadastrado. Nenhum e-mail foi enviado.',
        };
      } else {
        const appBaseUrl = resolveEmailAppBaseUrl();
        const loginUrl = `${appBaseUrl}/paciente/login`;
        const dashboardUrl = `${appBaseUrl}/paciente/dashboard`;
        const summary =
          validatedPayload.cid10Codes?.join(', ') ||
          validatedPayload.soapAvaliacao ||
          validatedPayload.soapPlano ||
          validatedPayload.resumo ||
          undefined;

        try {
          await sendPatientProfileUpdatedEmail({
            to: patient.email,
            patientName: patient.nomeCompleto,
            professionalName: user.fullName || user.username,
            professionalSpecialty: user.specialty,
            professionalCouncil: [user.councilNumber, user.councilState].filter(Boolean).join('/') || null,
            loginUrl,
            dashboardUrl,
            recordDate: validatedPayload.data,
            recordType: validatedPayload.tipoDocumento,
            summary,
          });
          emailNotification = {
            status: 'sent',
            message: 'E-mail de atualização enviado com sucesso para o paciente.',
          };
        } catch (emailError) {
          console.error('[medical-records] profile update email error:', emailError);
          emailNotification = {
            status: 'failed',
            message: 'Registro criado, mas houve falha ao enviar o e-mail de atualização.',
          };
        }
      }
    }

    const auditContext = getRequestAuditContext(request);
    await logMedicalRecordAudit({
      username: user.username,
      action: 'create',
      resourceType: 'medical_record',
      resourceId: record.id,
      metadataJson: {
        patientId: validatedPayload.patientId,
        sourceType: record.sourceType || 'manual',
      },
      ipHash: auditContext.ipHash,
      userAgent: auditContext.userAgent,
    });

    return NextResponse.json({
      record,
      emailNotification,
    }, { status: 201 });
  } catch (error) {
    console.error('[medical-records] POST error:', error);
    return NextResponse.json(
      { error: 'Erro ao criar registro médico' },
      { status: 500 }
    );
  }
}
