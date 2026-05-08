import { jwtVerify, SignJWT } from 'jose';

const AUTH_TOKEN_AUDIENCE = 'omninote-app';
const AUTH_TOKEN_ISSUER = 'omninote';
const AUTH_TOKEN_SECRET_FALLBACK = 'omninote-dev-secret-change-me';

function getAuthTokenSecret(): Uint8Array {
  const secret = process.env.AUTH_TOKEN_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_TOKEN_SECRET não configurada. Defina um segredo forte para assinar a sessão.');
    }

    return new TextEncoder().encode(AUTH_TOKEN_SECRET_FALLBACK);
  }

  return new TextEncoder().encode(secret);
}

export async function createAuthToken(username: string): Promise<string> {
  return new SignJWT({ username })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(username)
    .setIssuedAt()
    .setIssuer(AUTH_TOKEN_ISSUER)
    .setAudience(AUTH_TOKEN_AUDIENCE)
    .setExpirationTime('24h')
    .sign(getAuthTokenSecret());
}

export async function getUsernameFromAuthToken(authToken?: string): Promise<string | null> {
  if (!authToken) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(authToken, getAuthTokenSecret(), {
      issuer: AUTH_TOKEN_ISSUER,
      audience: AUTH_TOKEN_AUDIENCE,
    });

    if (typeof payload.sub === 'string' && payload.sub.length > 0) {
      return payload.sub;
    }

    if (typeof payload.username === 'string' && payload.username.length > 0) {
      return payload.username;
    }

    return null;
  } catch {
    return null;
  }
}

export async function isValidAuthToken(authToken?: string): Promise<boolean> {
  return (await getUsernameFromAuthToken(authToken)) !== null;
}