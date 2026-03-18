import { NextRequest, NextResponse } from 'next/server';
import { getUsernameFromAuthToken } from '@/lib/auth';
import { createJaasMeetingToken, getJaasEnvironmentStatus } from '@/lib/jaas';
import { getVideoConsultaRoom, getVideoConsultaRoomByToken } from '@/lib/videoConsultationManager';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
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
