import { NextRequest, NextResponse } from 'next/server';
import { getUsernameFromAuthToken } from '@/lib/auth';
import { createJaasMeetingToken, getJaasEnvironmentStatus } from '@/lib/jaas';
import { getVideoConsultaRoom, getVideoConsultaRoomByToken } from '@/lib/videoConsultationManager';
import { rateLimitMiddleware } from '@/lib/rateLimit';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // Rate limit: 20 tokens por IP a cada 10 minutos (cobre reconexões legítimas)
    const rateLimitResponse = await rateLimitMiddleware(request, 'jaas-token', {
      windowMs: 10 * 60 * 1000,
      maxRequests: 20,
      message: 'Muitas solicitações de acesso à sala. Tente novamente em alguns minutos.',
    });
    if (rateLimitResponse) return rateLimitResponse;

    const { id } = await context.params;
    const authToken = request.cookies.get('auth_token')?.value;
    const username = await getUsernameFromAuthToken(authToken);
    const publicToken = request.nextUrl.searchParams.get('token') || undefined;
    const role = request.nextUrl.searchParams.get('role');

    if (role !== 'professional' && role !== 'patient') {
      return NextResponse.json({ error: 'role inválido' }, { status: 400 });
    }

    const jaasStatus = getJaasEnvironmentStatus();
    if (!jaasStatus.configured) {
      return NextResponse.json(
        {
          error: `JaaS não configurado. Defina: ${jaasStatus.missingVars.join(', ')}`,
          missingVars: jaasStatus.missingVars,
        },
        { status: 503 }
      );
    }

    let room = null;

    if (username) {
      room = await getVideoConsultaRoom(id, username);
    } else if (publicToken) {
      room = await getVideoConsultaRoomByToken(publicToken);
      if (room && room.id !== id) {
        room = null;
      }
    }

    if (!room) {
      return NextResponse.json({ error: 'Teleconsulta não encontrada' }, { status: 404 });
    }

    // Bloquear acesso a salas encerradas ou expiradas
    if (room.status === 'ended' || room.status === 'expired') {
      return NextResponse.json(
        { error: 'Esta teleconsulta já foi encerrada e não pode mais ser acessada.' },
        { status: 410 }
      );
    }

    // Bloquear acesso após data de expiração
    if (room.expiresAt && new Date(room.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'O link desta teleconsulta expirou.' },
        { status: 410 }
      );
    }

    const displayName = role === 'professional'
      ? room.professionalUsername
      : room.patientName || 'Paciente';

    const meeting = await createJaasMeetingToken({
      roomId: id,
      displayName,
      isModerator: role === 'professional',
    });

    return NextResponse.json({
      domain: meeting.domain,
      appId: meeting.appId,
      roomName: meeting.roomName,
      jwt: meeting.jwt,
      expiresAt: meeting.expiresAt,
      displayName,
      role,
    });
  } catch (error) {
    console.error('Erro ao gerar token JaaS:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Erro ao gerar token JaaS',
      },
      { status: 500 }
    );
  }
}
