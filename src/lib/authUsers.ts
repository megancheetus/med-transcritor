import { compare, hash } from 'bcryptjs';
import { getPostgresPool } from '@/lib/postgres';

interface EnvAuthUser {
  username: string;
  password: string;
}

export interface AppUserRecord {
  username: string;
  fullName: string | null;
  email: string | null;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

let usersTableReadyPromise: Promise<void> | null = null;
let envUsersSeededPromise: Promise<void> | null = null;

function normalizeUsername(username: string): string {
  return username.trim();
}

function normalizeNullableString(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function mapUserRow(row: {
  username: string;
  full_name: string | null;
  email: string | null;
  is_admin: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  last_login_at: Date | string | null;
}): AppUserRecord {
  return {
    username: row.username,
    fullName: row.full_name,
    email: row.email,
    isAdmin: row.is_admin,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at).toISOString() : null,
  };
}

function parseEnvUsers(): EnvAuthUser[] {
  if (process.env.NODE_ENV === 'production') {
    return [];
  }

  const authUsersJson = process.env.AUTH_USERS;

  if (!authUsersJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(authUsersJson) as EnvAuthUser[];
    return parsed
      .filter(
        (user) => typeof user.username === 'string' && user.username.trim().length > 0 && typeof user.password === 'string'
      )
      .map((user) => ({
        username: normalizeUsername(user.username),
        password: user.password,
      }));
  } catch {
    throw new Error('Configuração de usuários inválida');
  }
}

async function ensureUsersTable(): Promise<void> {
  if (!usersTableReadyPromise) {
    usersTableReadyPromise = (async () => {
      const pool = getPostgresPool();
      
      try {
        // Criar tabela com todas as colunas de uma vez
        await pool.query(`
          CREATE TABLE IF NOT EXISTS app_users (
            username TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            full_name TEXT,
            email TEXT,
            is_admin BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_login_at TIMESTAMPTZ
          )
        `);

        // Criar índice de forma segura
        await pool.query(`
          CREATE UNIQUE INDEX IF NOT EXISTS app_users_email_lower_unique 
          ON app_users (LOWER(email)) 
          WHERE email IS NOT NULL
        `);
      } catch (error) {
        // Se falhar, reseta a promise para tentar novamente
        usersTableReadyPromise = null;
        throw error;
      }
    })();
  }

  return usersTableReadyPromise;
}

async function hasAnyAdminUsers(): Promise<boolean> {
  const pool = getPostgresPool();
  const result = await pool.query('SELECT 1 FROM app_users WHERE is_admin = TRUE LIMIT 1');
  return (result.rowCount ?? 0) > 0;
}

async function ensureAdminUserExists(preferredUsername: string): Promise<void> {
  if (await hasAnyAdminUsers()) {
    return;
  }

  const username = normalizeUsername(preferredUsername);
  if (!username) {
    return;
  }

  const pool = getPostgresPool();
  await pool.query(
    'UPDATE app_users SET is_admin = TRUE, updated_at = NOW() WHERE username = $1',
    [username]
  );
}

async function seedUsersFromEnv(): Promise<void> {
  if (!envUsersSeededPromise) {
    envUsersSeededPromise = (async () => {
      // ensureUsersTable já foi chamada pelo caller
      const envUsers = parseEnvUsers();
      if (envUsers.length === 0) {
        return;
      }

      const pool = getPostgresPool();
      const preferredAdminUsername = normalizeUsername(process.env.AUTH_ADMIN_USERNAME || envUsers[0]?.username || '');

      for (const user of envUsers) {
        const existingUser = await pool.query('SELECT username FROM app_users WHERE username = $1 LIMIT 1', [user.username]);

        if (existingUser.rowCount && existingUser.rowCount > 0) {
          continue;
        }

        const passwordHash = await hash(user.password, 12);
        await pool.query(
          `
            INSERT INTO app_users (username, password_hash, is_admin)
            VALUES ($1, $2, $3)
            ON CONFLICT (username) DO NOTHING
          `,
          [user.username, passwordHash, user.username === preferredAdminUsername]
        );
      }

      await ensureAdminUserExists(preferredAdminUsername);
    })().catch((error) => {
      envUsersSeededPromise = null;
      throw error;
    });
  }

  return envUsersSeededPromise;
}

export async function authenticateUser(username: string, password: string): Promise<boolean> {
  // Apenas uma chamada a ensureUsersTable para evitar race conditions
  await ensureUsersTable();
  
  // Seed não precisa chamar ensureUsersTable novamente
  const pool = getPostgresPool();
  
  // Verificar se há usuários. Se não há, fazer seed (apenas uma vez na vida)
  const existingUsersResult = await pool.query('SELECT COUNT(*)::int as count FROM app_users');
  if (existingUsersResult.rows[0]?.count === 0) {
    await seedUsersFromEnv();
  }

  const normalizedUsername = normalizeUsername(username);
  const result = await pool.query('SELECT username, password_hash FROM app_users WHERE username = $1 LIMIT 1', [
    normalizedUsername,
  ]);

  if (!result.rowCount) {
    return false;
  }

  const user = result.rows[0] as { username: string; password_hash: string };
  const passwordMatches = await compare(password, user.password_hash);

  if (!passwordMatches) {
    return false;
  }

  await ensureAdminUserExists(user.username);
  await pool.query('UPDATE app_users SET last_login_at = NOW(), updated_at = NOW() WHERE username = $1', [user.username]);
  return true;
}

export async function getUserByUsername(username: string): Promise<AppUserRecord | null> {
  await ensureUsersTable();

  const normalizedUsername = normalizeUsername(username);
  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT username, full_name, email, is_admin, created_at, updated_at, last_login_at
      FROM app_users
      WHERE username = $1
      LIMIT 1
    `,
    [normalizedUsername]
  );

  if (!result.rowCount) {
    return null;
  }

  return mapUserRow(result.rows[0] as {
    username: string;
    full_name: string | null;
    email: string | null;
    is_admin: boolean;
    created_at: Date | string;
    updated_at: Date | string;
    last_login_at: Date | string | null;
  });
}

export async function listUsers(): Promise<AppUserRecord[]> {
  await ensureUsersTable();

  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT username, full_name, email, is_admin, created_at, updated_at, last_login_at
    FROM app_users
    ORDER BY is_admin DESC, username ASC
  `);

  return result.rows.map((row) =>
    mapUserRow(row as {
      username: string;
      full_name: string | null;
      email: string | null;
      is_admin: boolean;
      created_at: Date | string;
      updated_at: Date | string;
      last_login_at: Date | string | null;
    })
  );
}

export async function createUser(params: {
  username: string;
  password: string;
  fullName?: string | null;
  email?: string | null;
  isAdmin?: boolean;
}): Promise<AppUserRecord> {
  await ensureUsersTable();

  const username = normalizeUsername(params.username);
  const passwordHash = await hash(params.password, 12);
  const fullName = normalizeNullableString(params.fullName);
  const email = normalizeNullableString(params.email)?.toLowerCase() ?? null;
  const desiredAdmin = params.isAdmin === true || !(await hasAnyAdminUsers());
  const pool = getPostgresPool();

  const result = await pool.query(
    `
      INSERT INTO app_users (username, password_hash, full_name, email, is_admin)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING username, full_name, email, is_admin, created_at, updated_at, last_login_at
    `,
    [username, passwordHash, fullName, email, desiredAdmin]
  );

  return mapUserRow(result.rows[0] as {
    username: string;
    full_name: string | null;
    email: string | null;
    is_admin: boolean;
    created_at: Date | string;
    updated_at: Date | string;
    last_login_at: Date | string | null;
  });
}

export async function updateUserPassword(username: string, newPassword: string): Promise<void> {
  await ensureUsersTable();

  const normalizedUsername = normalizeUsername(username);
  const passwordHash = await hash(newPassword, 12);
  const pool = getPostgresPool();
  const result = await pool.query('UPDATE app_users SET password_hash = $2, updated_at = NOW() WHERE username = $1', [
    normalizedUsername,
    passwordHash,
  ]);

  if (!result.rowCount) {
    throw new Error('USER_NOT_FOUND');
  }
}

export async function deleteUser(username: string): Promise<void> {
  await ensureUsersTable();

  const normalizedUsername = normalizeUsername(username);
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query('SELECT is_admin FROM app_users WHERE username = $1 LIMIT 1', [
      normalizedUsername,
    ]);

    if (!userResult.rowCount) {
      throw new Error('USER_NOT_FOUND');
    }

    const user = userResult.rows[0] as { is_admin: boolean };

    if (user.is_admin) {
      const adminsCountResult = await client.query('SELECT COUNT(*)::int AS total FROM app_users WHERE is_admin = TRUE');
      const totalAdmins = Number((adminsCountResult.rows[0] as { total: number }).total || 0);

      if (totalAdmins <= 1) {
        throw new Error('LAST_ADMIN');
      }
    }

    await client.query('DELETE FROM transcription_history WHERE username = $1', [normalizedUsername]);
    await client.query('DELETE FROM app_users WHERE username = $1', [normalizedUsername]);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function ensureAuthBootstrap(): Promise<void> {
  await ensureUsersTable();
  await seedUsersFromEnv();
}
