import { NextRequest, NextResponse } from 'next/server';
import { getUsernameFromAuthToken } from '@/lib/auth';
import {
  getPatientById,
  updatePatient,
  deletePatient,
} from '@/lib/patientManager';
import { Patient } from '@/lib/types';

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
    const authToken = request.cookies.get('auth_token')?.value;
    const username = await getUsernameFromAuthToken(authToken);

    if (!username) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    const patient = await getPatientById(id, username);

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
    const authToken = request.cookies.get('auth_token')?.value;
    const username = await getUsernameFromAuthToken(authToken);

    if (!username) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const payload = await request.json();

    const patient = await updatePatient(id, username, payload);

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
    const authToken = request.cookies.get('auth_token')?.value;
    const username = await getUsernameFromAuthToken(authToken);

    if (!username) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id } = await params;

    const success = await deletePatient(id, username);

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
