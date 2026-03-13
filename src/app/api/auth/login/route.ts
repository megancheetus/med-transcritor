import { NextRequest, NextResponse } from 'next/server';
import { createAuthToken } from '@/lib/auth';
import { authenticateUser, ensureAuthBootstrap } from '@/lib/authUsers';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    await ensureAuthBootstrap();
    const authenticated = await authenticateUser(username, password);

    if (authenticated) {
      const tokenValue = await createAuthToken(username);

      // Create response with auth cookie
      const response = NextResponse.json(
        { message: 'Login bem-sucedido' },
        { status: 200 }
      );

      // Set authentication cookie (valid for 24 hours)
      response.cookies.set('auth_token', tokenValue, {
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
    console.error('Erro no login:', error);
    return NextResponse.json(
      { error: 'Erro ao processar login' },
      { status: 500 }
    );
  }
}
