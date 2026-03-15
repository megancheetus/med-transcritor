import { NextRequest } from 'next/server';
import { healthCheck } from '@/lib/healthCheck';

export const runtime = 'nodejs';

/**
 * GET /api/health
 * Verifica saúde da aplicação
 * 
 * Response 200 (Healthy):
 * {
 *   "status": "healthy",
 *   "timestamp": "2026-03-15T...",
 *   "checks": {
 *     "database": { "status": "ok" },
 *     "memory": { "status": "ok" }
 *   }
 * }
 * 
 * Response 503 (Unhealthy):
 * {
 *   "status": "unhealthy",
 *   "timestamp": "2026-03-15T...",
 *   "checks": {
 *     "database": { "status": "error", "message": "..." },
 *     "memory": { "status": "ok" }
 *   }
 * }
 */
export async function GET(request: NextRequest) {
  return healthCheck(request);
}
