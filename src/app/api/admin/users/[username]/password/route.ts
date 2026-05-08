import { NextRequest, NextResponse } from 'next/server';
import { updateUserPassword } from '@/lib/authUsers';
import { getAuthenticatedUserFromRequest } from '@/lib/authSession';

export const runtime = 'nodejs';

async function requireAdmin(request: NextRequest) {
  const user = await getAuthenticatedUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  if (!user.isAdmin) {
    return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 });
  }

  return user;
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ username: string }> }
) {
  const adminUser = await requireAdmin(request);

  if (adminUser instanceof NextResponse) {
    return adminUser;
  }

  try {
    const payload = await request.json();
    const newPassword = typeof payload?.password === 'string' ? payload.password : '';

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Informe uma senha com pelo menos 8 caracteres' }, { status: 400 });
    }

    const params = await context.params;
    await updateUserPassword(decodeURIComponent(params.username), newPassword);
    return NextResponse.json({ message: 'Senha atualizada com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar senha:', error);

    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Não foi possível atualizar a senha' }, { status: 500 });
  }
}