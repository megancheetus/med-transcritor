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
      max: 10,                       // Aumentado para serverless
      min: 2,                        // Manter pelo menos 2 conexões quentes
      idleTimeoutMillis: 30000,      // Mais tolerante com pools
      connectionTimeoutMillis: 10000, // Aumentado para Supabase
      statement_timeout: 30000,      // Timeout de statement
    });

    // Quando o PgBouncer/Transaction Pooler fecha uma conexão ociosa,
    // o pg.Pool emite 'error' sem forma padrão de recuperação.
    // Resetamos o pool para que a próxima request crie um novo.
    pool.on('error', (err) => {
      console.error('[postgres] pool error — resetting pool:', err.message);
      global.omninotePostgresPool = undefined;
    });

    pool.on('connect', () => {
      // Define timeout para este client quando conectar
      if (pool._clients && pool._clients.length > 0) {
        const client = pool._clients[pool._clients.length - 1];
        if (client && !client._connectionTimeoutId) {
          // Client conectado com sucesso
        }
      }
    });

    global.omninotePostgresPool = pool;
  }

  return global.omninotePostgresPool;
}