import { NextRequest, NextResponse } from 'next/server';
import { getUsernameFromAuthToken } from '@/lib/auth';
import {
  getPatientsByUsername,
  createPatient,
  initializePatientsTable,
} from '@/lib/patientManager';
import { rateLimitMiddleware } from '@/lib/rateLimit';
import { patientCreateSchema } from '@/lib/schemas/patients';
import { parseWithSchema } from '@/lib/schemas/apiValidation';

export const runtime = 'nodejs';

/**
 * GET /api/patients
 * Obtém todos os pacientes do usuário logado
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, 'patients:get', {
      windowMs: 60_000,
      maxRequests: 120,
      message: 'Muitas consultas de pacientes em pouco tempo. Tente novamente em instantes.',
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
    const rateLimitResponse = await rateLimitMiddleware(request, 'patients:post', {
      windowMs: 60_000,
      maxRequests: 60,
      message: 'Muitas criações de pacientes em pouco tempo. Tente novamente em instantes.',
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
    await initializePatientsTable();

    const payloadValidation = parseWithSchema(patientCreateSchema, await request.json());

    if (!payloadValidation.success) {
      return payloadValidation.response;
    }

    const payload = payloadValidation.data;

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
