import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const authToken = request.cookies.get('auth_token');
  const pathname = request.nextUrl.pathname;

  // Allow access to login page without authentication
  if (pathname === '/login' || pathname.startsWith('/api/auth/login')) {
    return NextResponse.next();
  }

  // Check if user is authenticated for protected routes
  if (!authToken) {
    if (pathname === '/') {
      // Redirect to login if trying to access home page without auth
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/api/:path*'],
};
