import { NextRequest, NextResponse } from 'next/server';
import { createUser, listUsers } from '@/lib/authUsers';
import { getAuthenticatedUserFromRequest } from '@/lib/authSession';

export const runtime = 'nodejs';

function isValidUsername(username: unknown): username is string {
  return typeof username === 'string' && username.trim().length >= 3;
}

function isValidPassword(password: unknown): password is string {
  return typeof password === 'string' && password.length >= 8;
}

function isValidFullName(fullName: unknown): fullName is string {
  return typeof fullName === 'string' && fullName.trim().length >= 3;
}

function isValidEmail(email: unknown): email is string {
  if (typeof email !== 'string') {
    return false;
  }

  const normalized = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

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

export async function GET(request: NextRequest) {
  const adminUser = await requireAdmin(request);

  if (adminUser instanceof NextResponse) {
    return adminUser;
  }

  try {
    const users = await listUsers();
    return NextResponse.json({ users });
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    return NextResponse.json({ error: 'Não foi possível carregar os usuários' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const adminUser = await requireAdmin(request);

  if (adminUser instanceof NextResponse) {
    return adminUser;
  }

  try {
    const payload = await request.json();
    const { username, password, fullName, email, isAdmin } = payload as {
      username?: unknown;
      password?: unknown;
      fullName?: unknown;
      email?: unknown;
      isAdmin?: unknown;
    };

    if (!isValidUsername(username)) {
      return NextResponse.json({ error: 'Informe um usuário com pelo menos 3 caracteres' }, { status: 400 });
    }

    if (!isValidPassword(password)) {
      return NextResponse.json({ error: 'Informe uma senha com pelo menos 8 caracteres' }, { status: 400 });
    }

    if (!isValidFullName(fullName)) {
      return NextResponse.json({ error: 'Informe o nome com pelo menos 3 caracteres' }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Informe um e-mail válido' }, { status: 400 });
    }

    const user = await createUser({
      username,
      password,
      fullName,
      email,
      isAdmin: isAdmin === true,
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);

    if (typeof error === 'object' && error !== null && Reflect.get(error, 'code') === '23505') {
      return NextResponse.json({ error: 'Usuário ou e-mail já cadastrado' }, { status: 409 });
    }

    return NextResponse.json({ error: 'Não foi possível cadastrar o usuário' }, { status: 500 });
  }
}