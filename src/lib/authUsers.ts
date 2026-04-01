import { compare, hash } from 'bcryptjs';
import { getPostgresPool } from '@/lib/postgres';
import { randomBytes } from 'crypto';
import {
  AccountPlan,
  ModuleAccess,
  getModuleAccessForPlan,
  normalizeAccountPlan,
} from '@/lib/accountPlan';

interface EnvAuthUser {
  username: string;
  password: string;
}

export interface AppUserRecord {
  username: string;
  fullName: string | null;
  email: string | null;
  isAdmin: boolean;
  accountPlan: AccountPlan;
  trialExpiresAt: string | null;
  trialExpired: boolean;
  emailVerified: boolean;
  emailVerificationRequired: boolean;
  moduleAccess: ModuleAccess;
  dateOfBirth: string | null;
  cpf: string | null;
  specialty: string | null;
  councilNumber: string | null;
  councilState: string | null;
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

function buildTrialExpiryDate(): Date {
  const trialExpiry = new Date();
  trialExpiry.setDate(trialExpiry.getDate() + 3);
  return trialExpiry;
}

function isExpired(dateValue: Date | string): boolean {
  return new Date(dateValue).getTime() <= Date.now();
}

function buildEmailVerificationToken(): string {
  return randomBytes(32).toString('hex');
}

function mapUserRow(row: {
  username: string;
  full_name: string | null;
  email: string | null;
  is_admin: boolean;
  account_plan: string;
  trial_expires_at: Date | string | null;
  email_verified_at: Date | string | null;
  email_verification_required: boolean;
  date_of_birth: string | null;
  cpf: string | null;
  specialty: string | null;
  council_number: string | null;
  council_state: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  last_login_at: Date | string | null;
}): AppUserRecord {
  const accountPlan = normalizeAccountPlan(row.account_plan);
  const trialExpiresAt = row.trial_expires_at ? new Date(row.trial_expires_at).toISOString() : null;
  const trialExpired = accountPlan === 'trial' && !!trialExpiresAt && isExpired(trialExpiresAt);
  return {
    username: row.username,
    fullName: row.full_name,
    email: row.email,
    isAdmin: row.is_admin,
    accountPlan,
    trialExpiresAt,
    trialExpired,
    emailVerified: !!row.email_verified_at,
    emailVerificationRequired: row.email_verification_required,
    dateOfBirth: row.date_of_birth || null,
    cpf: row.cpf || null,
    specialty: row.specialty || null,
    councilNumber: row.council_number || null,
    councilState: row.council_state || null,
    moduleAccess: row.is_admin
      ? {
          transcricao: true,
          teleconsulta: true,
          prontuario: true,
        }
      : getModuleAccessForPlan(accountPlan),
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
            account_plan TEXT NOT NULL DEFAULT 'basic',
            trial_expires_at TIMESTAMPTZ,
            email_verified_at TIMESTAMPTZ,
            email_verification_required BOOLEAN NOT NULL DEFAULT FALSE,
            email_verification_token TEXT,
            email_verification_sent_at TIMESTAMPTZ,
            date_of_birth TEXT,
            cpf TEXT,
            specialty TEXT,
            council_number TEXT,
            council_state TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            last_login_at TIMESTAMPTZ
          )
        `);

        // Migration segura para bancos existentes
        await pool.query(`
          ALTER TABLE app_users
          ADD COLUMN IF NOT EXISTS account_plan TEXT NOT NULL DEFAULT 'basic'
        `);

        await pool.query(`
          ALTER TABLE app_users
          ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ
        `);

        await pool.query(`
          ALTER TABLE app_users
          ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ
        `);

        await pool.query(`
          ALTER TABLE app_users
          ADD COLUMN IF NOT EXISTS email_verification_required BOOLEAN NOT NULL DEFAULT FALSE
        `);

        await pool.query(`
          ALTER TABLE app_users
          ADD COLUMN IF NOT EXISTS email_verification_token TEXT
        `);

        await pool.query(`
          ALTER TABLE app_users
          ADD COLUMN IF NOT EXISTS email_verification_sent_at TIMESTAMPTZ
        `);

        await pool.query(`
          ALTER TABLE app_users
          ADD COLUMN IF NOT EXISTS date_of_birth TEXT
        `);

        await pool.query(`
          ALTER TABLE app_users
          ADD COLUMN IF NOT EXISTS cpf TEXT
        `);

        await pool.query(`
          ALTER TABLE app_users
          ADD COLUMN IF NOT EXISTS specialty TEXT
        `);

        await pool.query(`
          ALTER TABLE app_users
          ADD COLUMN IF NOT EXISTS council_number TEXT
        `);

        await pool.query(`
          ALTER TABLE app_users
          ADD COLUMN IF NOT EXISTS council_state TEXT
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
  const result = await pool.query('SELECT username, password_hash, account_plan, trial_expires_at, email_verification_required, email_verified_at FROM app_users WHERE username = $1 LIMIT 1', [
    normalizedUsername,
  ]);

  if (!result.rowCount) {
    return false;
  }

  const user = result.rows[0] as {
    username: string;
    password_hash: string;
    account_plan: string;
    trial_expires_at: Date | string | null;
    email_verification_required: boolean;
    email_verified_at: Date | string | null;
  };
  const passwordMatches = await compare(password, user.password_hash);

  if (!passwordMatches) {
    return false;
  }

  const accountPlan = normalizeAccountPlan(user.account_plan);
  if (accountPlan === 'trial' && user.trial_expires_at && isExpired(user.trial_expires_at)) {
    throw new Error('TRIAL_EXPIRED');
  }

  if (user.email_verification_required && !user.email_verified_at) {
    throw new Error('EMAIL_NOT_VERIFIED');
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
      , account_plan, trial_expires_at, email_verified_at, email_verification_required
      , date_of_birth, cpf, specialty, council_number, council_state
      FROM app_users
      WHERE username = $1
      LIMIT 1
    `,
    [normalizedUsername]
  );

  if (!result.rowCount) {
    return null;
  }

  return mapUserRow(result.rows[0] as Parameters<typeof mapUserRow>[0]);
}

export async function listUsers(): Promise<AppUserRecord[]> {
  await ensureUsersTable();

  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT username, full_name, email, is_admin, created_at, updated_at, last_login_at
    , account_plan, trial_expires_at, email_verified_at, email_verification_required
    , date_of_birth, cpf, specialty, council_number, council_state
    FROM app_users
    ORDER BY is_admin DESC, username ASC
  `);

  return result.rows.map((row) =>
    mapUserRow(row as Parameters<typeof mapUserRow>[0])
  );
}

export async function createUser(params: {
  username: string;
  password: string;
  fullName?: string | null;
  email?: string | null;
  isAdmin?: boolean;
  accountPlan?: AccountPlan;
  allowBootstrapAdmin?: boolean;
  emailVerificationRequired?: boolean;
  emailVerificationToken?: string;
}): Promise<AppUserRecord> {
  await ensureUsersTable();

  const username = normalizeUsername(params.username);
  const passwordHash = await hash(params.password, 12);
  const fullName = normalizeNullableString(params.fullName);
  const email = normalizeNullableString(params.email)?.toLowerCase() ?? null;
  const allowBootstrapAdmin = params.allowBootstrapAdmin !== false;
  const desiredAdmin = params.isAdmin === true || (allowBootstrapAdmin && !(await hasAnyAdminUsers()));
  const accountPlan = normalizeAccountPlan(params.accountPlan);
  const trialExpiresAt = accountPlan === 'trial' ? buildTrialExpiryDate().toISOString() : null;
  const emailVerificationRequired = params.emailVerificationRequired === true;
  const emailVerificationToken = emailVerificationRequired
    ? params.emailVerificationToken || buildEmailVerificationToken()
    : null;
  const emailVerificationSentAt = emailVerificationRequired ? new Date().toISOString() : null;
  const emailVerifiedAt = emailVerificationRequired ? null : new Date().toISOString();
  const pool = getPostgresPool();

  const result = await pool.query(
    `
      INSERT INTO app_users (
        username,
        password_hash,
        full_name,
        email,
        is_admin,
        account_plan,
        trial_expires_at,
        email_verified_at,
        email_verification_required,
        email_verification_token,
        email_verification_sent_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING username, full_name, email, is_admin, account_plan, trial_expires_at, email_verified_at, email_verification_required, date_of_birth, cpf, specialty, council_number, council_state, created_at, updated_at, last_login_at
    `,
    [
      username,
      passwordHash,
      fullName,
      email,
      desiredAdmin,
      accountPlan,
      trialExpiresAt,
      emailVerifiedAt,
      emailVerificationRequired,
      emailVerificationToken,
      emailVerificationSentAt,
    ]
  );

  return mapUserRow(result.rows[0] as Parameters<typeof mapUserRow>[0]);
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

export async function updateUserAccountPlan(
  username: string,
  accountPlan: AccountPlan
): Promise<AppUserRecord> {
  await ensureUsersTable();

  const normalizedUsername = normalizeUsername(username);
  const normalizedPlan = normalizeAccountPlan(accountPlan);
  const trialExpiresAt = normalizedPlan === 'trial' ? buildTrialExpiryDate().toISOString() : null;
  const pool = getPostgresPool();
  const result = await pool.query(
    `
      UPDATE app_users
      SET account_plan = $2, trial_expires_at = $3, updated_at = NOW()
      WHERE username = $1
      RETURNING username, full_name, email, is_admin, account_plan, trial_expires_at, email_verified_at, email_verification_required, date_of_birth, cpf, specialty, council_number, council_state, created_at, updated_at, last_login_at
    `,
    [normalizedUsername, normalizedPlan, trialExpiresAt]
  );

  if (!result.rowCount) {
    throw new Error('USER_NOT_FOUND');
  }

  return mapUserRow(result.rows[0] as Parameters<typeof mapUserRow>[0]);
}

export async function updateUserProfile(
  username: string,
  profile: {
    fullName?: string | null;
    dateOfBirth?: string | null;
    cpf?: string | null;
    specialty?: string | null;
    councilNumber?: string | null;
    councilState?: string | null;
  }
): Promise<AppUserRecord> {
  await ensureUsersTable();

  const normalizedUsername = normalizeUsername(username);
  const pool = getPostgresPool();
  const result = await pool.query(
    `
      UPDATE app_users
      SET
        full_name = COALESCE($2, full_name),
        date_of_birth = COALESCE($3, date_of_birth),
        cpf = COALESCE($4, cpf),
        specialty = COALESCE($5, specialty),
        council_number = COALESCE($6, council_number),
        council_state = COALESCE($7, council_state),
        updated_at = NOW()
      WHERE username = $1
      RETURNING username, full_name, email, is_admin, account_plan, trial_expires_at, email_verified_at, email_verification_required, date_of_birth, cpf, specialty, council_number, council_state, created_at, updated_at, last_login_at
    `,
    [
      normalizedUsername,
      normalizeNullableString(profile.fullName),
      normalizeNullableString(profile.dateOfBirth),
      normalizeNullableString(profile.cpf),
      normalizeNullableString(profile.specialty),
      normalizeNullableString(profile.councilNumber),
      normalizeNullableString(profile.councilState),
    ]
  );

  if (!result.rowCount) {
    throw new Error('USER_NOT_FOUND');
  }

  return mapUserRow(result.rows[0] as Parameters<typeof mapUserRow>[0]);
}

export async function confirmUserEmailByToken(token: string): Promise<boolean> {
  await ensureUsersTable();

  const normalizedToken = token.trim();
  if (!normalizedToken) {
    return false;
  }

  const pool = getPostgresPool();
  const result = await pool.query(
    `
      UPDATE app_users
      SET
        email_verified_at = NOW(),
        email_verification_required = FALSE,
        email_verification_token = NULL,
        updated_at = NOW()
      WHERE email_verification_token = $1
      RETURNING username
    `,
    [normalizedToken]
  );

  return (result.rowCount ?? 0) > 0;
}

export async function getPendingEmailVerificationToken(username: string): Promise<string | null> {
  await ensureUsersTable();

  const normalizedUsername = normalizeUsername(username);
  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT email_verification_token
      FROM app_users
      WHERE username = $1 AND email_verification_required = TRUE
      LIMIT 1
    `,
    [normalizedUsername]
  );

  if (!result.rowCount) {
    return null;
  }

  const row = result.rows[0] as { email_verification_token: string | null };
  return row.email_verification_token;
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
