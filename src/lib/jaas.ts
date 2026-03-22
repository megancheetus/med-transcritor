import { importPKCS8, SignJWT } from 'jose';
import { randomUUID } from 'crypto';

const JAAS_AUDIENCE = 'jitsi';
const JAAS_ISSUER = 'chat';
const JAAS_DEFAULT_DOMAIN = '8x8.vc';
const JAAS_TOKEN_TTL_SECONDS = 60 * 60;

export interface JaasEnvironmentStatus {
  configured: boolean;
  missingVars: string[];
  appId?: string;
  domain: string;
}

export interface CreateJaasMeetingTokenInput {
  roomId: string;
  displayName: string;
  email?: string;
  isModerator: boolean;
}

export interface JaasMeetingToken {
  jwt: string;
  domain: string;
  appId: string;
  roomName: string;
  expiresAt: string;
}

function normalizePrivateKey(privateKey: string) {
  return privateKey.replace(/\\n/g, '\n').trim();
}

export function getJaasEnvironmentStatus(): JaasEnvironmentStatus {
  const appId = process.env.JAAS_APP_ID?.trim();
  const keyId = process.env.JAAS_KEY_ID?.trim();
  const privateKey = process.env.JAAS_PRIVATE_KEY?.trim();
  const domain = process.env.JAAS_DOMAIN?.trim() || JAAS_DEFAULT_DOMAIN;

  const missingVars = [
    !appId ? 'JAAS_APP_ID' : null,
    !keyId ? 'JAAS_KEY_ID' : null,
    !privateKey ? 'JAAS_PRIVATE_KEY' : null,
  ].filter((value): value is string => Boolean(value));

  return {
    configured: missingVars.length === 0,
    missingVars,
    appId: appId || undefined,
    domain,
  };
}

function getRequiredJaasConfig() {
  const status = getJaasEnvironmentStatus();

  if (!status.configured || !status.appId) {
    throw new Error(
      `Configuração do JaaS incompleta. Defina: ${status.missingVars.join(', ')}`
    );
  }

  const keyId = process.env.JAAS_KEY_ID!.trim();
  const privateKey = normalizePrivateKey(process.env.JAAS_PRIVATE_KEY!);

  return {
    appId: status.appId,
    domain: status.domain,
    keyId,
    privateKey,
  };
}

export async function createJaasMeetingToken({
  roomId,
  displayName,
  email,
  isModerator,
}: CreateJaasMeetingTokenInput): Promise<JaasMeetingToken> {
  const { appId, domain, keyId, privateKey } = getRequiredJaasConfig();
  const roomName = `${appId}/${roomId}`;
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = new Date((now + JAAS_TOKEN_TTL_SECONDS) * 1000).toISOString();
  const signingKey = await importPKCS8(privateKey, 'RS256');

  const jwt = await new SignJWT({
    room: roomId,
    context: {
      user: {
        id: randomUUID(),
        name: displayName,
        email,
        moderator: isModerator ? 'true' : 'false',
      },
      features: {
        livestreaming: isModerator,
        recording: isModerator,
        transcription: false,
        'outbound-call': false,
        'inbound-call': false,
      },
      room: {
        regex: false,
      },
    },
  })
    .setProtectedHeader({
      alg: 'RS256',
      kid: keyId,
      typ: 'JWT',
    })
    .setIssuedAt(now)
    .setNotBefore(now - 10)
    .setExpirationTime(now + JAAS_TOKEN_TTL_SECONDS)
    .setIssuer(JAAS_ISSUER)
    .setAudience(JAAS_AUDIENCE)
    .setSubject(appId)
    .sign(signingKey);

  return {
    jwt,
    domain,
    appId,
    roomName,
    expiresAt,
  };
}
