import { NextRequest, NextResponse } from 'next/server';
import { getUsernameFromAuthToken } from '@/lib/auth';
import {
  getPatientsByUsername,
  createPatient,
  initializePatientsTable,
} from '@/lib/patientManager';
import { Patient } from '@/lib/types';

export const runtime = 'nodejs';

function isValidPatientData(data: unknown): data is Omit<Patient, 'id'> {
  if (typeof data !== 'object' || data === null) return false;

  const p = data as Record<string, unknown>;

  return (
    typeof p.nome === 'string' &&
    p.nome.trim().length > 0 &&
    typeof p.nomeCompleto === 'string' &&
    p.nomeCompleto.trim().length > 0 &&
    typeof p.idade === 'number' &&
    p.idade >= 0 &&
    p.idade <= 150 &&
    ['M', 'F', 'Outro'].includes(String(p.sexo)) &&
    typeof p.cpf === 'string' &&
    p.cpf.trim().length > 0 &&
    typeof p.dataNascimento === 'string' &&
    p.dataNascimento.trim().length > 0
  );
}

/**
 * GET /api/patients
 * Obtém todos os pacientes do usuário logado
 */
export async function GET(request: NextRequest) {
  try {
    const authToken = request.cookies.get('auth_token')?.value;
    const username = await getUsernameFromAuthToken(authToken);

    if (!username) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Inicializar tabela se necessário
    await initializePatientsTable();

    const patients = await getPatientsByUsername(username);

    return NextResponse.json({
      patients,
      count: patients.length,
    });
  } catch (error) {
    console.error('[patients] GET error:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar pacientes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/patients
 * Cria um novo paciente para o usuário logado
 */
export async function POST(request: NextRequest) {
  try {
    const authToken = request.cookies.get('auth_token')?.value;
    const username = await getUsernameFromAuthToken(authToken);

    if (!username) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Inicializar tabela se necessário
    await initializePatientsTable();

    const payload = await request.json();

    if (!isValidPatientData(payload)) {
      return NextResponse.json(
        { error: 'Dados de paciente inválidos' },
        { status: 400 }
      );
    }

    const patient = await createPatient(username, payload);

    return NextResponse.json(patient, { status: 201 });
  } catch (error) {
    console.error('[patients] POST error:', error);

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
      { error: 'Erro ao criar paciente' },
      { status: 500 }
    );
  }
}
