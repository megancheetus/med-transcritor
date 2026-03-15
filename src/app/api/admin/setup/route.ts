import { NextRequest, NextResponse } from 'next/server';
import { createUser, listUsers } from '@/lib/authUsers';

export const runtime = 'nodejs';

function isValidUsername(username: unknown): username is string {
  return typeof username === 'string' && username.trim().length >= 3;
}

function isValidPassword(password: unknown): password is string {
  return typeof password === 'string' && password.length >= 8;
}

/**
 * POST /api/admin/setup
 * Endpoint para criar o primeiro usuário admin do sistema
 * Apenas funciona se não houver nenhum admin cadastrado
 * 
 * Request body:
 * {
 *   "username": "string (min 3 chars)",
 *   "password": "string (min 8 chars)",
 *   "fullName": "string (opcional)",
 *   "email": "string (opcional)"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Verifica se já existem usuários admin
    const existingUsers = await listUsers();
    const hasAdminUsers = existingUsers.some((user) => user.isAdmin);

    if (hasAdminUsers) {
      return NextResponse.json(
        { 
          error: 'Sistema já configurado. Use /api/admin/users para criar novos usuários.' 
        },
        { status: 403 }
      );
    }

    const payload = await request.json();
    const { username, password, fullName, email } = payload as {
      username?: unknown;
      password?: unknown;
      fullName?: unknown;
      email?: unknown;
    };

    // Validação de username
    if (!isValidUsername(username)) {
      return NextResponse.json(
        { error: 'Informe um usuário com pelo menos 3 caracteres' },
        { status: 400 }
      );
    }

    // Validação de password
    if (!isValidPassword(password)) {
      return NextResponse.json(
        { error: 'Informe uma senha com pelo menos 8 caracteres' },
        { status: 400 }
      );
    }

    // Criar usuário como admin (primeira vez)
    const user = await createUser({
      username,
      password,
      fullName: fullName && typeof fullName === 'string' ? fullName : null,
      email: email && typeof email === 'string' ? email : null,
      isAdmin: true, // Primeiro usuário é sempre admin
    });

    return NextResponse.json(
      { 
        message: 'Usuário admin criado com sucesso! Faça login para continuar.',
        user: {
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          isAdmin: user.isAdmin,
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro no setup:', error);
    
    if (error instanceof Error && error.message.includes('duplicate key')) {
      return NextResponse.json(
        { error: 'Este usuário já existe' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Erro ao criar usuário' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/setup
 * Retorna o status do setup - se o sistema está pronto ou não
 */
export async function GET() {
  try {
    const users = await listUsers();
    const hasAdminUsers = users.some((user) => user.isAdmin);

    if (hasAdminUsers) {
      return NextResponse.json(
        { 
          status: 'ready',
          message: 'Sistema já foi configurado'
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { 
        status: 'pending',
        message: 'Sistema aguardando configuração inicial',
        setupRequired: true
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Erro ao verificar status de setup:', error);
    return NextResponse.json(
      { error: 'Erro ao verificar status' },
      { status: 500 }
    );
  }
}
