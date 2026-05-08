import { getPostgresPool } from './postgres';
import { VideoConsultaRoom, VideoConsultaLog } from './types';
import { randomBytes } from 'crypto';

/**
 * Inicializa as tabelas de videoconsultas no banco de dados
 */
export async function initializeVideoConsultationTables() {
  const pool = getPostgresPool();

  try {
    // Criar tabela de salas de videoconsulta
    await pool.query(
      `CREATE TABLE IF NOT EXISTS videoconsulta_rooms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        professional_username VARCHAR NOT NULL REFERENCES app_users(username),
        patient_id UUID NOT NULL REFERENCES patients(id),
        status VARCHAR DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'ended', 'expired')),
        room_token TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT NOW(),
        started_at TIMESTAMP,
        ended_at TIMESTAMP,
        expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '30 minutes',
        duracao_segundos INT,
        foi_gravada BOOLEAN DEFAULT FALSE,
        transcricao_id UUID REFERENCES medical_records(id)
      )`
    );

    // Criar índices para videoconsulta_rooms
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_professional_username ON videoconsulta_rooms(professional_username)`
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_patient_id ON videoconsulta_rooms(patient_id)`
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_status ON videoconsulta_rooms(status)`
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_created_at ON videoconsulta_rooms(created_at)`
    );

    // Criar tabela de logs de eventos
    await pool.query(
      `CREATE TABLE IF NOT EXISTS videoconsulta_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id UUID NOT NULL REFERENCES videoconsulta_rooms(id) ON DELETE CASCADE,
        evento VARCHAR NOT NULL CHECK (evento IN ('professional_joined', 'patient_joined', 'disconnected', 'recording_started', 'recording_stopped')),
        timestamp TIMESTAMP DEFAULT NOW(),
        username VARCHAR NOT NULL
      )`
    );

    // Criar índices para videoconsulta_logs
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_room_id ON videoconsulta_logs(room_id)`
    );
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_timestamp ON videoconsulta_logs(timestamp)`
    );

    console.log('✅ Tabelas de videoconsulta inicializadas com sucesso');
  } catch (error) {
    console.error('❌ Erro ao inicializar tabelas de videoconsulta:', error);
    throw error;
  }
}

/**
 * Cria uma nova sala de videoconsulta
 */
export async function createVideoConsultaRoom(
  professionalUsername: string,
  patientId: string
): Promise<VideoConsultaRoom> {
  const pool = getPostgresPool();
  const roomToken = generateRoomToken();

  try {
    const result = await pool.query(
      `INSERT INTO videoconsulta_rooms (
        professional_username, patient_id, room_token, status
      ) VALUES ($1, $2, $3, $4)
      RETURNING 
        id, professional_username as "professionalUsername", 
        patient_id as "patientId", status, room_token as "roomToken",
        created_at as "createdAt", started_at as "startedAt",
        ended_at as "endedAt", expires_at as "expiresAt",
        duracao_segundos as "duracaoSegundos", foi_gravada as "foiGravada",
        transcricao_id as "transcricaoId"`,
      [professionalUsername, patientId, roomToken, 'waiting']
    );

    return result.rows[0];
  } catch (error) {
    console.error('Erro ao criar sala de videoconsulta:', error);
    throw error;
  }
}

/**
 * Obtém uma sala de videoconsulta pelo ID
 */
export async function getVideoConsultaRoom(
  roomId: string,
  username?: string
): Promise<VideoConsultaRoom | null> {
  const pool = getPostgresPool();

  try {
    const result = await pool.query(
      `SELECT 
        vcr.id, vcr.professional_username as "professionalUsername", 
        vcr.patient_id as "patientId", p.nome as "patientName",
        vcr.status, vcr.room_token as "roomToken",
        vcr.created_at as "createdAt", vcr.started_at as "startedAt",
        vcr.ended_at as "endedAt", vcr.expires_at as "expiresAt",
        vcr.duracao_segundos as "duracaoSegundos", vcr.foi_gravada as "foiGravada",
        vcr.transcricao_id as "transcricaoId"
      FROM videoconsulta_rooms vcr
      JOIN patients p ON vcr.patient_id = p.id
      WHERE vcr.id = $1`,
      [roomId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const room = result.rows[0];

    // Validar acesso
    if (username) {
      const isAllowed = room.professionalUsername === username;
      if (!isAllowed) {
        // Profissional só pode acessar salas que criou
        throw new Error('Acesso negado a esta sala de teleconsulta');
      }
    }

    return room;
  } catch (error) {
    console.error('Erro ao obter sala de videoconsulta:', error);
    throw error;
  }
}

/**
 * Obtém sala de videoconsulta pelo token (para paciente entrar)
 */
export async function getVideoConsultaRoomByToken(token: string): Promise<VideoConsultaRoom | null> {
  const pool = getPostgresPool();

  try {
    console.log(`🔍 Buscando sala por token: ${token.substring(0, 10)}...`);
    
    const result = await pool.query(
      `SELECT 
        vcr.id, vcr.professional_username as "professionalUsername", 
        vcr.patient_id as "patientId", p.nome as "patientName",
        vcr.status, vcr.room_token as "roomToken",
        vcr.created_at as "createdAt", vcr.started_at as "startedAt",
        vcr.ended_at as "endedAt", vcr.expires_at as "expiresAt",
        vcr.duracao_segundos as "duracaoSegundos", vcr.foi_gravada as "foiGravada",
        vcr.transcricao_id as "transcricaoId"
      FROM videoconsulta_rooms vcr
      LEFT JOIN patients p ON vcr.patient_id = p.id
      WHERE vcr.room_token = $1`,
      [token]
    );

    const room = result.rows.length > 0 ? result.rows[0] : null;
    
    if (room) {
      console.log(`✅ Sala encontrada: ${room.id}, Status: ${room.status}`);
      // Verificar expiração DEPOIS de retornar (não bloquear completamente)
      if (room.expiresAt && new Date(room.expiresAt) < new Date()) {
        console.log(`⚠️ Sala expirou em: ${room.expiresAt}`);
        // Ainda retorna a sala, mas app pode mostrar aviso
      }
    } else {
      console.log(`❌ Nenhuma sala encontrada com este token`);
    }
    
    return room;
  } catch (error) {
    console.error('Erro ao obter sala por token:', error);
    throw error;
  }
}

/**
 * Obtém todas as salas de um profissional
 */
export async function getVideoConsultasOfProfessional(
  professionalUsername: string
): Promise<VideoConsultaRoom[]> {
  const pool = getPostgresPool();

  try {
    const result = await pool.query(
      `SELECT 
        vcr.id, vcr.professional_username as "professionalUsername", 
        vcr.patient_id as "patientId", p.nome as "patientName",
        vcr.status, vcr.room_token as "roomToken",
        vcr.created_at as "createdAt", vcr.started_at as "startedAt",
        vcr.ended_at as "endedAt", vcr.expires_at as "expiresAt",
        vcr.duracao_segundos as "duracaoSegundos", vcr.foi_gravada as "foiGravada",
        vcr.transcricao_id as "transcricaoId"
      FROM videoconsulta_rooms vcr
      JOIN patients p ON vcr.patient_id = p.id
      WHERE vcr.professional_username = $1
      ORDER BY vcr.created_at DESC`,
      [professionalUsername]
    );

    return result.rows;
  } catch (error) {
    console.error('Erro ao obter teleconsultas do profissional:', error);
    throw error;
  }
}

/**
 * Obtém todas as salas de um paciente
 */
export async function getVideoConsultasOfPatient(
  patientId: string,
  username: string // para validar acesso
): Promise<VideoConsultaRoom[]> {
  const pool = getPostgresPool();

  try {
    // Primeiro, validar que o paciente pertence ao usuário logado
    const patientCheck = await pool.query(
      'SELECT id FROM patients WHERE id = $1 AND username = $2',
      [patientId, username]
    );

    if (patientCheck.rows.length === 0) {
      throw new Error('Paciente não encontrado ou acesso negado');
    }

    const result = await pool.query(
      `SELECT 
        vcr.id, vcr.professional_username as "professionalUsername", 
        vcr.patient_id as "patientId", p.nome as "patientName",
        vcr.status, vcr.room_token as "roomToken",
        vcr.created_at as "createdAt", vcr.started_at as "startedAt",
        vcr.ended_at as "endedAt", vcr.expires_at as "expiresAt",
        vcr.duracao_segundos as "duracaoSegundos", vcr.foi_gravada as "foiGravada",
        vcr.transcricao_id as "transcricaoId"
      FROM videoconsulta_rooms vcr
      JOIN patients p ON vcr.patient_id = p.id
      WHERE vcr.patient_id = $1
      ORDER BY vcr.created_at DESC`,
      [patientId]
    );

    return result.rows;
  } catch (error) {
    console.error('Erro ao obter teleconsultas do paciente:', error);
    throw error;
  }
}

/**
 * Atualiza o status da sala
 */
export async function updateVideoConsultaRoomStatus(
  roomId: string,
  status: 'waiting' | 'active' | 'ended' | 'expired',
  professionalUsername: string
): Promise<VideoConsultaRoom> {
  const pool = getPostgresPool();

  try {
    // Validar acesso
    const ownerCheck = await pool.query(
      'SELECT id FROM videoconsulta_rooms WHERE id = $1 AND professional_username = $2',
      [roomId, professionalUsername]
    );

    if (ownerCheck.rows.length === 0) {
      throw new Error('Sala não encontrada ou acesso negado');
    }

    const updateFields: string[] = ['status = $1'];
    const params: (string | null)[] = [status];

    if (status === 'active') {
      updateFields.push('started_at = NOW()');
    } else if (status === 'ended') {
      updateFields.push('ended_at = NOW()');
    }

    const result = await pool.query(
      `UPDATE videoconsulta_rooms 
       SET ${updateFields.join(', ')}
       WHERE id = $${params.length + 1}
       RETURNING 
        id, professional_username as "professionalUsername", 
        patient_id as "patientId", status, room_token as "roomToken",
        created_at as "createdAt", started_at as "startedAt",
        ended_at as "endedAt", expires_at as "expiresAt",
        duracao_segundos as "duracaoSegundos", foi_gravada as "foiGravada",
        transcricao_id as "transcricaoId"`,
      [...params, roomId]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Erro ao atualizar status da sala:', error);
    throw error;
  }
}

/**
 * Atualiza a duração e marca como gravada
 */
export async function finalizeVideoConsultaRoom(
  roomId: string,
  duracaoSegundos: number,
  foiGravada: boolean,
  transcricaoId?: string,
  professionalUsername?: string
): Promise<VideoConsultaRoom> {
  const pool = getPostgresPool();

  try {
    if (professionalUsername) {
      const ownerCheck = await pool.query(
        'SELECT id FROM videoconsulta_rooms WHERE id = $1 AND professional_username = $2',
        [roomId, professionalUsername]
      );

      if (ownerCheck.rows.length === 0) {
        throw new Error('Sala não encontrada ou acesso negado');
      }
    }

    const result = await pool.query(
      `UPDATE videoconsulta_rooms 
       SET duracao_segundos = $1, foi_gravada = $2, transcricao_id = $3, status = 'ended', ended_at = NOW()
       WHERE id = $4
       RETURNING 
        id, professional_username as "professionalUsername", 
        patient_id as "patientId", status, room_token as "roomToken",
        created_at as "createdAt", started_at as "startedAt",
        ended_at as "endedAt", expires_at as "expiresAt",
        duracao_segundos as "duracaoSegundos", foi_gravada as "foiGravada",
        transcricao_id as "transcricaoId"`,
      [duracaoSegundos, foiGravada, transcricaoId || null, roomId]
    );

    return result.rows[0];
  } catch (error) {
    console.error('Erro ao finalizar sala de videoconsulta:', error);
    throw error;
  }
}

/**
 * Registra um evento de log
 */
export async function logVideoConsultaEvent(
  roomId: string,
  evento: 'professional_joined' | 'patient_joined' | 'disconnected' | 'recording_started' | 'recording_stopped',
  username: string
): Promise<void> {
  const pool = getPostgresPool();

  try {
    await pool.query(
      `INSERT INTO videoconsulta_logs (room_id, evento, username)
       VALUES ($1, $2, $3)`,
      [roomId, evento, username]
    );
  } catch (error) {
    console.warn('Erro ao registrar log de videoconsulta:', error);
    // Não lançar erro, apenas logar
  }
}

/**
 * Gera um token único para a sala
 */
function generateRoomToken(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Formata duração em segundos para formato legível
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}
