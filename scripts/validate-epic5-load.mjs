import fs from 'node:fs';
import { Pool } from 'pg';
import { hash } from 'bcryptjs';
import { SignJWT } from 'jose';

function parseEnv(content) {
  const env = {};
  for (const line of content.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replace(/\\"/g, '"');
    }
    env[key] = value;
  }
  return env;
}

function parseCaCert(raw) {
  if (!raw) {
    return null;
  }

  const trimmed = String(raw).trim();

  if (trimmed.includes('BEGIN CERTIFICATE')) {
    return trimmed.replace(/\\n/g, '\n');
  }

  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
    if (decoded.includes('BEGIN CERTIFICATE')) {
      return decoded;
    }
  } catch {
    return null;
  }

  return null;
}

function getSslConfig(env) {
  const useSsl = env.POSTGRES_SSL === 'true';
  if (!useSsl) {
    return false;
  }

  const ca = parseCaCert(env.POSTGRES_CA_CERT);
  if (ca) {
    return { rejectUnauthorized: true, ca };
  }

  return {
    rejectUnauthorized: env.POSTGRES_SSL_REJECT_UNAUTHORIZED !== 'false',
  };
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} @ ${url} :: ${JSON.stringify(data)}`);
  }
  return data;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function toMs(start) {
  return Number(process.hrtime.bigint() - start) / 1e6;
}

const envText = fs.readFileSync('.env.local', 'utf8');
const env = parseEnv(envText);

if (!env.DATABASE_URL) {
  throw new Error('DATABASE_URL não encontrado no .env.local');
}
if (!env.AUTH_TOKEN_SECRET) {
  throw new Error('AUTH_TOKEN_SECRET não encontrado no .env.local');
}

const baseUrl = 'http://localhost:3000';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: getSslConfig(env),
});
let username = '';

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

const userResult = await pool.query(
  'SELECT username FROM app_users ORDER BY is_admin DESC, username ASC LIMIT 1'
);

if ((userResult.rowCount || 0) > 0) {
  username = userResult.rows[0].username;
} else {
  username = 'perf_validator';
  const passwordHash = await hash('perf-validator-123', 12);
  await pool.query(
    `INSERT INTO app_users (username, password_hash, is_admin)
     VALUES ($1, $2, TRUE)
     ON CONFLICT (username) DO NOTHING`,
    [username, passwordHash]
  );
}

const secret = new TextEncoder().encode(env.AUTH_TOKEN_SECRET);
const token = await new SignJWT({ username })
  .setProtectedHeader({ alg: 'HS256' })
  .setSubject(username)
  .setIssuedAt()
  .setIssuer('omninote')
  .setAudience('omninote-app')
  .setExpirationTime('24h')
  .sign(secret);

const cookie = `auth_token=${token}`;

const session = await fetchJson(`${baseUrl}/api/auth/session`, {
  headers: { cookie },
});

assert(session?.user?.username === username, 'Sessão JWT inválida para o usuário de teste');

const perfCpf = '999.888.777-66';
const patientName = 'Perf Carga';
const patientFull = 'Paciente Performance Carga';

let patient = null;
try {
  const existing = await fetchJson(
    `${baseUrl}/api/patients?limit=5&search=${encodeURIComponent(perfCpf)}`,
    { headers: { cookie } }
  );

  if (Array.isArray(existing?.patients) && existing.patients.length > 0) {
    patient = existing.patients[0];
  } else {
    patient = await fetchJson(`${baseUrl}/api/patients`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        nome: patientName,
        nomeCompleto: patientFull,
        idade: 44,
        sexo: 'F',
        cpf: perfCpf,
        dataNascimento: '1981-07-01',
        telefone: '(11) 99999-1234',
        email: 'perf.carga@example.com',
      }),
    });
  }

  assert(patient?.id, 'Paciente de teste sem id');

  await pool.query(
    `
    INSERT INTO patients (username, nome, nome_completo, idade, sexo, cpf, data_nascimento, telefone, email)
    SELECT $1, 'Perf' || gs::text, 'PERFLOAD ' || gs::text, 30 + (gs % 40), CASE WHEN gs % 3 = 0 THEN 'M' WHEN gs % 3 = 1 THEN 'F' ELSE 'O' END,
           '990' || LPAD(gs::text, 8, '0'), DATE '1980-01-01' + ((gs % 12000) * INTERVAL '1 day'), '(11) 90000-0000', NULL
    FROM generate_series(1, 1500) gs
    ON CONFLICT (username, cpf) DO NOTHING
    `,
    [username]
  );

  await pool.query('DELETE FROM medical_records WHERE username = $1 AND patient_id = $2', [
    username,
    patient.id,
  ]);

  await pool.query(
    `
    INSERT INTO medical_records (
      patient_id, username, data, tipo_documento, profissional, especialidade, conteudo, resumo,
      source_type, ai_generated, clinician_reviewed, clinical_data
    )
    SELECT
      $1,
      $2,
      CURRENT_DATE - ((gs % 365))::int,
      CASE (gs % 5)
        WHEN 0 THEN 'Consulta'
        WHEN 1 THEN 'Exame'
        WHEN 2 THEN 'Procedimento'
        WHEN 3 THEN 'Prescrição'
        ELSE 'Internação'
      END,
      'Dr. Perf ' || (gs % 25)::text,
      'Clínica Geral',
      'Conteúdo de carga ' || gs::text,
      'Resumo de carga ' || gs::text,
      'manual',
      FALSE,
      TRUE,
      jsonb_build_object(
        'soapSubjetivo', 'S ' || gs::text,
        'soapObjetivo', 'O ' || gs::text,
        'soapAvaliacao', 'A ' || gs::text,
        'soapPlano', 'P ' || gs::text
      )
    FROM generate_series(1, 10000) gs
    `,
    [patient.id, username]
  );

  const perfResults = {
    patients: {},
    records: {},
  };

  {
    const start = process.hrtime.bigint();
    const page1 = await fetchJson(`${baseUrl}/api/patients?limit=100`, { headers: { cookie } });
    assert(page1.patients.length === 100, 'Patients page1 deve retornar 100');
    assert(page1.hasMore === true, 'Patients page1 hasMore deveria ser true');
    assert(typeof page1.nextCursor === 'string' && page1.nextCursor.length > 0, 'Patients page1 sem cursor');

    const page2 = await fetchJson(
      `${baseUrl}/api/patients?limit=100&cursor=${encodeURIComponent(page1.nextCursor)}`,
      { headers: { cookie } }
    );

    const ids1 = new Set(page1.patients.map((p) => p.id));
    const dup = page2.patients.filter((p) => ids1.has(p.id));
    assert(dup.length === 0, 'Patients page2 trouxe duplicados da page1');

    const search = await fetchJson(
      `${baseUrl}/api/patients?limit=50&search=${encodeURIComponent('PERFLOAD')}`,
      { headers: { cookie } }
    );
    assert(search.patients.length > 0, 'Busca de patients PERFLOAD vazia');

    perfResults.patients = {
      page1Count: page1.patients.length,
      page2Count: page2.patients.length,
      duplicatedAcrossFirstTwoPages: dup.length,
      searchCount: search.patients.length,
      elapsedMs: Number(toMs(start).toFixed(2)),
    };
  }

  {
    const start = process.hrtime.bigint();
    const page1 = await fetchJson(
      `${baseUrl}/api/medical-records?patientId=${encodeURIComponent(patient.id)}&limit=50`,
      { headers: { cookie } }
    );

    assert(page1.records.length === 50, 'Records page1 deve retornar 50');
    assert(page1.hasMore === true, 'Records page1 hasMore deveria ser true');
    assert(typeof page1.nextCursor === 'string' && page1.nextCursor.length > 0, 'Records page1 sem cursor');

    const page2 = await fetchJson(
      `${baseUrl}/api/medical-records?patientId=${encodeURIComponent(patient.id)}&limit=50&cursor=${encodeURIComponent(page1.nextCursor)}`,
      { headers: { cookie } }
    );

    const ids1 = new Set(page1.records.map((r) => r.id));
    const dup = page2.records.filter((r) => ids1.has(r.id));
    assert(dup.length === 0, 'Records page2 trouxe duplicados da page1');

    const exame = await fetchJson(
      `${baseUrl}/api/medical-records?patientId=${encodeURIComponent(patient.id)}&limit=40&tipoDocumento=${encodeURIComponent('Exame')}`,
      { headers: { cookie } }
    );
    assert(exame.records.every((r) => r.tipoDocumento === 'Exame'), 'Filtro tipoDocumento falhou');

    const profissional = await fetchJson(
      `${baseUrl}/api/medical-records?patientId=${encodeURIComponent(patient.id)}&limit=40&profissional=${encodeURIComponent('Dr. Perf 3')}`,
      { headers: { cookie } }
    );
    assert(
      profissional.records.every((r) => String(r.profissional).toLowerCase().includes('dr. perf 3')),
      'Filtro profissional falhou'
    );

    const periodo = await fetchJson(
      `${baseUrl}/api/medical-records?patientId=${encodeURIComponent(patient.id)}&limit=100&dateFrom=2025-01-01&dateTo=2025-12-31`,
      { headers: { cookie } }
    );
    assert(
      periodo.records.every((r) => r.data >= '2025-01-01' && r.data <= '2025-12-31'),
      'Filtro por período falhou'
    );

    let cursor = page1.nextCursor;
    let pages = 1;
    let total = page1.records.length;
    const uniqueIds = new Set(page1.records.map((r) => r.id));
    let duplicates = 0;

    while (cursor && pages < 400) {
      const next = await fetchJson(
        `${baseUrl}/api/medical-records?patientId=${encodeURIComponent(patient.id)}&limit=50&cursor=${encodeURIComponent(cursor)}`,
        { headers: { cookie } }
      );
      pages += 1;
      total += next.records.length;
      for (const r of next.records) {
        if (uniqueIds.has(r.id)) {
          duplicates += 1;
        }
        uniqueIds.add(r.id);
      }
      cursor = next.nextCursor;
      if (!next.hasMore) {
        break;
      }
    }

    perfResults.records = {
      page1Count: page1.records.length,
      page2Count: page2.records.length,
      duplicatedAcrossFirstTwoPages: dup.length,
      uniqueIdsScanned: uniqueIds.size,
      duplicatesDetectedAcrossScan: duplicates,
      scannedTotal: total,
      pagesScanned: pages,
      exameCount: exame.records.length,
      profissionalCount: profissional.records.length,
      periodoCount: periodo.records.length,
      elapsedMs: Number(toMs(start).toFixed(2)),
    };
  }

  console.log('EPIC5_VALIDATION_OK');
  console.log(JSON.stringify(perfResults, null, 2));
} finally {
  await pool.end();
}
