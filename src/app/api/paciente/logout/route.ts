import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  const response = NextResponse.json({ message: 'Logout realizado com sucesso.' }, { status: 200 });

  response.cookies.set('patient_auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return response;
}
