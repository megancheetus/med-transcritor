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
    const pool = new Pool({
      connectionString,
      ssl: getSslConfig(),
      max: 3,                        // Serverless: limita conexões simultâneas
      idleTimeoutMillis: 10000,      // Descarta conexões ociosas após 10s
      connectionTimeoutMillis: 8000, // Falha rápida se o banco não responder
    });

    // Quando o PgBouncer/Transaction Pooler fecha uma conexão ociosa,
    // o pg.Pool emite 'error' sem forma padrão de recuperação.
    // Resetamos o pool para que a próxima request crie um novo.
    pool.on('error', (err) => {
      console.error('[postgres] idle client error — resetting pool:', err.message);
      global.omninotePostgresPool = undefined;
    });

    global.omninotePostgresPool = pool;
  }

  return global.omninotePostgresPool;
}