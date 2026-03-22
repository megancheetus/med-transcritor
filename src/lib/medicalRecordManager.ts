import { getPostgresPool } from './postgres';
import { MedicalRecord, MedicalRecordVersion } from './types';

interface MedicalRecordAuditInput {
  username: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadataJson?: Record<string, unknown>;
  ipHash?: string;
  userAgent?: string;
}

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

interface MedicalRecordCursorData {
  data: string;
  id: string;
}

export interface MedicalRecordListFilters {
  patientId: string;
  cursor?: string;
  limit?: number;
  tipoDocumento?: MedicalRecord['tipoDocumento'];
  profissional?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface PaginatedMedicalRecordsResult {
  records: MedicalRecord[];
  nextCursor: string | null;
  hasMore: boolean;
}

function encodeMedicalRecordCursor(data: MedicalRecordCursorData): string {
  return Buffer.from(JSON.stringify(data), 'utf-8').toString('base64url');
}

function decodeMedicalRecordCursor(cursor: string): MedicalRecordCursorData | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf-8')
    ) as Partial<MedicalRecordCursorData>;

    if (
      typeof parsed?.data !== 'string' ||
      typeof parsed?.id !== 'string' ||
      !parsed.data ||
      !parsed.id
    ) {
      return null;
    }

    return {
      data: parsed.data,
      id: parsed.id,
    };
  } catch {
    return null;
  }
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

function mapMedicalRecordRow(
  row: {
    id: string;
    patient_id: string;
    data: string;
    tipo_documento: MedicalRecord['tipoDocumento'];
    profissional: string;
    especialidade: string;
    conteudo: string;
    resumo: string | null;
    source_type: MedicalRecord['sourceType'];
    source_ref_id: string | null;
    ai_generated: boolean;
    clinician_reviewed: boolean;
    reviewed_at: string | null;
    clinical_data: unknown;
  }
): MedicalRecord {
  const mappedClinicalData = mapClinicalData(row.clinical_data);

  return {
    id: row.id,
    patientId: row.patient_id,
    data: row.data,
    tipoDocumento: row.tipo_documento,
    profissional: row.profissional,
    especialidade: row.especialidade,
    conteudo: row.conteudo,
    resumo: row.resumo || undefined,
    sourceType: row.source_type,
    sourceRefId: row.source_ref_id || undefined,
    aiGenerated: row.ai_generated,
    clinicianReviewed: row.clinician_reviewed,
    reviewedAt: row.reviewed_at || undefined,
    soapSubjetivo: mappedClinicalData.soapSubjetivo,
    soapObjetivo: mappedClinicalData.soapObjetivo,
    soapAvaliacao: mappedClinicalData.soapAvaliacao,
    soapPlano: mappedClinicalData.soapPlano,
    cid10Codes: mappedClinicalData.cid10Codes,
    medications: mappedClinicalData.medications,
    allergies: mappedClinicalData.allergies,
    followUpDate: mappedClinicalData.followUpDate,
  };
}

function toIsoString(value: Date | string): string {
  return new Date(value).toISOString();
}

function mapMedicalRecordVersionRow(row: {
  id: string;
  medical_record_id: string;
  version_number: number;
  snapshot_json: Record<string, unknown>;
  changed_by: string;
  change_reason: string | null;
  created_at: Date | string;
}): MedicalRecordVersion {
  return {
    id: row.id,
    medicalRecordId: row.medical_record_id,
    versionNumber: row.version_number,
    snapshotJson: row.snapshot_json,
    changedBy: row.changed_by,
    changeReason: row.change_reason || undefined,
    createdAt: toIsoString(row.created_at),
  };
}

async function createMedicalRecordVersionSnapshot(
  client: { query: (query: string, values?: unknown[]) => Promise<{ rows: any[] }> },
  medicalRecordId: string,
  username: string,
  changeReason?: string
): Promise<boolean> {
  const currentRecordResult = await client.query(
    `SELECT *
     FROM medical_records
     WHERE id = $1 AND username = $2
     FOR UPDATE`,
    [medicalRecordId, username]
  );

  if (currentRecordResult.rows.length === 0) {
    return false;
  }

  const versionResult = await client.query(
    `SELECT COALESCE(MAX(version_number), 0) + 1 AS next_version
     FROM medical_record_versions
     WHERE medical_record_id = $1`,
    [medicalRecordId]
  );

  const nextVersion = Number(versionResult.rows[0]?.next_version || 1);

  await client.query(
    `INSERT INTO medical_record_versions (
      medical_record_id,
      version_number,
      snapshot_json,
      changed_by,
      change_reason
    ) VALUES ($1, $2, $3::jsonb, $4, $5)`,
    [
      medicalRecordId,
      nextVersion,
      JSON.stringify(currentRecordResult.rows[0]),
      username,
      changeReason || null,
    ]
  );

  return true;
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
      CREATE INDEX IF NOT EXISTS idx_medical_records_username_patient_data ON medical_records(username, patient_id, data DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_medical_records_username_tipo_data ON medical_records(username, tipo_documento, data DESC, id DESC);

      CREATE TABLE IF NOT EXISTS medical_record_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        medical_record_id UUID NOT NULL,
        version_number INTEGER NOT NULL,
        snapshot_json JSONB NOT NULL,
        changed_by VARCHAR(255) NOT NULL,
        change_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(medical_record_id, version_number)
      );

      CREATE INDEX IF NOT EXISTS idx_medical_record_versions_record ON medical_record_versions(medical_record_id);
      CREATE INDEX IF NOT EXISTS idx_medical_record_versions_created_at ON medical_record_versions(created_at DESC);

      CREATE TABLE IF NOT EXISTS medical_record_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) NOT NULL,
        action VARCHAR(64) NOT NULL,
        resource_type VARCHAR(64) NOT NULL,
        resource_id TEXT NOT NULL,
        metadata_json JSONB,
        ip_hash TEXT,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_medical_record_audit_log_username ON medical_record_audit_log(username);
      CREATE INDEX IF NOT EXISTS idx_medical_record_audit_log_resource ON medical_record_audit_log(resource_type, resource_id);
      CREATE INDEX IF NOT EXISTS idx_medical_record_audit_log_created_at ON medical_record_audit_log(created_at DESC);
    `);
  } finally {
    client.release();
  }
}

export async function logMedicalRecordAudit(input: MedicalRecordAuditInput): Promise<void> {
  const pool = getPostgresPool();

  await pool.query(
    `INSERT INTO medical_record_audit_log (
      username,
      action,
      resource_type,
      resource_id,
      metadata_json,
      ip_hash,
      user_agent
    ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
    [
      input.username,
      input.action,
      input.resourceType,
      input.resourceId,
      JSON.stringify(input.metadataJson || {}),
      input.ipHash || null,
      input.userAgent || null,
    ]
  );
}

export async function getMedicalRecordVersions(
  medicalRecordId: string,
  username: string
): Promise<MedicalRecordVersion[]> {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    const result = await client.query(
      `SELECT id, medical_record_id, version_number, snapshot_json, changed_by, change_reason, created_at
       FROM medical_record_versions
       WHERE medical_record_id = $1
         AND (
           EXISTS (
             SELECT 1
             FROM medical_records mr
             WHERE mr.id = $1 AND mr.username = $2
           )
           OR snapshot_json ->> 'username' = $2
         )
       ORDER BY version_number DESC`,
      [medicalRecordId, username]
    );

    return result.rows.map((row) =>
      mapMedicalRecordVersionRow(
        row as {
          id: string;
          medical_record_id: string;
          version_number: number;
          snapshot_json: Record<string, unknown>;
          changed_by: string;
          change_reason: string | null;
          created_at: Date | string;
        }
      )
    );
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
  const result = await getMedicalRecordsByPatientPaginated(username, {
    patientId,
    limit: 10_000,
  });

  return result.records;
}

/**
 * Obtém registros médicos paginados de um paciente com filtros clínicos
 */
export async function getMedicalRecordsByPatientPaginated(
  username: string,
  filters: MedicalRecordListFilters
): Promise<PaginatedMedicalRecordsResult> {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    const limit = Math.min(Math.max(filters.limit || 20, 1), 100);
    const profissional = filters.profissional?.trim();
    const cursorData = filters.cursor
      ? decodeMedicalRecordCursor(filters.cursor)
      : null;

    const whereClauses = ['patient_id = $1', 'username = $2'];
    const values: unknown[] = [filters.patientId, username];
    let paramIndex = 3;

    if (filters.tipoDocumento) {
      whereClauses.push(`tipo_documento = $${paramIndex}`);
      values.push(filters.tipoDocumento);
      paramIndex += 1;
    }

    if (profissional) {
      whereClauses.push(`profissional ILIKE $${paramIndex}`);
      values.push(`%${profissional}%`);
      paramIndex += 1;
    }

    if (filters.dateFrom) {
      whereClauses.push(`data >= $${paramIndex}`);
      values.push(filters.dateFrom);
      paramIndex += 1;
    }

    if (filters.dateTo) {
      whereClauses.push(`data <= $${paramIndex}`);
      values.push(filters.dateTo);
      paramIndex += 1;
    }

    if (cursorData) {
      whereClauses.push(
        `(data < $${paramIndex} OR (data = $${paramIndex} AND id < $${paramIndex + 1}))`
      );
      values.push(cursorData.data, cursorData.id);
      paramIndex += 2;
    }

    values.push(limit + 1);

    const result = await client.query(
      `SELECT id, data, tipo_documento, profissional, especialidade, 
              conteudo, resumo, source_type, source_ref_id, patient_id,
              ai_generated, clinician_reviewed, reviewed_at, clinical_data
       FROM medical_records
       WHERE ${whereClauses.join(' AND ')}
       ORDER BY data DESC, id DESC
       LIMIT $${paramIndex}`,
      values
    );

    const hasMore = result.rows.length > limit;
    const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

    const records = rows.map((row) =>
      mapMedicalRecordRow(
        row as {
          id: string;
          patient_id: string;
          data: string;
          tipo_documento: MedicalRecord['tipoDocumento'];
          profissional: string;
          especialidade: string;
          conteudo: string;
          resumo: string | null;
          source_type: MedicalRecord['sourceType'];
          source_ref_id: string | null;
          ai_generated: boolean;
          clinician_reviewed: boolean;
          reviewed_at: string | null;
          clinical_data: unknown;
        }
      )
    );

    const lastRow = rows[rows.length - 1] as
      | { data: string; id: string }
      | undefined;

    const nextCursor =
      hasMore && lastRow
        ? encodeMedicalRecordCursor({
            data: String(lastRow.data),
            id: lastRow.id,
          })
        : null;

    return {
      records,
      nextCursor,
      hasMore,
    };
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
  recordData: Partial<Omit<MedicalRecord, 'id' | 'patientId'>>,
  changeReason?: string
): Promise<MedicalRecord | null> {
  const pool = getPostgresPool();
  const client = await pool.connect();
  let hasTransaction = false;

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

    await client.query('BEGIN');
    hasTransaction = true;

    const snapshotCreated = await createMedicalRecordVersionSnapshot(
      client,
      id,
      username,
      changeReason || 'Atualização de registro médico'
    );

    if (!snapshotCreated) {
      await client.query('ROLLBACK');
      hasTransaction = false;
      return null;
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

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      hasTransaction = false;
      return null;
    }

    await client.query('COMMIT');
    hasTransaction = false;

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
  } catch (error) {
    if (hasTransaction) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Deleta um registro médico
 */
export async function deleteMedicalRecord(
  id: string,
  username: string,
  changeReason?: string
): Promise<boolean> {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const snapshotCreated = await createMedicalRecordVersionSnapshot(
      client,
      id,
      username,
      changeReason || 'Exclusão de registro médico'
    );

    if (!snapshotCreated) {
      await client.query('ROLLBACK');
      return false;
    }

    const result = await client.query(
      `DELETE FROM medical_records WHERE id = $1 AND username = $2`,
      [id, username]
    );

    await client.query('COMMIT');

    return result.rowCount ? result.rowCount > 0 : false;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
