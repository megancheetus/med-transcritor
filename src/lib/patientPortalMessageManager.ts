import { getPostgresPool } from '@/lib/postgres';
import { initializePatientsTable } from '@/lib/patientManager';

export interface PatientPortalMessage {
  id: string;
  patientId: string;
  professionalUsername: string;
  professionalDisplayName: string;
  title: string;
  body: string;
  sentAt: string;
  readAt: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentMimeType: string | null;
  attachmentSizeBytes: number | null;
}

export interface ProfessionalPortalMessage extends PatientPortalMessage {
  patientName: string;
}

interface SendPatientPortalMessageInput {
  patientId: string;
  professionalUsername: string;
  professionalDisplayName: string;
  title: string;
  body: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentMimeType?: string;
  attachmentSizeBytes?: number;
}

interface ListProfessionalMessagesFilters {
  search?: string;
  patientId?: string;
  readStatus?: 'all' | 'read' | 'unread';
  limit?: number;
}

interface MessageRow {
  id: string;
  patient_id: string;
  patient_name?: string;
  professional_username: string;
  professional_display_name: string;
  title: string;
  body: string;
  sent_at: Date | string;
  read_at: Date | string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_mime_type: string | null;
  attachment_size_bytes: number | null;
}

function mapMessageRow(row: MessageRow): PatientPortalMessage {
  return {
    id: row.id,
    patientId: row.patient_id,
    professionalUsername: row.professional_username,
    professionalDisplayName: row.professional_display_name,
    title: row.title,
    body: row.body,
    sentAt: new Date(row.sent_at).toISOString(),
    readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
    attachmentUrl: row.attachment_url,
    attachmentName: row.attachment_name,
    attachmentMimeType: row.attachment_mime_type,
    attachmentSizeBytes: row.attachment_size_bytes,
  };
}

function mapProfessionalMessageRow(row: MessageRow): ProfessionalPortalMessage {
  return {
    ...mapMessageRow(row),
    patientName: row.patient_name || 'Paciente',
  };
}

export async function ensurePatientPortalMessagesTable(): Promise<void> {
  await initializePatientsTable();

  const pool = getPostgresPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS patient_portal_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      professional_username TEXT NOT NULL REFERENCES app_users(username) ON DELETE CASCADE,
      professional_display_name TEXT NOT NULL,
      title VARCHAR(160) NOT NULL,
      body TEXT NOT NULL,
      attachment_url TEXT,
      attachment_name TEXT,
      attachment_mime_type VARCHAR(120),
      attachment_size_bytes INTEGER,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`ALTER TABLE patient_portal_messages ADD COLUMN IF NOT EXISTS attachment_url TEXT`);
  await pool.query(`ALTER TABLE patient_portal_messages ADD COLUMN IF NOT EXISTS attachment_name TEXT`);
  await pool.query(`ALTER TABLE patient_portal_messages ADD COLUMN IF NOT EXISTS attachment_mime_type VARCHAR(120)`);
  await pool.query(`ALTER TABLE patient_portal_messages ADD COLUMN IF NOT EXISTS attachment_size_bytes INTEGER`);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_patient_portal_messages_patient_sent
    ON patient_portal_messages(patient_id, sent_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_patient_portal_messages_professional_sent
    ON patient_portal_messages(professional_username, sent_at DESC)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_patient_portal_messages_patient_unread
    ON patient_portal_messages(patient_id)
    WHERE read_at IS NULL
  `);
}

export async function sendPatientPortalMessage(
  input: SendPatientPortalMessageInput
): Promise<PatientPortalMessage> {
  await ensurePatientPortalMessagesTable();

  const pool = getPostgresPool();
  const result = await pool.query(
    `
      INSERT INTO patient_portal_messages (
        patient_id,
        professional_username,
        professional_display_name,
        title,
        body,
        attachment_url,
        attachment_name,
        attachment_mime_type,
        attachment_size_bytes,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING
        id,
        patient_id,
        professional_username,
        professional_display_name,
        title,
        body,
        sent_at,
        read_at,
        attachment_url,
        attachment_name,
        attachment_mime_type,
        attachment_size_bytes
    `,
    [
      input.patientId,
      input.professionalUsername,
      input.professionalDisplayName,
      input.title,
      input.body,
      input.attachmentUrl || null,
      input.attachmentName || null,
      input.attachmentMimeType || null,
      input.attachmentSizeBytes || null,
    ]
  );

  return mapMessageRow(result.rows[0] as MessageRow);
}

export async function listPatientPortalMessages(
  patientId: string,
  limit = 50
): Promise<{ messages: PatientPortalMessage[]; unreadCount: number }> {
  await ensurePatientPortalMessagesTable();

  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const pool = getPostgresPool();

  const [messagesResult, unreadResult] = await Promise.all([
    pool.query(
      `
        SELECT
          id,
          patient_id,
          professional_username,
          professional_display_name,
          title,
          body,
          sent_at,
          read_at,
          attachment_url,
          attachment_name,
          attachment_mime_type,
          attachment_size_bytes
        FROM patient_portal_messages
        WHERE patient_id = $1
        ORDER BY sent_at DESC
        LIMIT $2
      `,
      [patientId, safeLimit]
    ),
    pool.query(
      `
        SELECT COUNT(*)::int AS unread_count
        FROM patient_portal_messages
        WHERE patient_id = $1
          AND read_at IS NULL
      `,
      [patientId]
    ),
  ]);

  return {
    messages: messagesResult.rows.map((row) => mapMessageRow(row as MessageRow)),
    unreadCount: (unreadResult.rows[0] as { unread_count: number } | undefined)?.unread_count ?? 0,
  };
}

export async function markPatientPortalMessageAsRead(
  patientId: string,
  messageId: string
): Promise<PatientPortalMessage | null> {
  await ensurePatientPortalMessagesTable();

  const pool = getPostgresPool();
  const result = await pool.query(
    `
      UPDATE patient_portal_messages
      SET read_at = COALESCE(read_at, NOW()),
          updated_at = NOW()
      WHERE id = $1
        AND patient_id = $2
      RETURNING
        id,
        patient_id,
        professional_username,
        professional_display_name,
        title,
        body,
        sent_at,
        read_at,
        attachment_url,
        attachment_name,
        attachment_mime_type,
        attachment_size_bytes
    `,
    [messageId, patientId]
  );

  if (!result.rowCount) {
    return null;
  }

  return mapMessageRow(result.rows[0] as MessageRow);
}

export async function listProfessionalSentPortalMessages(
  professionalUsername: string,
  filters: ListProfessionalMessagesFilters = {}
): Promise<{ messages: ProfessionalPortalMessage[] }> {
  await ensurePatientPortalMessagesTable();

  const safeLimit = Math.min(Math.max(filters.limit || 100, 1), 300);
  const pool = getPostgresPool();

  const whereClauses: string[] = ['m.professional_username = $1'];
  const values: unknown[] = [professionalUsername];
  let paramIndex = 2;

  if (filters.patientId) {
    whereClauses.push(`m.patient_id = $${paramIndex}`);
    values.push(filters.patientId);
    paramIndex += 1;
  }

  if (filters.readStatus === 'read') {
    whereClauses.push('m.read_at IS NOT NULL');
  }

  if (filters.readStatus === 'unread') {
    whereClauses.push('m.read_at IS NULL');
  }

  if (filters.search?.trim()) {
    whereClauses.push(`(p.nome_completo ILIKE $${paramIndex} OR m.title ILIKE $${paramIndex} OR m.body ILIKE $${paramIndex})`);
    values.push(`%${filters.search.trim()}%`);
    paramIndex += 1;
  }

  values.push(safeLimit);

  const result = await pool.query(
    `
      SELECT
        m.id,
        m.patient_id,
        p.nome_completo AS patient_name,
        m.professional_username,
        m.professional_display_name,
        m.title,
        m.body,
        m.sent_at,
        m.read_at,
        m.attachment_url,
        m.attachment_name,
        m.attachment_mime_type,
        m.attachment_size_bytes
      FROM patient_portal_messages m
      INNER JOIN patients p ON p.id = m.patient_id
      WHERE ${whereClauses.join(' AND ')}
      ORDER BY m.sent_at DESC
      LIMIT $${paramIndex}
    `,
    values
  );

  return {
    messages: result.rows.map((row) => mapProfessionalMessageRow(row as MessageRow)),
  };
}

export async function getPatientPortalMessageForPatient(
  patientId: string,
  messageId: string
): Promise<PatientPortalMessage | null> {
  await ensurePatientPortalMessagesTable();

  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT
        id,
        patient_id,
        professional_username,
        professional_display_name,
        title,
        body,
        sent_at,
        read_at,
        attachment_url,
        attachment_name,
        attachment_mime_type,
        attachment_size_bytes
      FROM patient_portal_messages
      WHERE id = $1
        AND patient_id = $2
      LIMIT 1
    `,
    [messageId, patientId]
  );

  if (!result.rowCount) {
    return null;
  }

  return mapMessageRow(result.rows[0] as MessageRow);
}

export async function getPatientPortalMessageForProfessional(
  professionalUsername: string,
  messageId: string
): Promise<ProfessionalPortalMessage | null> {
  await ensurePatientPortalMessagesTable();

  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT
        m.id,
        m.patient_id,
        p.nome_completo AS patient_name,
        m.professional_username,
        m.professional_display_name,
        m.title,
        m.body,
        m.sent_at,
        m.read_at,
        m.attachment_url,
        m.attachment_name,
        m.attachment_mime_type,
        m.attachment_size_bytes
      FROM patient_portal_messages m
      INNER JOIN patients p ON p.id = m.patient_id
      WHERE m.id = $1
        AND m.professional_username = $2
      LIMIT 1
    `,
    [messageId, professionalUsername]
  );

  if (!result.rowCount) {
    return null;
  }

  return mapProfessionalMessageRow(result.rows[0] as MessageRow);
}
