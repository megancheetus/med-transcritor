import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
}

interface RateLimitStore {
  [key: string]: { count: number; resetTime: number };
}

const stores: Map<string, RateLimitStore> = new Map();

/**
 * Middleware de rate limiting simples (sem dependências externas)
 * Uso: await rateLimitMiddleware(request, 'login', { windowMs: 900000, maxRequests: 5 })
 */
export async function rateLimitMiddleware(
  request: NextRequest,
  endpoint: string,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  const ip = getClientIp(request);
  const key = `${endpoint}:${ip}`;

  let store = stores.get(endpoint);
  if (!store) {
    store = {};
    stores.set(endpoint, store);
  }

  const now = Date.now();
  const record = store[key];

  // Limpar registro expirado
  if (record && record.resetTime < now) {
    delete store[key];
  }

  // Criar novo registro
  if (!store[key]) {
    store[key] = { count: 1, resetTime: now + config.windowMs };
    return null; // Permitir
  }

  // Incrementar contador
  store[key].count++;

  // Verificar limite
  if (store[key].count > config.maxRequests) {
    const resetTime = new Date(store[key].resetTime).toISOString();
    return NextResponse.json(
      {
        error: config.message || 'Muitas tentativas. Tente novamente mais tarde.',
        retryAfter: Math.ceil((store[key].resetTime - now) / 1000),
        resetTime,
      },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((store[key].resetTime - now) / 1000).toString(),
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': store[key].resetTime.toString(),
        },
      }
    );
  }

  // Permitir, mas retornar headers informativos
  return null;
}

/**
 * Extrair IP real do cliente (considera proxies)
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const real = request.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (real) {
    return real;
  }

  // Fallback para IP da conexão
  return 'unknown';
}

/**
 * Limpar registros expirados periodicamente (executar a cada 1 minuto)
 */
export function startRateLimitCleanup(intervalMs: number = 60000) {
  setInterval(() => {
    const now = Date.now();

    stores.forEach((store) => {
      Object.keys(store).forEach((key) => {
        if (store[key].resetTime < now) {
          delete store[key];
        }
      });
    });
  }, intervalMs);
}
