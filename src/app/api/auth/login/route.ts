import { NextRequest, NextResponse } from 'next/server';
import { createAuthToken } from '@/lib/auth';
import { authenticateUser, ensureAuthBootstrap } from '@/lib/authUsers';
import { rateLimitMiddleware, getClientIp } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

/**
 * POST /api/auth/login
 * Autentica usuário e retorna JWT token via cookie
 * 
 * Rate Limit: 5 tentativas por 15 minutos por IP
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  
  try {
    // Rate limiting: máximo 5 tentativas em 15 minutos
    const rateLimitResponse = await rateLimitMiddleware(request, 'login', {
      windowMs: 15 * 60 * 1000, // 15 minutos
      maxRequests: 5,
      message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
    });

    if (rateLimitResponse) {
      logger.warn('Login rate limit exceeded', { ip }, request);
      return rateLimitResponse;
    }

    const { username, password } = await request.json();

    if (!username || !password) {
      logger.warn('Login attempt with missing credentials', { username, ip }, request);
      return NextResponse.json(
        { error: 'Usuário e senha são obrigatórios' },
        { status: 400 }
      );
    }

    logger.info('Login attempt', { username, ip }, request);

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

      logger.info('Login successful', { username, ip }, request);
      return response;
    }

    // Invalid credentials
    logger.warn('Login failed - invalid credentials', { username, ip }, request);
    return NextResponse.json(
      { error: 'Usuário ou senha incorretos' },
      { status: 401 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'TRIAL_EXPIRED') {
      logger.warn('Login blocked - expired trial', { ip }, request);
      return NextResponse.json(
        { error: 'Seu período de teste de 3 dias expirou. Entre em contato para ativar um plano.' },
        { status: 403 }
      );
    }

    if (error instanceof Error && error.message === 'EMAIL_NOT_VERIFIED') {
      logger.warn('Login blocked - email not verified', { ip }, request);
      return NextResponse.json(
        { error: 'Confirme seu e-mail antes de fazer login.' },
        { status: 403 }
      );
    }

    const errorMessage = error instanceof Error ? error.message : 'Desconhecido';
    logger.error('Login error', 
      { 
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        ip
      }, 
      request
    );
    
    return NextResponse.json(
      { error: 'Erro ao processar login' },
      { status: 500 }
    );
  }
}
