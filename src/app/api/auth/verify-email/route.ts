import { NextRequest, NextResponse } from 'next/server';
import { confirmUserEmailByToken } from '@/lib/authUsers';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim() || '';

  if (!token) {
    return NextResponse.redirect(new URL('/login?verified=invalid', request.url));
  }

  try {
    const confirmed = await confirmUserEmailByToken(token);

    if (!confirmed) {
      return NextResponse.redirect(new URL('/login?verified=invalid', request.url));
    }

    return NextResponse.redirect(new URL('/login?verified=success', request.url));
  } catch {
    return NextResponse.redirect(new URL('/login?verified=error', request.url));
  }
}
