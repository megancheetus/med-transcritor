import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserFromRequest } from '@/lib/authSession';
import {
  createMedicalRecord,
  initializeMedicalRecordsTable,
  logMedicalRecordAudit,
} from '@/lib/medicalRecordManager';
import { getPatientById, initializePatientsTable } from '@/lib/patientManager';
import { MedicalRecord } from '@/lib/types';
import { getRequestAuditContext } from '@/lib/requestAudit';
import { rateLimitMiddleware } from '@/lib/rateLimit';
import { parseWithSchema } from '@/lib/schemas/apiValidation';
import { medicalRecordFromTranscriptionSchema } from '@/lib/schemas/medicalRecords';
import { resolveEmailAppBaseUrl, sendPatientProfileUpdatedEmail } from '@/lib/emailService';

export const runtime = 'nodejs';

interface FromTranscriptionPayload {
  patientId?: unknown;
  data?: unknown;
  tipoDocumento?: unknown;
  profissional?: unknown;
  especialidade?: unknown;
  resumo?: unknown;
  conteudo?: unknown;
  sourceRefId?: unknown;
  clinicianReviewed?: unknown;
  notifyPatientByEmail?: unknown;
}

function normalizeDate(input?: string): string {
  if (!input) {
    return new Date().toISOString().split('T')[0];
  }

  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().split('T')[0];
  }

  return parsed.toISOString().split('T')[0];
}

function isDocumentType(value: string): value is MedicalRecord['tipoDocumento'] {
  return ['Consulta', 'Exame', 'Procedimento', 'Prescrição', 'Internação'].includes(value);
}

function parsePayload(payload: FromTranscriptionPayload) {
  const patientId = typeof payload.patientId === 'string' ? payload.patientId.trim() : '';
  const data = normalizeDate(typeof payload.data === 'string' ? payload.data : undefined);
  const tipoDocumentoInput = typeof payload.tipoDocumento === 'string' ? payload.tipoDocumento.trim() : 'Consulta';
  const profissional = typeof payload.profissional === 'string' ? payload.profissional.trim() : '';
  const especialidade = typeof payload.especialidade === 'string' ? payload.especialidade.trim() : 'Clínica Geral';
  const resumo = typeof payload.resumo === 'string' ? payload.resumo.trim() : '';
  const conteudo = typeof payload.conteudo === 'string' ? payload.conteudo.trim() : '';
  const sourceRefId = typeof payload.sourceRefId === 'string' ? payload.sourceRefId.trim() : '';
  const clinicianReviewed = payload.clinicianReviewed === false ? false : true;
  const notifyPatientByEmail = payload.notifyPatientByEmail === false ? false : true;

  if (!patientId) {
    return { error: 'Selecione um paciente válido.' };
  }

  if (!conteudo) {
    return { error: 'Conteúdo clínico é obrigatório para criar o prontuário.' };
  }

  if (!profissional) {
    return { error: 'Informe o profissional responsável pela revisão.' };
  }

  if (!isDocumentType(tipoDocumentoInput)) {
    return { error: 'Tipo de documento inválido.' };
  }

  return {
    value: {
      patientId,
      data,
      tipoDocumento: tipoDocumentoInput,
      profissional,
      especialidade: especialidade || 'Clínica Geral',
      resumo: resumo || undefined,
      conteudo,
      sourceRefId: sourceRefId || undefined,
      clinicianReviewed,
      notifyPatientByEmail,
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, 'medical-records:from-transcription', {
      windowMs: 60_000,
      maxRequests: 40,
      message: 'Muitas criações de prontuário por transcrição. Tente novamente em instantes.',
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

    const payloadValidation = parseWithSchema(
      medicalRecordFromTranscriptionSchema,
      await request.json()
    );

    if (!payloadValidation.success) {
      return payloadValidation.response;
    }

    const rawPayload = payloadValidation.data as FromTranscriptionPayload;
    const parsed = parsePayload(rawPayload);

    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const payload = parsed.value;

    await initializePatientsTable();
    await initializeMedicalRecordsTable();

    const patient = await getPatientById(payload.patientId, user.username);

    if (!patient) {
      return NextResponse.json(
        { error: 'Paciente não encontrado ou sem permissão de acesso.' },
        { status: 404 }
      );
    }

    const reviewedAt = payload.clinicianReviewed ? new Date().toISOString() : undefined;

    const record = await createMedicalRecord(payload.patientId, user.username, {
      patientId: payload.patientId,
      data: payload.data,
      tipoDocumento: payload.tipoDocumento,
      profissional: payload.profissional,
      especialidade: payload.especialidade,
      resumo: payload.resumo,
      conteudo: payload.conteudo,
      sourceType: 'transcription',
      sourceRefId: payload.sourceRefId,
      aiGenerated: true,
      clinicianReviewed: payload.clinicianReviewed,
      reviewedAt,
    });

    if (payload.notifyPatientByEmail && patient.email) {
      const appBaseUrl = resolveEmailAppBaseUrl();
      const loginUrl = `${appBaseUrl}/paciente/login`;
      const dashboardUrl = `${appBaseUrl}/paciente/dashboard`;

      try {
        await sendPatientProfileUpdatedEmail({
          to: patient.email,
          patientName: patient.nomeCompleto,
          professionalName: user.fullName || user.username,
          loginUrl,
          dashboardUrl,
          recordDate: payload.data,
          recordType: payload.tipoDocumento,
          summary: payload.resumo,
        });
      } catch (emailError) {
        console.error('[medical-records/from-transcription] profile update email error:', emailError);
      }
    }

    const auditContext = getRequestAuditContext(request);
    await logMedicalRecordAudit({
      username: user.username,
      action: 'create',
      resourceType: 'medical_record',
      resourceId: record.id,
      metadataJson: {
        patientId: payload.patientId,
        sourceType: 'transcription',
        sourceRefId: payload.sourceRefId || null,
      },
      ipHash: auditContext.ipHash,
      userAgent: auditContext.userAgent,
    });

    return NextResponse.json(
      {
        record,
        message: 'Registro criado com sucesso a partir da transcrição.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[medical-records/from-transcription] POST error:', error);
    return NextResponse.json(
      { error: 'Erro ao criar registro a partir da transcrição.' },
      { status: 500 }
    );
  }
}
