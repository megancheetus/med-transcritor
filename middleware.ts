import { NextRequest, NextResponse } from 'next/server';
import { getUsernameFromAuthToken } from '@/lib/auth';

function setNoStoreHeaders(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, private');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  response.headers.set('Surrogate-Control', 'no-store');
  return response;
}

export async function middleware(request: NextRequest) {
  const authToken = request.cookies.get('auth_token')?.value;
  const patientAuthToken = request.cookies.get('patient_auth_token')?.value;
  const pathname = request.nextUrl.pathname;
  const isAuthenticated = Boolean(await getUsernameFromAuthToken(authToken));
  const patientTokenSubject = await getUsernameFromAuthToken(patientAuthToken);
  const isPatientAuthenticated = Boolean(patientTokenSubject?.startsWith('patient:'));
  const protectedPaths = ['/', '/dashboard', '/transcricao', '/historico', '/perfil', '/prontuario', '/teleconsulta', '/admin'];
  const isProtectedPath = protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isPatientArea = pathname === '/paciente' || pathname.startsWith('/paciente/');
  const isPatientPublicPath = pathname === '/paciente/login' || pathname === '/paciente/primeiro-acesso';

  if (pathname === '/login') {
    if (isAuthenticated) {
      return setNoStoreHeaders(NextResponse.redirect(new URL('/dashboard', request.url)));
    }

    return setNoStoreHeaders(NextResponse.next());
  }

  if (isPatientArea) {
    if (isPatientPublicPath && isPatientAuthenticated) {
      return setNoStoreHeaders(NextResponse.redirect(new URL('/paciente/dashboard', request.url)));
    }

    if (!isPatientPublicPath && !isPatientAuthenticated) {
      return setNoStoreHeaders(NextResponse.redirect(new URL('/paciente/login', request.url)));
    }

    return setNoStoreHeaders(NextResponse.next());
  }

  if (!isAuthenticated && isProtectedPath) {
    if (pathname === '/' && isPatientAuthenticated) {
      return setNoStoreHeaders(NextResponse.redirect(new URL('/paciente/dashboard', request.url)));
    }

    return setNoStoreHeaders(NextResponse.redirect(new URL('/login-escolha', request.url)));
  }

  return setNoStoreHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/', '/login', '/dashboard/:path*', '/transcricao/:path*', '/historico/:path*', '/perfil/:path*', '/prontuario/:path*', '/teleconsulta/:path*', '/admin/:path*', '/paciente/:path*'],
};
