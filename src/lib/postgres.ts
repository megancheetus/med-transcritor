import { Pool } from 'pg';

declare global {
  var omninotePostgresPool: Pool | undefined;
}

function parseCaCertFromEnv(): string | null {
  const rawCaValue = process.env.POSTGRES_CA_CERT;

  if (!rawCaValue) {
    return null;
  }

  const trimmed = rawCaValue.trim();

  // Support plain PEM pasted directly in env (possibly with escaped new lines).
  if (trimmed.includes('BEGIN CERTIFICATE')) {
    return trimmed.replace(/\\n/g, '\n');
  }

  // Support base64-encoded PEM value.
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf-8');

    if (decoded.includes('BEGIN CERTIFICATE')) {
      return decoded;
    }
  } catch {
    return null;
  }

  return null;
}

function getSslConfig() {
  const useSsl = process.env.POSTGRES_SSL === 'true' || process.env.NODE_ENV === 'production';

  if (!useSsl) {
    return false;
  }

  // Se houver certificado CA válido em POSTGRES_CA_CERT (base64 ou PEM),
  // usamos verificação completa da cadeia (rejectUnauthorized: true).
  const caCert = parseCaCertFromEnv();
  if (caCert) {
    return {
      rejectUnauthorized: true,
      ca: caCert,
    };
  }

  // Fallback: sem CA explícito, respeita a variável de ambiente.
  // No Supabase Transaction Pooler, rejectUnauthorized deve ser false.
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