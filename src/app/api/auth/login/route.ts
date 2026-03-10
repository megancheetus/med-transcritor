import { NextRequest, NextResponse } from 'next/server';

interface AuthUser {
  username: string;
  password: string;
}

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    // Get credentials from environment variable (JSON format)
    const authUsersJson = process.env.AUTH_USERS;

    if (!authUsersJson) {
      return NextResponse.json(
        { error: 'Servidor não configurado corretamente' },
        { status: 500 }
      );
    }

    // Parse JSON with multiple users
    let authUsers: AuthUser[];
    try {
      authUsers = JSON.parse(authUsersJson);
    } catch {
      return NextResponse.json(
        { error: 'Configuração de usuários inválida' },
        { status: 500 }
      );
    }

    // Find matching user
    const user = authUsers.find(
      (u) => u.username === username && u.password === password
    );

    if (user) {
      // Create response with auth cookie
      const response = NextResponse.json(
        { message: 'Login bem-sucedido' },
        { status: 200 }
      );

      // Set authentication cookie (valid for 24 hours)
      response.cookies.set('auth_token', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 86400, // 24 hours
        path: '/',
      });

      return response;
    }

    // Invalid credentials
    return NextResponse.json(
      { error: 'Usuário ou senha incorretos' },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao processar login' },
      { status: 500 }
    );
  }
}
