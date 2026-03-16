import { getPostgresPool } from './postgres';
import { Patient } from './types';

/**
 * Garante que a tabela de usuários existe
 * Precisa ser chamado antes de usar a tabela de pacientes
 */
async function ensureUsersTableExists(): Promise<void> {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    // Criar tabela de usuários se não existir
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_users (
        username TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL,
        full_name TEXT,
        email TEXT,
        is_admin BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_login_at TIMESTAMPTZ
      );
    `);
  } finally {
    client.release();
  }
}

/**
 * Inicializa a tabela de pacientes se não existir
 */
export async function initializePatientsTable(): Promise<void> {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    // Primeiro garante que a tabela de usuários existe
    await ensureUsersTableExists();

    await client.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) NOT NULL,
        nome VARCHAR(255) NOT NULL,
        nome_completo VARCHAR(255) NOT NULL,
        idade INTEGER NOT NULL,
        sexo CHAR(1) NOT NULL CHECK (sexo IN ('M', 'F', 'O')),
        cpf VARCHAR(14) NOT NULL,
        data_nascimento DATE NOT NULL,
        telefone VARCHAR(20),
        email VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(username, cpf),
        FOREIGN KEY (username) REFERENCES app_users(username) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_patients_username ON patients(username);
      CREATE INDEX IF NOT EXISTS idx_patients_cpf ON patients(cpf);
    `);
  } finally {
    client.release();
  }
}

/**
 * Cria um novo paciente para o usuário
 */
export async function createPatient(
  username: string,
  patientData: Omit<Patient, 'id'>
): Promise<Patient> {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `INSERT INTO patients (
        username, nome, nome_completo, idade, sexo, cpf, 
        data_nascimento, telefone, email
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, nome, nome_completo, idade, sexo, cpf, 
                data_nascimento, telefone, email`,
      [
        username,
        patientData.nome,
        patientData.nomeCompleto,
        patientData.idade,
        patientData.sexo === 'Outro' ? 'O' : patientData.sexo,
        patientData.cpf,
        patientData.dataNascimento,
        patientData.telefone || null,
        patientData.email || null,
      ]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      nome: row.nome,
      nomeCompleto: row.nome_completo,
      idade: row.idade,
      sexo: row.sexo === 'O' ? 'Outro' : row.sexo,
      cpf: row.cpf,
      dataNascimento: row.data_nascimento,
      telefone: row.telefone,
      email: row.email,
    };
  } finally {
    client.release();
  }
}

/**
 * Obtém todos os pacientes de um usuário
 */
export async function getPatientsByUsername(username: string): Promise<Patient[]> {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT id, nome, nome_completo, idade, sexo, cpf, 
              data_nascimento, telefone, email
       FROM patients
       WHERE username = $1
       ORDER BY created_at DESC`,
      [username]
    );

    return result.rows.map((row) => ({
      id: row.id,
      nome: row.nome,
      nomeCompleto: row.nome_completo,
      idade: row.idade,
      sexo: row.sexo === 'O' ? 'Outro' : row.sexo,
      cpf: row.cpf,
      dataNascimento: row.data_nascimento,
      telefone: row.telefone,
      email: row.email,
    }));
  } finally {
    client.release();
  }
}

/**
 * Obtém um paciente específico
 */
export async function getPatientById(id: string, username: string): Promise<Patient | null> {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT id, nome, nome_completo, idade, sexo, cpf, 
              data_nascimento, telefone, email
       FROM patients
       WHERE id = $1 AND username = $2`,
      [id, username]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      nome: row.nome,
      nomeCompleto: row.nome_completo,
      idade: row.idade,
      sexo: row.sexo === 'O' ? 'Outro' : row.sexo,
      cpf: row.cpf,
      dataNascimento: row.data_nascimento,
      telefone: row.telefone,
      email: row.email,
    };
  } finally {
    client.release();
  }
}

/**
 * Atualiza um paciente
 */
export async function updatePatient(
  id: string,
  username: string,
  patientData: Partial<Omit<Patient, 'id'>>
): Promise<Patient | null> {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    // Build dynamic update query
    const updateFields = [];
    const values: any[] = [id, username];
    let paramIndex = 3;

    if (patientData.nome !== undefined) {
      updateFields.push(`nome = $${paramIndex++}`);
      values.push(patientData.nome);
    }
    if (patientData.nomeCompleto !== undefined) {
      updateFields.push(`nome_completo = $${paramIndex++}`);
      values.push(patientData.nomeCompleto);
    }
    if (patientData.idade !== undefined) {
      updateFields.push(`idade = $${paramIndex++}`);
      values.push(patientData.idade);
    }
    if (patientData.sexo !== undefined) {
      updateFields.push(`sexo = $${paramIndex++}`);
      values.push(patientData.sexo === 'Outro' ? 'O' : patientData.sexo);
    }
    if (patientData.cpf !== undefined) {
      updateFields.push(`cpf = $${paramIndex++}`);
      values.push(patientData.cpf);
    }
    if (patientData.dataNascimento !== undefined) {
      updateFields.push(`data_nascimento = $${paramIndex++}`);
      values.push(patientData.dataNascimento);
    }
    if (patientData.telefone !== undefined) {
      updateFields.push(`telefone = $${paramIndex++}`);
      values.push(patientData.telefone);
    }
    if (patientData.email !== undefined) {
      updateFields.push(`email = $${paramIndex++}`);
      values.push(patientData.email);
    }

    if (updateFields.length === 0) {
      return getPatientById(id, username);
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    const query = `UPDATE patients
                   SET ${updateFields.join(', ')}
                   WHERE id = $1 AND username = $2
                   RETURNING id, nome, nome_completo, idade, sexo, cpf, 
                             data_nascimento, telefone, email`;

    const result = await client.query(query, values);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      nome: row.nome,
      nomeCompleto: row.nome_completo,
      idade: row.idade,
      sexo: row.sexo === 'O' ? 'Outro' : row.sexo,
      cpf: row.cpf,
      dataNascimento: row.data_nascimento,
      telefone: row.telefone,
      email: row.email,
    };
  } finally {
    client.release();
  }
}

/**
 * Deleta um paciente
 */
export async function deletePatient(id: string, username: string): Promise<boolean> {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `DELETE FROM patients WHERE id = $1 AND username = $2`,
      [id, username]
    );

    return result.rowCount ? result.rowCount > 0 : false;
  } finally {
    client.release();
  }
}
