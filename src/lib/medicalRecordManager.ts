import { getPostgresPool } from './postgres';
import { MedicalRecord } from './types';

interface ClinicalData {
  soapSubjetivo?: string;
  soapObjetivo?: string;
  soapAvaliacao?: string;
  soapPlano?: string;
  cid10Codes?: string[];
  medications?: string[];
  allergies?: string[];
  followUpDate?: string;
}

function sanitizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const sanitized = value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return sanitized.length > 0 ? sanitized : undefined;
}

function buildClinicalDataFromRecord(record: Partial<MedicalRecord>): ClinicalData {
  return {
    soapSubjetivo: record.soapSubjetivo?.trim() || undefined,
    soapObjetivo: record.soapObjetivo?.trim() || undefined,
    soapAvaliacao: record.soapAvaliacao?.trim() || undefined,
    soapPlano: record.soapPlano?.trim() || undefined,
    cid10Codes: sanitizeStringArray(record.cid10Codes),
    medications: sanitizeStringArray(record.medications),
    allergies: sanitizeStringArray(record.allergies),
    followUpDate: record.followUpDate?.trim() || undefined,
  };
}

function mapClinicalData(value: unknown): ClinicalData {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const clinicalData = value as Record<string, unknown>;

  return {
    soapSubjetivo:
      typeof clinicalData.soapSubjetivo === 'string'
        ? clinicalData.soapSubjetivo
        : undefined,
    soapObjetivo:
      typeof clinicalData.soapObjetivo === 'string'
        ? clinicalData.soapObjetivo
        : undefined,
    soapAvaliacao:
      typeof clinicalData.soapAvaliacao === 'string'
        ? clinicalData.soapAvaliacao
        : undefined,
    soapPlano:
      typeof clinicalData.soapPlano === 'string'
        ? clinicalData.soapPlano
        : undefined,
    cid10Codes: sanitizeStringArray(clinicalData.cid10Codes),
    medications: sanitizeStringArray(clinicalData.medications),
    allergies: sanitizeStringArray(clinicalData.allergies),
    followUpDate:
      typeof clinicalData.followUpDate === 'string'
        ? clinicalData.followUpDate
        : undefined,
  };
}

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
        clinical_data JSONB,
        source_type VARCHAR(32) NOT NULL DEFAULT 'manual',
        source_ref_id TEXT,
        ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
        clinician_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
        reviewed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
        FOREIGN KEY (username) REFERENCES app_users(username) ON DELETE CASCADE
      );

      ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS source_type VARCHAR(32) NOT NULL DEFAULT 'manual';
      ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS source_ref_id TEXT;
      ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS clinician_reviewed BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
      ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS clinical_data JSONB;

      CREATE INDEX IF NOT EXISTS idx_medical_records_patient ON medical_records(patient_id);
      CREATE INDEX IF NOT EXISTS idx_medical_records_username ON medical_records(username);
      CREATE INDEX IF NOT EXISTS idx_medical_records_data ON medical_records(data DESC);
      CREATE INDEX IF NOT EXISTS idx_medical_records_clinical_data_gin ON medical_records USING GIN (clinical_data);
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
    const clinicalData = buildClinicalDataFromRecord(recordData);

    const result = await client.query(
      `INSERT INTO medical_records (
        patient_id, username, data, tipo_documento, profissional, 
        especialidade, conteudo, resumo, source_type, source_ref_id,
        ai_generated, clinician_reviewed, reviewed_at, clinical_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
      RETURNING id, data, tipo_documento, profissional, especialidade, 
                conteudo, resumo, source_type, source_ref_id,
        ai_generated, clinician_reviewed, reviewed_at, clinical_data`,
      [
        patientId,
        username,
        recordData.data,
        recordData.tipoDocumento,
        recordData.profissional,
        recordData.especialidade,
        recordData.conteudo,
        recordData.resumo || null,
        recordData.sourceType || 'manual',
        recordData.sourceRefId || null,
        recordData.aiGenerated || false,
        recordData.clinicianReviewed || false,
        recordData.reviewedAt || null,
        JSON.stringify(clinicalData),
      ]
    );

    const row = result.rows[0];
    const mappedClinicalData = mapClinicalData(row.clinical_data);

    return {
      id: row.id,
      patientId,
      data: row.data,
      tipoDocumento: row.tipo_documento,
      profissional: row.profissional,
      especialidade: row.especialidade,
      conteudo: row.conteudo,
      resumo: row.resumo,
      sourceType: row.source_type,
      sourceRefId: row.source_ref_id,
      aiGenerated: row.ai_generated,
      clinicianReviewed: row.clinician_reviewed,
      reviewedAt: row.reviewed_at,
      soapSubjetivo: mappedClinicalData.soapSubjetivo,
      soapObjetivo: mappedClinicalData.soapObjetivo,
      soapAvaliacao: mappedClinicalData.soapAvaliacao,
      soapPlano: mappedClinicalData.soapPlano,
      cid10Codes: mappedClinicalData.cid10Codes,
      medications: mappedClinicalData.medications,
      allergies: mappedClinicalData.allergies,
      followUpDate: mappedClinicalData.followUpDate,
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
              conteudo, resumo, source_type, source_ref_id,
              ai_generated, clinician_reviewed, reviewed_at, clinical_data
       FROM medical_records
       WHERE patient_id = $1 AND username = $2
       ORDER BY data DESC`,
      [patientId, username]
    );

    return result.rows.map((row) => {
      const mappedClinicalData = mapClinicalData(row.clinical_data);

      return {
        id: row.id,
        patientId,
        data: row.data,
        tipoDocumento: row.tipo_documento,
        profissional: row.profissional,
        especialidade: row.especialidade,
        conteudo: row.conteudo,
        resumo: row.resumo,
        sourceType: row.source_type,
        sourceRefId: row.source_ref_id,
        aiGenerated: row.ai_generated,
        clinicianReviewed: row.clinician_reviewed,
        reviewedAt: row.reviewed_at,
        soapSubjetivo: mappedClinicalData.soapSubjetivo,
        soapObjetivo: mappedClinicalData.soapObjetivo,
        soapAvaliacao: mappedClinicalData.soapAvaliacao,
        soapPlano: mappedClinicalData.soapPlano,
        cid10Codes: mappedClinicalData.cid10Codes,
        medications: mappedClinicalData.medications,
        allergies: mappedClinicalData.allergies,
        followUpDate: mappedClinicalData.followUpDate,
      };
    });
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
              especialidade, conteudo, resumo, source_type, source_ref_id,
              ai_generated, clinician_reviewed, reviewed_at, clinical_data
       FROM medical_records
       WHERE id = $1 AND username = $2`,
      [id, username]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const mappedClinicalData = mapClinicalData(row.clinical_data);

    return {
      id: row.id,
      patientId: row.patient_id,
      data: row.data,
      tipoDocumento: row.tipo_documento,
      profissional: row.profissional,
      especialidade: row.especialidade,
      conteudo: row.conteudo,
      resumo: row.resumo,
      sourceType: row.source_type,
      sourceRefId: row.source_ref_id,
      aiGenerated: row.ai_generated,
      clinicianReviewed: row.clinician_reviewed,
      reviewedAt: row.reviewed_at,
      soapSubjetivo: mappedClinicalData.soapSubjetivo,
      soapObjetivo: mappedClinicalData.soapObjetivo,
      soapAvaliacao: mappedClinicalData.soapAvaliacao,
      soapPlano: mappedClinicalData.soapPlano,
      cid10Codes: mappedClinicalData.cid10Codes,
      medications: mappedClinicalData.medications,
      allergies: mappedClinicalData.allergies,
      followUpDate: mappedClinicalData.followUpDate,
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
    if (recordData.sourceType !== undefined) {
      updateFields.push(`source_type = $${paramIndex++}`);
      values.push(recordData.sourceType);
    }
    if (recordData.sourceRefId !== undefined) {
      updateFields.push(`source_ref_id = $${paramIndex++}`);
      values.push(recordData.sourceRefId);
    }
    if (recordData.aiGenerated !== undefined) {
      updateFields.push(`ai_generated = $${paramIndex++}`);
      values.push(recordData.aiGenerated);
    }
    if (recordData.clinicianReviewed !== undefined) {
      updateFields.push(`clinician_reviewed = $${paramIndex++}`);
      values.push(recordData.clinicianReviewed);
    }
    if (recordData.reviewedAt !== undefined) {
      updateFields.push(`reviewed_at = $${paramIndex++}`);
      values.push(recordData.reviewedAt);
    }

    const clinicalDataPatch: ClinicalData = {};

    if (recordData.soapSubjetivo !== undefined) {
      clinicalDataPatch.soapSubjetivo = recordData.soapSubjetivo;
    }
    if (recordData.soapObjetivo !== undefined) {
      clinicalDataPatch.soapObjetivo = recordData.soapObjetivo;
    }
    if (recordData.soapAvaliacao !== undefined) {
      clinicalDataPatch.soapAvaliacao = recordData.soapAvaliacao;
    }
    if (recordData.soapPlano !== undefined) {
      clinicalDataPatch.soapPlano = recordData.soapPlano;
    }
    if (recordData.cid10Codes !== undefined) {
      clinicalDataPatch.cid10Codes = recordData.cid10Codes;
    }
    if (recordData.medications !== undefined) {
      clinicalDataPatch.medications = recordData.medications;
    }
    if (recordData.allergies !== undefined) {
      clinicalDataPatch.allergies = recordData.allergies;
    }
    if (recordData.followUpDate !== undefined) {
      clinicalDataPatch.followUpDate = recordData.followUpDate;
    }

    if (Object.keys(clinicalDataPatch).length > 0) {
      updateFields.push(
        `clinical_data = COALESCE(clinical_data, '{}'::jsonb) || $${paramIndex++}::jsonb`
      );
      values.push(JSON.stringify(clinicalDataPatch));
    }

    if (updateFields.length === 0) {
      return getMedicalRecordById(id, username);
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    const query = `UPDATE medical_records
                   SET ${updateFields.join(', ')}
                   WHERE id = $1 AND username = $2
                   RETURNING id, patient_id, data, tipo_documento, 
                             profissional, especialidade, conteudo, resumo,
                             source_type, source_ref_id, ai_generated,
                             clinician_reviewed, reviewed_at, clinical_data`;

    const result = await client.query(query, values);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const mappedClinicalData = mapClinicalData(row.clinical_data);

    return {
      id: row.id,
      patientId: row.patient_id,
      data: row.data,
      tipoDocumento: row.tipo_documento,
      profissional: row.profissional,
      especialidade: row.especialidade,
      conteudo: row.conteudo,
      resumo: row.resumo,
      sourceType: row.source_type,
      sourceRefId: row.source_ref_id,
      aiGenerated: row.ai_generated,
      clinicianReviewed: row.clinician_reviewed,
      reviewedAt: row.reviewed_at,
      soapSubjetivo: mappedClinicalData.soapSubjetivo,
      soapObjetivo: mappedClinicalData.soapObjetivo,
      soapAvaliacao: mappedClinicalData.soapAvaliacao,
      soapPlano: mappedClinicalData.soapPlano,
      cid10Codes: mappedClinicalData.cid10Codes,
      medications: mappedClinicalData.medications,
      allergies: mappedClinicalData.allergies,
      followUpDate: mappedClinicalData.followUpDate,
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
