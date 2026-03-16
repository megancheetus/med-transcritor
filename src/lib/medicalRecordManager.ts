import { getPostgresPool } from './postgres';
import { MedicalRecord } from './types';

/**
 * Inicializa a tabela de registros médicos se não existir
 */
export async function initializeMedicalRecordsTable(): Promise<void> {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS medical_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL,
        username VARCHAR(255) NOT NULL,
        data DATE NOT NULL,
        tipo_documento VARCHAR(50) NOT NULL,
        profissional VARCHAR(255) NOT NULL,
        especialidade VARCHAR(255) NOT NULL,
        conteudo TEXT NOT NULL,
        resumo TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
        FOREIGN KEY (username) REFERENCES app_users(username) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_medical_records_patient ON medical_records(patient_id);
      CREATE INDEX IF NOT EXISTS idx_medical_records_username ON medical_records(username);
      CREATE INDEX IF NOT EXISTS idx_medical_records_data ON medical_records(data DESC);
    `);
  } finally {
    client.release();
  }
}

/**
 * Cria um novo registro médico
 */
export async function createMedicalRecord(
  patientId: string,
  username: string,
  recordData: Omit<MedicalRecord, 'id'>
): Promise<MedicalRecord> {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `INSERT INTO medical_records (
        patient_id, username, data, tipo_documento, profissional, 
        especialidade, conteudo, resumo
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, data, tipo_documento, profissional, especialidade, 
                conteudo, resumo`,
      [
        patientId,
        username,
        recordData.data,
        recordData.tipoDocumento,
        recordData.profissional,
        recordData.especialidade,
        recordData.conteudo,
        recordData.resumo || null,
      ]
    );

    const row = result.rows[0];
    return {
      id: row.id,
      patientId,
      data: row.data,
      tipoDocumento: row.tipo_documento,
      profissional: row.profissional,
      especialidade: row.especialidade,
      conteudo: row.conteudo,
      resumo: row.resumo,
    };
  } finally {
    client.release();
  }
}

/**
 * Obtém todos os registros médicos de um paciente
 */
export async function getMedicalRecordsByPatient(
  patientId: string,
  username: string
): Promise<MedicalRecord[]> {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT id, data, tipo_documento, profissional, especialidade, 
              conteudo, resumo
       FROM medical_records
       WHERE patient_id = $1 AND username = $2
       ORDER BY data DESC`,
      [patientId, username]
    );

    return result.rows.map((row) => ({
      id: row.id,
      patientId,
      data: row.data,
      tipoDocumento: row.tipo_documento,
      profissional: row.profissional,
      especialidade: row.especialidade,
      conteudo: row.conteudo,
      resumo: row.resumo,
    }));
  } finally {
    client.release();
  }
}

/**
 * Obtém um registro médico específico
 */
export async function getMedicalRecordById(
  id: string,
  username: string
): Promise<MedicalRecord | null> {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT id, patient_id, data, tipo_documento, profissional, 
              especialidade, conteudo, resumo
       FROM medical_records
       WHERE id = $1 AND username = $2`,
      [id, username]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      patientId: row.patient_id,
      data: row.data,
      tipoDocumento: row.tipo_documento,
      profissional: row.profissional,
      especialidade: row.especialidade,
      conteudo: row.conteudo,
      resumo: row.resumo,
    };
  } finally {
    client.release();
  }
}

/**
 * Atualiza um registro médico
 */
export async function updateMedicalRecord(
  id: string,
  username: string,
  recordData: Partial<Omit<MedicalRecord, 'id' | 'patientId'>>
): Promise<MedicalRecord | null> {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    const updateFields = [];
    const values: any[] = [id, username];
    let paramIndex = 3;

    if (recordData.data !== undefined) {
      updateFields.push(`data = $${paramIndex++}`);
      values.push(recordData.data);
    }
    if (recordData.tipoDocumento !== undefined) {
      updateFields.push(`tipo_documento = $${paramIndex++}`);
      values.push(recordData.tipoDocumento);
    }
    if (recordData.profissional !== undefined) {
      updateFields.push(`profissional = $${paramIndex++}`);
      values.push(recordData.profissional);
    }
    if (recordData.especialidade !== undefined) {
      updateFields.push(`especialidade = $${paramIndex++}`);
      values.push(recordData.especialidade);
    }
    if (recordData.conteudo !== undefined) {
      updateFields.push(`conteudo = $${paramIndex++}`);
      values.push(recordData.conteudo);
    }
    if (recordData.resumo !== undefined) {
      updateFields.push(`resumo = $${paramIndex++}`);
      values.push(recordData.resumo);
    }

    if (updateFields.length === 0) {
      return getMedicalRecordById(id, username);
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    const query = `UPDATE medical_records
                   SET ${updateFields.join(', ')}
                   WHERE id = $1 AND username = $2
                   RETURNING id, patient_id, data, tipo_documento, 
                             profissional, especialidade, conteudo, resumo`;

    const result = await client.query(query, values);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      patientId: row.patient_id,
      data: row.data,
      tipoDocumento: row.tipo_documento,
      profissional: row.profissional,
      especialidade: row.especialidade,
      conteudo: row.conteudo,
      resumo: row.resumo,
    };
  } finally {
    client.release();
  }
}

/**
 * Deleta um registro médico
 */
export async function deleteMedicalRecord(id: string, username: string): Promise<boolean> {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `DELETE FROM medical_records WHERE id = $1 AND username = $2`,
      [id, username]
    );

    return result.rowCount ? result.rowCount > 0 : false;
  } finally {
    client.release();
  }
}
