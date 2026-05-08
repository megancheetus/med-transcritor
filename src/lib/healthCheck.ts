import { NextRequest, NextResponse } from 'next/server';
import { getPostgresPool } from './postgres';
import { logger } from './logger';

export async function healthCheck(request: NextRequest): Promise<NextResponse> {
  const checks: Record<string, { status: 'ok' | 'error'; message?: string }> = {};

  // Database check
  try {
    const pool = getPostgresPool();
    await pool.query('SELECT 1');
    checks.database = { status: 'ok' };
  } catch (error) {
    checks.database = {
      status: 'error',
      message: error instanceof Error ? error.message : 'Desconhecido',
    };
    logger.error('Health check: Database failed', { error: checks.database.message }, request);
  }

  // Memory check (básico)
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const memory = process.memoryUsage();
    const heapUsedPercent = (memory.heapUsed / memory.heapTotal) * 100;

    checks.memory = {
      status: heapUsedPercent > 90 ? 'error' : 'ok',
      ...(heapUsedPercent > 90 && {
        message: `Heap usage at ${heapUsedPercent.toFixed(1)}%`,
      }),
    };
  }

  // Overall status
  const isHealthy = Object.values(checks).every((check) => check.status === 'ok');
  const statusCode = isHealthy ? 200 : 503;

  logger.info('Health check', { status: isHealthy ? 'healthy' : 'unhealthy' }, request);

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks,
    },
    { status: statusCode }
  );
}
