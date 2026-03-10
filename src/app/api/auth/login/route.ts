import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    // Get credentials from environment variables
    const validUsername = process.env.AUTH_USERNAME;
    const validPassword = process.env.AUTH_PASSWORD;

    // Simple credential check
    if (username === validUsername && password === validPassword) {
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
