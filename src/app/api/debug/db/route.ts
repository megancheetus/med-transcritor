import { NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';

// Rota temporária de diagnóstico — REMOVER após corrigir o problema de login
export async function GET() {
  const result: Record<string, unknown> = {
    nodeEnv: process.env.NODE_ENV,
    hasDatabase: Boolean(process.env.DATABASE_URL),
    hasSsl: process.env.POSTGRES_SSL,
    sslRejectUnauthorized: process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED,
    hasAuthSecret: Boolean(process.env.AUTH_TOKEN_SECRET),
  };

  try {
    const pool = getPostgresPool();
    const res = await pool.query('SELECT NOW() as now, current_user as db_user');
    result.db = 'connected';
    result.dbTime = res.rows[0].now;
    result.dbUser = res.rows[0].db_user;
  } catch (err: unknown) {
    result.db = 'error';
    result.dbError = err instanceof Error ? err.message : String(err);
  }

  try {
    const pool = getPostgresPool();
    const res = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'app_users'
      ) as table_exists
    `);
    result.appUsersTable = res.rows[0].table_exists;

    if (res.rows[0].table_exists) {
      const count = await pool.query('SELECT COUNT(*) as total FROM app_users');
      result.userCount = count.rows[0].total;
    }
  } catch (err: unknown) {
    result.tableCheck = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json(result);
}
