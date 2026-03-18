import { NextRequest, NextResponse } from 'next/server';
import { getUsernameFromAuthToken } from '@/lib/auth';
import {
  getMedicalRecordsByPatient,
  createMedicalRecord,
  initializeMedicalRecordsTable,
  logMedicalRecordAudit,
} from '@/lib/medicalRecordManager';
import { getRequestAuditContext } from '@/lib/requestAudit';
import { rateLimitMiddleware } from '@/lib/rateLimit';
import {
  medicalRecordCreateSchema,
  patientIdQuerySchema,
} from '@/lib/schemas/medicalRecords';
import { parseWithSchema } from '@/lib/schemas/apiValidation';

export const runtime = 'nodejs';

/**
 * GET /api/medical-records?patientId=...
 * Obtém todos os registros médicos de um paciente
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

    const authToken = request.cookies.get('auth_token')?.value;
    const username = await getUsernameFromAuthToken(authToken);

    if (!username) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const queryValidation = parseWithSchema(patientIdQuerySchema, {
      patientId: request.nextUrl.searchParams.get('patientId'),
    });

    if (!queryValidation.success) {
      return queryValidation.response;
    }

    const { patientId } = queryValidation.data;

    // Inicializar tabela se necessário
    await initializeMedicalRecordsTable();

    const records = await getMedicalRecordsByPatient(patientId, username);

    const auditContext = getRequestAuditContext(request);
    await logMedicalRecordAudit({
      username,
      action: 'view',
      resourceType: 'medical_record_list',
      resourceId: patientId,
      metadataJson: { count: records.length, patientId },
      ipHash: auditContext.ipHash,
      userAgent: auditContext.userAgent,
    });

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
    const rateLimitResponse = await rateLimitMiddleware(request, 'medical-records:post', {
      windowMs: 60_000,
      maxRequests: 60,
      message: 'Muitas criações de prontuário em pouco tempo. Tente novamente em instantes.',
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const authToken = request.cookies.get('auth_token')?.value;
    const username = await getUsernameFromAuthToken(authToken);

    if (!username) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
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
      username,
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
      }
    );

    const auditContext = getRequestAuditContext(request);
    await logMedicalRecordAudit({
      username,
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

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error('[medical-records] POST error:', error);
    return NextResponse.json(
      { error: 'Erro ao criar registro médico' },
      { status: 500 }
    );
  }
}
