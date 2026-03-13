import { NextRequest, NextResponse } from 'next/server';
import { deleteUser } from '@/lib/authUsers';
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

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ username: string }> }
) {
  const adminUser = await requireAdmin(request);

  if (adminUser instanceof NextResponse) {
    return adminUser;
  }

  try {
    const params = await context.params;
    const targetUsername = decodeURIComponent(params.username);

    if (targetUsername.trim() === adminUser.username) {
      return NextResponse.json({ error: 'Não é permitido excluir o próprio usuário administrador logado' }, { status: 400 });
    }

    await deleteUser(targetUsername);
    return NextResponse.json({ message: 'Usuário excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);

    if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    if (error instanceof Error && error.message === 'LAST_ADMIN') {
      return NextResponse.json({ error: 'Não é permitido excluir o último administrador ativo' }, { status: 409 });
    }

    return NextResponse.json({ error: 'Não foi possível excluir o usuário' }, { status: 500 });
  }
}
