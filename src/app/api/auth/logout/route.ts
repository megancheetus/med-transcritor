import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Create response with redirect
  const response = NextResponse.redirect(new URL('/login', request.url));

  // Clear authentication cookie
  response.cookies.delete('auth_token');

  return response;
}
