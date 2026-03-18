import { NextRequest, NextResponse } from 'next/server';
import { getUsernameFromAuthToken } from '@/lib/auth';
import {
  getMedicalRecordById,
  updateMedicalRecord,
  deleteMedicalRecord,
  logMedicalRecordAudit,
} from '@/lib/medicalRecordManager';
import { getRequestAuditContext } from '@/lib/requestAudit';

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
    const authToken = request.cookies.get('auth_token')?.value;
    const username = await getUsernameFromAuthToken(authToken);

    if (!username) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

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
    const authToken = request.cookies.get('auth_token')?.value;
    const username = await getUsernameFromAuthToken(authToken);

    if (!username) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const payload = (await request.json()) as Record<string, unknown>;

    const changeReason =
      typeof payload.changeReason === 'string' && payload.changeReason.trim().length > 0
        ? payload.changeReason.trim()
        : undefined;

    if ('changeReason' in payload) {
      delete payload.changeReason;
    }

    const record = await updateMedicalRecord(id, username, payload, changeReason);

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
    const authToken = request.cookies.get('auth_token')?.value;
    const username = await getUsernameFromAuthToken(authToken);

    if (!username) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    let changeReason: string | undefined;
    const bodyText = await request.text();

    if (bodyText.trim()) {
      try {
        const body = JSON.parse(bodyText) as { changeReason?: unknown };
        if (typeof body.changeReason === 'string' && body.changeReason.trim().length > 0) {
          changeReason = body.changeReason.trim();
        }
      } catch {
        return NextResponse.json(
          { error: 'Payload inválido para exclusão de registro médico' },
          { status: 400 }
        );
      }
    }

    const success = await deleteMedicalRecord(
      id,
      username,
      changeReason || 'Exclusão de registro médico via API'
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
        changeReason: changeReason || null,
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
