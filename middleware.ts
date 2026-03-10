import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const authToken = request.cookies.get('auth_token');
  const pathname = request.nextUrl.pathname;

  // Allow access to login page and auth routes without authentication
  if (pathname === '/login' || pathname.startsWith('/api/auth')) {
    return NextResponse.next();
  }

  // Check if user is authenticated for protected routes
  if (!authToken) {
    // Redirect to login if trying to access protected routes without auth
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|.*\\..*).*)'],
};
