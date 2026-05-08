import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserFromRequest } from '@/lib/authSession';
import {
  getMedicalRecordVersions,
  initializeMedicalRecordsTable,
  logMedicalRecordAudit,
} from '@/lib/medicalRecordManager';
import { getRequestAuditContext } from '@/lib/requestAudit';
import { rateLimitMiddleware } from '@/lib/rateLimit';
import { parseWithSchema } from '@/lib/schemas/apiValidation';
import { routeIdSchema } from '@/lib/schemas/medicalRecords';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, 'medical-records:versions:get', {
      windowMs: 60_000,
      maxRequests: 120,
      message: 'Muitas consultas de versões em pouco tempo. Tente novamente em instantes.',
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

    await initializeMedicalRecordsTable();

    const idValidation = parseWithSchema(routeIdSchema, await params);
    if (!idValidation.success) {
      return idValidation.response;
    }

    const { id } = idValidation.data;
    const versions = await getMedicalRecordVersions(id, user.username);

    const auditContext = getRequestAuditContext(request);
    await logMedicalRecordAudit({
      username: user.username,
      action: 'view_versions',
      resourceType: 'medical_record',
      resourceId: id,
      metadataJson: { count: versions.length },
      ipHash: auditContext.ipHash,
      userAgent: auditContext.userAgent,
    });

    return NextResponse.json({
      versions,
      count: versions.length,
    });
  } catch (error) {
    console.error('[medical-records/:id/versions] GET error:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar histórico de versões do registro médico' },
      { status: 500 }
    );
  }
}
