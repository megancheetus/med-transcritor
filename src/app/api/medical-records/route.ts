import { NextRequest, NextResponse } from 'next/server';
import { getUsernameFromAuthToken } from '@/lib/auth';
import {
  getMedicalRecordsByPatient,
  createMedicalRecord,
  initializeMedicalRecordsTable,
} from '@/lib/medicalRecordManager';
import { MedicalRecord } from '@/lib/types';

export const runtime = 'nodejs';

function isOptionalString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'string';
}

function isOptionalStringArray(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (Array.isArray(value) && value.every((item) => typeof item === 'string'))
  );
}

function isValidMedicalRecord(data: unknown): data is Omit<MedicalRecord, 'id'> {
  if (typeof data !== 'object' || data === null) return false;

  const m = data as Record<string, unknown>;

  return (
    typeof m.patientId === 'string' &&
    m.patientId.trim().length > 0 &&
    typeof m.data === 'string' &&
    m.data.trim().length > 0 &&
    ['Consulta', 'Exame', 'Procedimento', 'Prescrição', 'Internação'].includes(
      String(m.tipoDocumento)
    ) &&
    typeof m.profissional === 'string' &&
    m.profissional.trim().length > 0 &&
    typeof m.especialidade === 'string' &&
    m.especialidade.trim().length > 0 &&
    typeof m.conteudo === 'string' &&
    m.conteudo.trim().length > 0 &&
    isOptionalString(m.resumo) &&
    isOptionalString(m.soapSubjetivo) &&
    isOptionalString(m.soapObjetivo) &&
    isOptionalString(m.soapAvaliacao) &&
    isOptionalString(m.soapPlano) &&
    isOptionalStringArray(m.cid10Codes) &&
    isOptionalStringArray(m.medications) &&
    isOptionalStringArray(m.allergies) &&
    isOptionalString(m.followUpDate)
  );
}

/**
 * GET /api/medical-records?patientId=...
 * Obtém todos os registros médicos de um paciente
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = request.cookies.get('auth_token')?.value;
    const username = await getUsernameFromAuthToken(authToken);

    if (!username) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const patientId = request.nextUrl.searchParams.get('patientId');

    if (!patientId) {
      return NextResponse.json(
        { error: 'patientId é obrigatório' },
        { status: 400 }
      );
    }

    // Inicializar tabela se necessário
    await initializeMedicalRecordsTable();

    const records = await getMedicalRecordsByPatient(patientId, username);

    return NextResponse.json({
      records,
      count: records.length,
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
    const authToken = request.cookies.get('auth_token')?.value;
    const username = await getUsernameFromAuthToken(authToken);

    if (!username) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Inicializar tabela se necessário
    await initializeMedicalRecordsTable();

    const payload = await request.json();

    if (!isValidMedicalRecord(payload)) {
      return NextResponse.json(
        { error: 'Dados de registro médico inválidos' },
        { status: 400 }
      );
    }

    const record = await createMedicalRecord(
      payload.patientId,
      username,
      {
        patientId: payload.patientId,
        data: payload.data,
        tipoDocumento: payload.tipoDocumento,
        profissional: payload.profissional,
        especialidade: payload.especialidade,
        conteudo: payload.conteudo,
        resumo: payload.resumo,
        soapSubjetivo: payload.soapSubjetivo,
        soapObjetivo: payload.soapObjetivo,
        soapAvaliacao: payload.soapAvaliacao,
        soapPlano: payload.soapPlano,
        cid10Codes: payload.cid10Codes,
        medications: payload.medications,
        allergies: payload.allergies,
        followUpDate: payload.followUpDate,
      }
    );

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error('[medical-records] POST error:', error);
    return NextResponse.json(
      { error: 'Erro ao criar registro médico' },
      { status: 500 }
    );
  }
}
