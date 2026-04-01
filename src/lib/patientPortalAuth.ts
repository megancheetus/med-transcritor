import { compare, hash } from 'bcryptjs';
import { initializePatientsTable } from '@/lib/patientManager';
import { getPostgresPool } from '@/lib/postgres';

export interface PatientPortalUser {
  id: string;
  username: string;
  nomeCompleto: string;
  cpf: string;
  email: string | null;
  telefone: string | null;
}

export interface ProfessionalPatientPortalAccount {
  patientId: string;
  nomeCompleto: string;
  email: string | null;
  telefone: string | null;
  portalAccountCreatedAt: string;
  lastLoginAt: string | null;
}

export interface ProfessionalPatientPortalSummary {
  totalPatients: number;
  patientsWithPortalAccount: number;
  patientsWithoutPortalAccount: number;
}

function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, '');
}

function mapPatientRow(row: {
  patient_id: string;
  username: string;
  nome_completo: string;
  email: string | null;
  telefone: string | null;
  cpf_normalized: string;
}): PatientPortalUser {
  return {
    id: row.patient_id,
    username: row.username,
    nomeCompleto: row.nome_completo,
    cpf: row.cpf_normalized,
    email: row.email,
    telefone: row.telefone,
  };
}

export async function ensurePatientPortalAccountsTable(): Promise<void> {
  await initializePatientsTable();

  const pool = getPostgresPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS patient_portal_accounts (
      patient_id UUID PRIMARY KEY REFERENCES patients(id) ON DELETE CASCADE,
      cpf VARCHAR(14) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_patient_portal_accounts_cpf
    ON patient_portal_accounts(cpf)
  `);
}

export async function setPatientFirstAccessPassword(cpfInput: string, password: string): Promise<PatientPortalUser> {
  const cpf = normalizeCpf(cpfInput);
  if (cpf.length !== 11) {
    throw new Error('INVALID_CPF');
  }

  if (password.length < 8) {
    throw new Error('WEAK_PASSWORD');
  }

  await ensurePatientPortalAccountsTable();

  const pool = getPostgresPool();

  const patientLookup = await pool.query(
    `
      SELECT
        p.id AS patient_id,
        p.username,
        p.nome_completo,
        p.email,
        p.telefone,
        regexp_replace(p.cpf, '[^0-9]', '', 'g') AS cpf_normalized
      FROM patients p
      WHERE regexp_replace(p.cpf, '[^0-9]', '', 'g') = $1
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT 2
    `,
    [cpf]
  );

  if (!patientLookup.rowCount) {
    throw new Error('PATIENT_NOT_FOUND');
  }

  if ((patientLookup.rowCount ?? 0) > 1) {
    throw new Error('CPF_AMBIGUOUS');
  }

  const patientRow = patientLookup.rows[0] as {
    patient_id: string;
    username: string;
    nome_completo: string;
    email: string | null;
    telefone: string | null;
    cpf_normalized: string;
  };

  const existingAccount = await pool.query(
    'SELECT patient_id FROM patient_portal_accounts WHERE patient_id = $1 OR cpf = $2 LIMIT 1',
    [patientRow.patient_id, cpf]
  );

  if ((existingAccount.rowCount ?? 0) > 0) {
    throw new Error('PASSWORD_ALREADY_SET');
  }

  const passwordHash = await hash(password, 12);
  await pool.query(
    `
      INSERT INTO patient_portal_accounts (patient_id, cpf, password_hash)
      VALUES ($1, $2, $3)
    `,
    [patientRow.patient_id, cpf, passwordHash]
  );

  return mapPatientRow(patientRow);
}

export async function authenticatePatientByCpf(cpfInput: string, password: string): Promise<PatientPortalUser> {
  const cpf = normalizeCpf(cpfInput);
  if (cpf.length !== 11) {
    throw new Error('INVALID_CREDENTIALS');
  }

  await ensurePatientPortalAccountsTable();

  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT
        p.id AS patient_id,
        p.username,
        p.nome_completo,
        p.email,
        p.telefone,
        regexp_replace(p.cpf, '[^0-9]', '', 'g') AS cpf_normalized,
        a.password_hash
      FROM patients p
      LEFT JOIN patient_portal_accounts a ON a.patient_id = p.id
      WHERE regexp_replace(p.cpf, '[^0-9]', '', 'g') = $1
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT 2
    `,
    [cpf]
  );

  if (!result.rowCount) {
    throw new Error('INVALID_CREDENTIALS');
  }

  if ((result.rowCount ?? 0) > 1) {
    throw new Error('CPF_AMBIGUOUS');
  }

  const row = result.rows[0] as {
    patient_id: string;
    username: string;
    nome_completo: string;
    email: string | null;
    telefone: string | null;
    cpf_normalized: string;
    password_hash: string | null;
  };

  if (!row.password_hash) {
    throw new Error('FIRST_ACCESS_REQUIRED');
  }

  const passwordMatches = await compare(password, row.password_hash);
  if (!passwordMatches) {
    throw new Error('INVALID_CREDENTIALS');
  }

  await pool.query(
    'UPDATE patient_portal_accounts SET last_login_at = NOW(), updated_at = NOW() WHERE patient_id = $1',
    [row.patient_id]
  );

  return mapPatientRow(row);
}

export async function getPatientPortalUserById(patientId: string): Promise<PatientPortalUser | null> {
  await ensurePatientPortalAccountsTable();

  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT
        p.id AS patient_id,
        p.username,
        p.nome_completo,
        p.email,
        p.telefone,
        regexp_replace(p.cpf, '[^0-9]', '', 'g') AS cpf_normalized
      FROM patients p
      INNER JOIN patient_portal_accounts a ON a.patient_id = p.id
      WHERE p.id = $1
      LIMIT 1
    `,
    [patientId]
  );

  if (!result.rowCount) {
    return null;
  }

  return mapPatientRow(
    result.rows[0] as {
      patient_id: string;
      username: string;
      nome_completo: string;
      email: string | null;
      telefone: string | null;
      cpf_normalized: string;
    }
  );
}

export async function listPatientPortalAccountsByProfessional(
  username: string
): Promise<{
  accounts: ProfessionalPatientPortalAccount[];
  summary: ProfessionalPatientPortalSummary;
}> {
  await ensurePatientPortalAccountsTable();

  const pool = getPostgresPool();

  const summaryResult = await pool.query(
    `
      SELECT
        COUNT(*)::int AS total_patients,
        COUNT(a.patient_id)::int AS patients_with_portal_account
      FROM patients p
      LEFT JOIN patient_portal_accounts a ON a.patient_id = p.id
      WHERE p.username = $1
    `,
    [username]
  );

  const summaryRow = summaryResult.rows[0] as {
    total_patients: number;
    patients_with_portal_account: number;
  };

  const accountsResult = await pool.query(
    `
      SELECT
        p.id AS patient_id,
        p.nome_completo,
        p.email,
        p.telefone,
        a.created_at AS portal_account_created_at,
        a.last_login_at
      FROM patients p
      INNER JOIN patient_portal_accounts a ON a.patient_id = p.id
      WHERE p.username = $1
      ORDER BY COALESCE(a.last_login_at, a.created_at) DESC
    `,
    [username]
  );

  const accounts = accountsResult.rows.map((row) => {
    const typedRow = row as {
      patient_id: string;
      nome_completo: string;
      email: string | null;
      telefone: string | null;
      portal_account_created_at: string | Date;
      last_login_at: string | Date | null;
    };

    return {
      patientId: typedRow.patient_id,
      nomeCompleto: typedRow.nome_completo,
      email: typedRow.email,
      telefone: typedRow.telefone,
      portalAccountCreatedAt: new Date(typedRow.portal_account_created_at).toISOString(),
      lastLoginAt: typedRow.last_login_at ? new Date(typedRow.last_login_at).toISOString() : null,
    } satisfies ProfessionalPatientPortalAccount;
  });

  const patientsWithPortalAccount = summaryRow?.patients_with_portal_account ?? 0;
  const totalPatients = summaryRow?.total_patients ?? 0;

  return {
    accounts,
    summary: {
      totalPatients,
      patientsWithPortalAccount,
      patientsWithoutPortalAccount: Math.max(totalPatients - patientsWithPortalAccount, 0),
    },
  };
}