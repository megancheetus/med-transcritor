import { NextRequest, NextResponse } from 'next/server';
import { getUsernameFromAuthToken } from '@/lib/auth';
import {
  getMedicalRecordById,
  updateMedicalRecord,
  deleteMedicalRecord,
  logMedicalRecordAudit,
} from '@/lib/medicalRecordManager';
import { getRequestAuditContext } from '@/lib/requestAudit';
import { rateLimitMiddleware } from '@/lib/rateLimit';
import {
  medicalRecordDeleteSchema,
  medicalRecordPatchSchema,
  routeIdSchema,
} from '@/lib/schemas/medicalRecords';
import { parseWithSchema } from '@/lib/schemas/apiValidation';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/medical-records/[id]
 * Obtém um registro médico específico
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, 'medical-records:id:get', {
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

    const idValidation = parseWithSchema(routeIdSchema, await params);
    if (!idValidation.success) {
      return idValidation.response;
    }

    const { id } = idValidation.data;

    const record = await getMedicalRecordById(id, username);

    if (!record) {
      return NextResponse.json(
        { error: 'Registro médico não encontrado' },
        { status: 404 }
      );
    }

    const auditContext = getRequestAuditContext(request);
    await logMedicalRecordAudit({
      username,
      action: 'view',
      resourceType: 'medical_record',
      resourceId: id,
      metadataJson: { patientId: record.patientId },
      ipHash: auditContext.ipHash,
      userAgent: auditContext.userAgent,
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error('[medical-records] GET/:id error:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar registro médico' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/medical-records/[id]
 * Atualiza um registro médico específico
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, 'medical-records:id:patch', {
      windowMs: 60_000,
      maxRequests: 60,
      message: 'Muitas edições de prontuário em pouco tempo. Tente novamente em instantes.',
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const authToken = request.cookies.get('auth_token')?.value;
    const username = await getUsernameFromAuthToken(authToken);

    if (!username) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const idValidation = parseWithSchema(routeIdSchema, await params);
    if (!idValidation.success) {
      return idValidation.response;
    }

    const { id } = idValidation.data;
    const payloadValidation = parseWithSchema(medicalRecordPatchSchema, await request.json());
    if (!payloadValidation.success) {
      return payloadValidation.response;
    }

    const { changeReason, ...patchData } = payloadValidation.data;

    const record = await updateMedicalRecord(id, username, patchData, changeReason);

    if (!record) {
      return NextResponse.json(
        { error: 'Registro médico não encontrado' },
        { status: 404 }
      );
    }

    const auditContext = getRequestAuditContext(request);
    await logMedicalRecordAudit({
      username,
      action: 'update',
      resourceType: 'medical_record',
      resourceId: id,
      metadataJson: {
        changeReason: changeReason || null,
        patientId: record.patientId,
      },
      ipHash: auditContext.ipHash,
      userAgent: auditContext.userAgent,
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error('[medical-records] PATCH/:id error:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar registro médico' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/medical-records/[id]
 * Deleta um registro médico específico
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, 'medical-records:id:delete', {
      windowMs: 60_000,
      maxRequests: 20,
      message: 'Muitas exclusões de prontuário em pouco tempo. Tente novamente em instantes.',
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const authToken = request.cookies.get('auth_token')?.value;
    const username = await getUsernameFromAuthToken(authToken);

    if (!username) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const idValidation = parseWithSchema(routeIdSchema, await params);
    if (!idValidation.success) {
      return idValidation.response;
    }

    const { id } = idValidation.data;

    const deletePayloadValidation = parseWithSchema(
      medicalRecordDeleteSchema,
      await request.json()
    );

    if (!deletePayloadValidation.success) {
      return deletePayloadValidation.response;
    }

    const { changeReason } = deletePayloadValidation.data;

    const success = await deleteMedicalRecord(
      id,
      username,
      changeReason
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Registro médico não encontrado' },
        { status: 404 }
      );
    }

    const auditContext = getRequestAuditContext(request);
    await logMedicalRecordAudit({
      username,
      action: 'delete',
      resourceType: 'medical_record',
      resourceId: id,
      metadataJson: {
        changeReason,
      },
      ipHash: auditContext.ipHash,
      userAgent: auditContext.userAgent,
    });

    return NextResponse.json({ message: 'Registro médico deletado com sucesso' });
  } catch (error) {
    console.error('[medical-records] DELETE/:id error:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar registro médico' },
      { status: 500 }
    );
  }
}
