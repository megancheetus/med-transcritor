import { HistoryEntry } from '@/lib/history';
import { getPostgresPool } from '@/lib/postgres';

let historyTableReadyPromise: Promise<void> | null = null;

function getCreatedAt(entry: HistoryEntry): Date {
  const parsedId = Number(entry.id);
  if (Number.isFinite(parsedId) && parsedId > 0) {
    return new Date(parsedId);
  }

  const parsedTimestamp = new Date(entry.timestamp);
  if (!Number.isNaN(parsedTimestamp.getTime())) {
    return parsedTimestamp;
  }

  return new Date();
}

async function ensureHistoryTable(): Promise<void> {
  if (!historyTableReadyPromise) {
    historyTableReadyPromise = (async () => {
      const pool = getPostgresPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS transcription_history (
          username TEXT NOT NULL,
          entry_id TEXT NOT NULL,
          timestamp_label TEXT NOT NULL,
          model TEXT NOT NULL,
          duration_seconds INTEGER NOT NULL,
          audio_id TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (username, entry_id)
        )
      `);
      await pool.query('ALTER TABLE transcription_history DROP COLUMN IF EXISTS content');
      await pool.query(`
        CREATE INDEX IF NOT EXISTS transcription_history_user_created_idx
        ON transcription_history (username, created_at DESC)
      `);
    })().catch((error) => {
      historyTableReadyPromise = null;
      throw error;
    });
  }

  return historyTableReadyPromise;
}

function mapRowToHistoryEntry(row: {
  entry_id: string;
  timestamp_label: string;
  model: string;
  duration_seconds: number;
  audio_id: string | null;
}): HistoryEntry {
  return {
    id: row.entry_id,
    timestamp: row.timestamp_label,
    model: row.model as HistoryEntry['model'],
    duration: row.duration_seconds,
    audioId: row.audio_id ?? undefined,
  };
}

export async function getUserHistory(username: string): Promise<HistoryEntry[]> {
  await ensureHistoryTable();
  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT entry_id, timestamp_label, model, duration_seconds, audio_id
      FROM transcription_history
      WHERE username = $1
      ORDER BY created_at DESC, entry_id DESC
    `,
    [username]
  );

  return result.rows.map(mapRowToHistoryEntry);
}

export async function saveUserHistoryEntry(username: string, entry: HistoryEntry): Promise<HistoryEntry[]> {
  await ensureHistoryTable();
  const pool = getPostgresPool();
  const createdAt = getCreatedAt(entry);

  await pool.query(
    `
      INSERT INTO transcription_history (
        username,
        entry_id,
        timestamp_label,
        model,
        duration_seconds,
        audio_id,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (username, entry_id)
      DO UPDATE SET
        timestamp_label = EXCLUDED.timestamp_label,
        model = EXCLUDED.model,
        duration_seconds = EXCLUDED.duration_seconds,
        audio_id = EXCLUDED.audio_id,
        created_at = EXCLUDED.created_at
    `,
    [
      username,
      entry.id,
      entry.timestamp,
      entry.model,
      entry.duration,
      entry.audioId ?? null,
      createdAt,
    ]
  );

  return getUserHistory(username);
}

export async function saveUserHistoryEntries(username: string, entries: HistoryEntry[]): Promise<HistoryEntry[]> {
  await ensureHistoryTable();
  const pool = getPostgresPool();

  if (entries.length === 0) {
    return getUserHistory(username);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (const entry of entries) {
      const createdAt = getCreatedAt(entry);

      await client.query(
        `
          INSERT INTO transcription_history (
            username,
            entry_id,
            timestamp_label,
            model,
            duration_seconds,
            audio_id,
            created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (username, entry_id)
          DO UPDATE SET
            timestamp_label = EXCLUDED.timestamp_label,
            model = EXCLUDED.model,
            duration_seconds = EXCLUDED.duration_seconds,
            audio_id = EXCLUDED.audio_id,
            created_at = EXCLUDED.created_at
        `,
        [
          username,
          entry.id,
          entry.timestamp,
          entry.model,
          entry.duration,
          entry.audioId ?? null,
          createdAt,
        ]
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return getUserHistory(username);
}