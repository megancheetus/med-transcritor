import { createHash } from 'crypto';
import { NextRequest } from 'next/server';

export interface RequestAuditContext {
  ipHash?: string;
  userAgent?: string;
}

function normalizeIp(value: string | null): string | undefined {
  if (!value) {
    return undefined;
  }

  const first = value.split(',')[0]?.trim();
  return first || undefined;
}

export function getRequestAuditContext(request: NextRequest): RequestAuditContext {
  const forwardedFor = normalizeIp(request.headers.get('x-forwarded-for'));
  const realIp = normalizeIp(request.headers.get('x-real-ip'));
  const ip = forwardedFor || realIp;

  const ipHash = ip
    ? createHash('sha256').update(ip).digest('hex')
    : undefined;

  return {
    ipHash,
    userAgent: request.headers.get('user-agent') || undefined,
  };
}
