import { NextRequest, NextResponse } from 'next/server';
import { createUser, ensureAuthBootstrap, getPendingEmailVerificationToken } from '@/lib/authUsers';
import { rateLimitMiddleware, getClientIp } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';
import { sendTrialVerificationEmail } from '@/lib/emailService';

export const runtime = 'nodejs';

async function verifyRecaptchaToken(token: string, remoteIp: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;

  if (!secret) {
    throw new Error('RECAPTCHA_NOT_CONFIGURED');
  }

  const body = new URLSearchParams();
  body.set('secret', secret);
  body.set('response', token);
  if (remoteIp) {
    body.set('remoteip', remoteIp);
  }

  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    return false;
  }

  const data = (await response.json()) as { success?: boolean };
  return data.success === true;
}

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

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  try {
    const rateLimitResponse = await rateLimitMiddleware(request, 'trial-register', {
      windowMs: 15 * 60 * 1000,
      maxRequests: 5,
      message: 'Muitas tentativas de cadastro. Tente novamente em alguns minutos.',
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const payload = await request.json();
    const { username, password, fullName, email, recaptchaToken } = payload as {
      username?: unknown;
      password?: unknown;
      fullName?: unknown;
      email?: unknown;
      recaptchaToken?: unknown;
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

    if (typeof recaptchaToken !== 'string' || recaptchaToken.trim().length === 0) {
      return NextResponse.json({ error: 'Confirme o reCAPTCHA para continuar' }, { status: 400 });
    }

    const recaptchaValid = await verifyRecaptchaToken(recaptchaToken, ip);
    if (!recaptchaValid) {
      return NextResponse.json({ error: 'Falha na validação do reCAPTCHA' }, { status: 400 });
    }

    await ensureAuthBootstrap();

    const user = await createUser({
      username,
      password,
      fullName,
      email,
      isAdmin: false,
      accountPlan: 'trial',
      allowBootstrapAdmin: false,
      emailVerificationRequired: true,
    });

    const verificationToken = await getPendingEmailVerificationToken(user.username);
    if (!verificationToken) {
      throw new Error('EMAIL_VERIFICATION_TOKEN_NOT_FOUND');
    }

    const appBaseUrl = process.env.APP_URL || request.nextUrl.origin;
    const verificationUrl = `${appBaseUrl}/api/auth/verify-email?token=${encodeURIComponent(
      verificationToken
    )}`;

    await sendTrialVerificationEmail({
      to: user.email || email,
      fullName: user.fullName,
      verificationUrl,
    });

    const response = NextResponse.json(
      {
        message: 'Conta de teste criada. Verifique seu e-mail para ativar o acesso.',
      },
      { status: 201 }
    );

    logger.info('Trial account created with pending email verification', { username: user.username, ip }, request);
    return response;
  } catch (error) {
    logger.error(
      'Trial account creation error',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip,
      },
      request
    );

    if (error instanceof Error && error.message === 'RECAPTCHA_NOT_CONFIGURED') {
      return NextResponse.json({ error: 'reCAPTCHA não configurado no servidor' }, { status: 503 });
    }

    if (error instanceof Error && error.message.includes('EMAIL_PROVIDER_NOT_CONFIGURED')) {
      return NextResponse.json({ error: 'Serviço de e-mail não configurado para confirmação de conta' }, { status: 503 });
    }

    if (error instanceof Error && error.message === 'EMAIL_VERIFICATION_TOKEN_NOT_FOUND') {
      return NextResponse.json({ error: 'Não foi possível preparar a verificação de e-mail' }, { status: 500 });
    }

    if (typeof error === 'object' && error !== null && Reflect.get(error, 'code') === '23505') {
      return NextResponse.json({ error: 'Usuário ou e-mail já cadastrado' }, { status: 409 });
    }

    return NextResponse.json({ error: 'Não foi possível criar a conta de teste' }, { status: 500 });
  }
}
