import { NextRequest, NextResponse } from 'next/server';
import { getUsernameFromAuthToken } from '@/lib/auth';
import {
  createVideoConsultaRoom,
  getVideoConsultasOfProfessional,
  getVideoConsultasOfPatient,
  initializeVideoConsultationTables,
} from '@/lib/videoConsultationManager';

/**
 * GET /api/videoconsultations
 * Lista todas as teleconsultas do usuário (como profissional ou paciente)
 */
export async function GET(request: NextRequest) {
  try {
    // Autenticação
    const authToken = request.cookies.get('auth_token')?.value;
    const username = await getUsernameFromAuthToken(authToken);

    if (!username) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Query params
    const patientId = request.nextUrl.searchParams.get('patientId');

    // Inicializar tabelas se necessário
    await initializeVideoConsultationTables();

    let consultations;

    if (patientId) {
      // Listar teleconsultas de um paciente específico
      consultations = await getVideoConsultasOfPatient(patientId, username);
    } else {
      // Listar teleconsultas onde o usuário é profissional
      consultations = await getVideoConsultasOfProfessional(username);
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
    const authToken = request.cookies.get('auth_token')?.value;
    const username = await getUsernameFromAuthToken(authToken);

    if (!username) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Parse body
    const body = await request.json();
    const { patientId } = body;

    // Validação
    if (!patientId || typeof patientId !== 'string') {
      return NextResponse.json(
        { error: 'patient_id é obrigatório' },
        { status: 400 }
      );
    }

    // Inicializar tabelas se necessário
    await initializeVideoConsultationTables();

    // Criar sala
    const room = await createVideoConsultaRoom(username, patientId);

    // Gerar URL de acesso
    const joinUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/teleconsulta/${room.id}`;

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
