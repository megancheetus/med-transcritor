import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserFromRequest } from '@/lib/authSession';
import {
  getPatientById,
  updatePatient,
  deletePatient,
} from '@/lib/patientManager';
import { rateLimitMiddleware } from '@/lib/rateLimit';
import { patientPatchSchema, routeIdSchema } from '@/lib/schemas/patients';
import { parseWithSchema } from '@/lib/schemas/apiValidation';

export const runtime = 'nodejs';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/patients/[id]
 * Obtém um paciente específico
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, 'patients:id:get', {
      windowMs: 60_000,
      maxRequests: 120,
      message: 'Muitas consultas de pacientes em pouco tempo. Tente novamente em instantes.',
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
      return NextResponse.json(
        { error: 'Paciente não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(patient);
  } catch (error) {
    console.error('[patients] GET/:id error:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar paciente' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/patients/[id]
 * Atualiza um paciente específico
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, 'patients:id:patch', {
      windowMs: 60_000,
      maxRequests: 60,
      message: 'Muitas atualizações de pacientes em pouco tempo. Tente novamente em instantes.',
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

    const payloadValidation = parseWithSchema(patientPatchSchema, await request.json());
    if (!payloadValidation.success) {
      return payloadValidation.response;
    }

    const payload = payloadValidation.data;

    const patient = await updatePatient(id, user.username, payload);

    if (!patient) {
      return NextResponse.json(
        { error: 'Paciente não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(patient);
  } catch (error) {
    console.error('[patients] PATCH/:id error:', error);

    if (
      error instanceof Error &&
      error.message.includes('duplicate key')
    ) {
      return NextResponse.json(
        { error: 'CPF já cadastrado para este usuário' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Erro ao atualizar paciente' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/patients/[id]
 * Deleta um paciente específico
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, 'patients:id:delete', {
      windowMs: 60_000,
      maxRequests: 20,
      message: 'Muitas exclusões de pacientes em pouco tempo. Tente novamente em instantes.',
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

    const success = await deletePatient(id, user.username);

    if (!success) {
      return NextResponse.json(
        { error: 'Paciente não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Paciente deletado com sucesso' });
  } catch (error) {
    console.error('[patients] DELETE/:id error:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar paciente' },
      { status: 500 }
    );
  }
}
