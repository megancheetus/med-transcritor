import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { getUsernameFromAuthToken } from '@/lib/auth';
import { AppUserRecord, getUserByUsername } from '@/lib/authUsers';

async function getAuthenticatedUserFromToken(authToken?: string): Promise<AppUserRecord | null> {
  const username = await getUsernameFromAuthToken(authToken);

  if (!username) {
    return null;
  }

  const user = await getUserByUsername(username);

  if (!user) {
    return null;
  }

  if (!user.isAdmin && user.trialExpired) {
    return null;
  }

  return user;
}

export async function getAuthenticatedUserFromRequest(request: NextRequest): Promise<AppUserRecord | null> {
  return getAuthenticatedUserFromToken(request.cookies.get('auth_token')?.value);
}

export async function getAuthenticatedUserFromCookies(): Promise<AppUserRecord | null> {
  const cookieStore = await cookies();
  return getAuthenticatedUserFromToken(cookieStore.get('auth_token')?.value);
}