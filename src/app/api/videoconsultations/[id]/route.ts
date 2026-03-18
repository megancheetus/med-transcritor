import { NextRequest, NextResponse } from 'next/server';
import { getUsernameFromAuthToken } from '@/lib/auth';
import {
  getVideoConsultaRoom,
  getVideoConsultaRoomByToken,
  updateVideoConsultaRoomStatus,
  finalizeVideoConsultaRoom,
  logVideoConsultaEvent,
} from '@/lib/videoConsultationManager';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/videoconsultations/:id
 * Obtém detalhes de uma teleconsulta
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    console.log(`GET /api/videoconsultations/${id}`);
    
    // Tentar autenticar (opcional - paciente pode estar não autenticado)
    const authToken = request.cookies.get('auth_token')?.value;
    const username = await getUsernameFromAuthToken(authToken);
    console.log(`Usuário autenticado: ${username || 'não-autenticado'}`);

    // Tentar obter pelo ID (autenticado)
    if (username) {
      console.log(`Tentando obter sala ${id} como profissional...`);
      const room = await getVideoConsultaRoom(id, username);
      if (room) {
        console.log(`✅ Sala encontrada para profissional`);
        return NextResponse.json({ room });
      }
    }

    // Tentar obter pelo token (para pacientes)
    const token = request.nextUrl.searchParams.get('token');
    console.log(`Token fornecido: ${token ? token.substring(0, 10) + '...' : 'nenhum'}`);
    
    if (token) {
      console.log(`Tentando obter sala por token...`);
      const room = await getVideoConsultaRoomByToken(token);
      if (room) {
        console.log(`✅ Sala encontrada por token`);
        return NextResponse.json({ room });
      } else {
        console.log(`❌ Token inválido ou sala expirada`);
      }
    }

    console.log(`❌ Sala não encontrada (ID: ${id}, Token: ${token ? 'sim' : 'não'})`);
    return NextResponse.json(
      { error: 'Teleconsulta não encontrada' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Erro ao obter teleconsulta:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Erro ao obter teleconsulta'
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/videoconsultations/:id
 * Atualiza uma teleconsulta (status, duração, etc)
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    const body = await request.json();
    const { status, action, duracaoSegundos, foiGravada, transcricaoId, token } = body;

    // Autenticação
    const authToken = request.cookies.get('auth_token')?.value;
    const username = await getUsernameFromAuthToken(authToken);

    // Ações disponíveis
    if (action === 'start') {
      if (!username) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
      }

      // Iniciar a consutla (mudar status para active)
      const updated = await updateVideoConsultaRoomStatus(id, 'active', username);
      await logVideoConsultaEvent(id, 'professional_joined', username);

      return NextResponse.json({
        room: updated,
        message: 'Teleconsulta iniciada',
      });
    }

    if (action === 'end') {
      if (!username) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
      }

      // Encerrar a consulta
      const updated = await finalizeVideoConsultaRoom(
        id,
        duracaoSegundos || 0,
        foiGravada || false,
        transcricaoId,
        username
      );
      await logVideoConsultaEvent(id, 'disconnected', username);

      return NextResponse.json({
        room: updated,
        message: 'Teleconsulta encerrada',
      });
    }

    if (action === 'log_patient_joined') {
      if (!token || typeof token !== 'string') {
        return NextResponse.json({ error: 'Token público inválido' }, { status: 400 });
      }

      const room = await getVideoConsultaRoomByToken(token);
      if (!room || room.id !== id) {
        return NextResponse.json({ error: 'Teleconsulta não encontrada' }, { status: 404 });
      }

      // Registrar que paciente entrou
      await logVideoConsultaEvent(id, 'patient_joined', 'patient');
      
      return NextResponse.json({
        message: 'Evento registrado',
      });
    }

    if (status) {
      if (!username) {
        return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
      }

      // Atualizar status genérico
      const updated = await updateVideoConsultaRoomStatus(id, status, username);
      return NextResponse.json({
        room: updated,
        message: 'Status atualizado',
      });
    }

    return NextResponse.json(
      { error: 'Nenhuma ação especificada' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Erro ao atualizar teleconsulta:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Erro ao atualizar teleconsulta'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/videoconsultations/:id
 * Cancela uma teleconsulta (apenas salas em "waiting")
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;

    // Autenticação
    const authToken = request.cookies.get('auth_token')?.value;
    const username = await getUsernameFromAuthToken(authToken);

    if (!username) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Obter sala para validar propriedade
    const room = await getVideoConsultaRoom(id, username);
    if (!room) {
      return NextResponse.json(
        { error: 'Teleconsulta não encontrada' },
        { status: 404 }
      );
    }

    // Só permite deletar salas em "waiting" (ainda não iniciadas)
    if (room.status !== 'waiting') {
      return NextResponse.json(
        { error: 'Não é possível cancelar uma teleconsulta já iniciada' },
        { status: 400 }
      );
    }

    // Atualizar status para 'expired'
    const updated = await updateVideoConsultaRoomStatus(id, 'expired', username);

    return NextResponse.json({
      room: updated,
      message: 'Teleconsulta cancelada',
    });
  } catch (error) {
    console.error('Erro ao cancelar teleconsulta:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Erro ao cancelar teleconsulta'
      },
      { status: 500 }
    );
  }
}
