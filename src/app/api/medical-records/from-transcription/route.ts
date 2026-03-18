import { NextRequest, NextResponse } from 'next/server';
import { getUsernameFromAuthToken } from '@/lib/auth';
import { createMedicalRecord, initializeMedicalRecordsTable } from '@/lib/medicalRecordManager';
import { getPatientById, initializePatientsTable } from '@/lib/patientManager';
import { MedicalRecord } from '@/lib/types';

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
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const authToken = request.cookies.get('auth_token')?.value;
    const username = await getUsernameFromAuthToken(authToken);

    if (!username) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const rawPayload = (await request.json()) as FromTranscriptionPayload;
    const parsed = parsePayload(rawPayload);

    if ('error' in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const payload = parsed.value;

    await initializePatientsTable();
    await initializeMedicalRecordsTable();

    const patient = await getPatientById(payload.patientId, username);

    if (!patient) {
      return NextResponse.json(
        { error: 'Paciente não encontrado ou sem permissão de acesso.' },
        { status: 404 }
      );
    }

    const reviewedAt = payload.clinicianReviewed ? new Date().toISOString() : undefined;

    const record = await createMedicalRecord(payload.patientId, username, {
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
