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
  const pathname = request.nextUrl.pathname;
  const isAuthenticated = Boolean(await getUsernameFromAuthToken(authToken));
  const protectedPaths = ['/', '/dashboard', '/transcricao', '/historico', '/perfil', '/admin'];
  const isProtectedPath = protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));

  if (pathname === '/login') {
    if (isAuthenticated) {
      return setNoStoreHeaders(NextResponse.redirect(new URL('/dashboard', request.url)));
    }

    return setNoStoreHeaders(NextResponse.next());
  }

  if (!isAuthenticated && isProtectedPath) {
    return setNoStoreHeaders(NextResponse.redirect(new URL('/login', request.url)));
  }

  return setNoStoreHeaders(NextResponse.next());
}

export const config = {
  matcher: ['/', '/login', '/dashboard/:path*', '/transcricao/:path*', '/historico/:path*', '/perfil/:path*', '/admin/:path*'],
};
