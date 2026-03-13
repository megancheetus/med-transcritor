import { Pool } from 'pg';

declare global {
  var omninotePostgresPool: Pool | undefined;
}

function getSslConfig() {
  const useSsl = process.env.POSTGRES_SSL === 'true' || process.env.NODE_ENV === 'production';

  if (!useSsl) {
    return false;
  }

  return {
    rejectUnauthorized: process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED !== 'false',
  };
}

export function getPostgresPool(): Pool {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL não configurada. Defina a conexão com o PostgreSQL.');
  }

  if (!global.omninotePostgresPool) {
    global.omninotePostgresPool = new Pool({
      connectionString,
      ssl: getSslConfig(),
    });
  }

  return global.omninotePostgresPool;
}