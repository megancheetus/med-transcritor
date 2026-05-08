import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserFromRequest } from '@/lib/authSession';
import { createPatient, getPatientById, initializePatientsTable } from '@/lib/patientManager';
import {
  createVideoConsultaRoom,
  getVideoConsultasOfProfessional,
  getVideoConsultasOfPatient,
  initializeVideoConsultationTables,
} from '@/lib/videoConsultationManager';

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function buildSyntheticCpf(): string {
  const seed = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const digits = seed.slice(-11).padStart(11, '0');
  return digits;
}

/**
 * GET /api/videoconsultations
 * Lista todas as teleconsultas do usuário (como profissional ou paciente)
 */
export async function GET(request: NextRequest) {
  try {
    // Autenticação
    const user = await getAuthenticatedUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    if (!user.isAdmin && !user.moduleAccess.teleconsulta) {
      return NextResponse.json({ error: 'Seu plano não possui acesso ao módulo de teleconsulta' }, { status: 403 });
    }

    // Query params
    const patientId = request.nextUrl.searchParams.get('patientId');

    // Inicializar tabelas se necessário
    await initializeVideoConsultationTables();

    let consultations;

    if (patientId) {
      // Listar teleconsultas de um paciente específico
      consultations = await getVideoConsultasOfPatient(patientId, user.username);
    } else {
      // Listar teleconsultas onde o usuário é profissional
      consultations = await getVideoConsultasOfProfessional(user.username);
    }

    return NextResponse.json({
      consultations,
      count: consultations.length,
    });
  } catch (error) {
    console.error('Erro ao listar teleconsultas:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Erro ao listar teleconsultas'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/videoconsultations
 * Cria uma nova sala de videoconsulta
 */
export async function POST(request: NextRequest) {
  try {
    // Autenticação
    const user = await getAuthenticatedUserFromRequest(request);

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    if (!user.isAdmin && !user.moduleAccess.teleconsulta) {
      return NextResponse.json({ error: 'Seu plano não possui acesso ao módulo de teleconsulta' }, { status: 403 });
    }

    // Parse body
    const body = await request.json();
    const { patientId, patientName, patientCpf } = body as {
      patientId?: unknown;
      patientName?: unknown;
      patientCpf?: unknown;
    };

    // Validação
    if ((typeof patientId !== 'string' || !patientId.trim()) && (typeof patientName !== 'string' || !patientName.trim())) {
      return NextResponse.json(
        { error: 'Informe patientId ou patientName para criar a teleconsulta' },
        { status: 400 }
      );
    }

    // Inicializar tabelas se necessário
    await initializeVideoConsultationTables();
    await initializePatientsTable();

    let resolvedPatientId = typeof patientId === 'string' ? patientId.trim() : '';

    if (resolvedPatientId) {
      const existingPatient = await getPatientById(resolvedPatientId, user.username);

      if (!existingPatient) {
        return NextResponse.json(
          { error: 'Paciente não encontrado para esta conta' },
          { status: 404 }
        );
      }
    } else {
      const fullName = String(patientName).trim();
      const firstName = fullName.split(' ').filter(Boolean)[0] || 'Paciente';
      const cpfInput = typeof patientCpf === 'string' ? digitsOnly(patientCpf) : '';
      const cpf = cpfInput.length === 11 ? cpfInput : buildSyntheticCpf();

      const createdPatient = await createPatient(user.username, {
        nome: firstName,
        nomeCompleto: fullName,
        idade: 0,
        sexo: 'Outro',
        cpf,
        dataNascimento: '1900-01-01',
      });

      resolvedPatientId = createdPatient.id;
    }

    // Criar sala
    const room = await createVideoConsultaRoom(user.username, resolvedPatientId);

    // Gerar URL de acesso
    const joinUrl = `${process.env.APP_URL || 'http://localhost:3000'}/teleconsulta/${room.id}`;

    return NextResponse.json({
      room,
      joinUrl,
      token: room.roomToken,
      message: 'Sala de videoconsulta criada com sucesso',
    }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar teleconsulta:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Erro ao criar teleconsulta'
      },
      { status: 500 }
    );
  }
}
