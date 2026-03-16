import { NextRequest, NextResponse } from 'next/server';
import { getUsernameFromAuthToken } from '@/lib/auth';
import {
  getMedicalRecordById,
  updateMedicalRecord,
  deleteMedicalRecord,
} from '@/lib/medicalRecordManager';

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
    const payload = await request.json();

    const record = await updateMedicalRecord(id, username, payload);

    if (!record) {
      return NextResponse.json(
        { error: 'Registro médico não encontrado' },
        { status: 404 }
      );
    }

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

    const success = await deleteMedicalRecord(id, username);

    if (!success) {
      return NextResponse.json(
        { error: 'Registro médico não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ message: 'Registro médico deletado com sucesso' });
  } catch (error) {
    console.error('[medical-records] DELETE/:id error:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar registro médico' },
      { status: 500 }
    );
  }
}
