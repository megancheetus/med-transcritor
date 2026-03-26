import { getPostgresPool } from "./postgres";
import { randomBytes } from "crypto";

export interface Appointment {
  id: string;
  professional_username: string;
  patient_id: string;
  scheduled_at: string; // ISO 8601 timestamp
  tipo: string; // 'consulta' | 'retorno' | 'exame' | etc
  status: "scheduled" | "confirmed" | "cancelled" | "no_show" | "completed";
  duracao_minutos: number;
  notas?: string;
  sala_videoconsulta_id?: string;
  created_at: string;
  updated_at: string;
}

export interface AppointmentWithPatientInfo extends Appointment {
  patient_nome?: string;
  patient_email?: string;
  patient_telefone?: string;
}

/**
 * Initialize the appointments table in the database
 */
export async function initializeAppointmentsTable(): Promise<void> {
  const pool = getPostgresPool();

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        professional_username VARCHAR(255) NOT NULL REFERENCES app_users(username),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        scheduled_at TIMESTAMP NOT NULL,
        tipo VARCHAR(32) DEFAULT 'consulta',
        status VARCHAR(32) DEFAULT 'scheduled' 
          CHECK (status IN ('scheduled', 'confirmed', 'cancelled', 'no_show', 'completed')),
        duracao_minutos INT DEFAULT 30,
        notas TEXT,
        sala_videoconsulta_id UUID REFERENCES videoconsulta_rooms(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        
        CONSTRAINT unique_appointment_slot 
          UNIQUE(professional_username, patient_id, scheduled_at)
      );

      CREATE INDEX IF NOT EXISTS idx_appointments_professional_scheduled 
        ON appointments(professional_username, scheduled_at);
      
      CREATE INDEX IF NOT EXISTS idx_appointments_patient_scheduled 
        ON appointments(patient_id, scheduled_at);
      
      CREATE INDEX IF NOT EXISTS idx_appointments_status 
        ON appointments(status);
      
      CREATE INDEX IF NOT EXISTS idx_appointments_videoconsulta_id 
        ON appointments(sala_videoconsulta_id);
    `);

    console.log("✅ Appointments table initialized successfully");
  } catch (error) {
    console.error("Error initializing appointments table:", error);
    throw error;
  }
}

/**
 * Create a new appointment
 */
export async function createAppointment(
  professionalUsername: string,
  patientId: string,
  scheduledAt: Date,
  tipo: string = "consulta",
  duracaoMinutos: number = 30,
  notas?: string
): Promise<Appointment> {
  const pool = getPostgresPool();
  const now = new Date();

  try {
    const result = await pool.query(
      `INSERT INTO appointments (
        professional_username, patient_id, scheduled_at, 
        tipo, duracao_minutos, notas, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        professionalUsername,
        patientId,
        scheduledAt,
        tipo,
        duracaoMinutos,
        notas || null,
        now,
        now,
      ]
    );

    return mapRowToAppointment(result.rows[0]);
  } catch (error) {
    if ((error as any)?.code === "23505") {
      throw new Error(
        "Já existe um agendamento para este paciente neste horário"
      );
    }
    throw error;
  }
}

/**
 * Get appointments for a professional within a date range
 */
export async function getAppointmentsByProfessional(
  professionalUsername: string,
  startDate?: Date,
  endDate?: Date
): Promise<AppointmentWithPatientInfo[]> {
  const pool = getPostgresPool();

  let query = `
    SELECT 
      a.*,
      p.nome as patient_nome,
      p.email as patient_email,
      p.telefone as patient_telefone
    FROM appointments a
    LEFT JOIN patients p ON a.patient_id = p.id
    WHERE a.professional_username = $1
  `;

  const params: any[] = [professionalUsername];

  if (startDate && endDate) {
    query += ` AND a.scheduled_at BETWEEN $2 AND $3`;
    params.push(startDate, endDate);
  }

  query += ` ORDER BY a.scheduled_at ASC`;

  try {
    const result = await pool.query(query, params);
    return result.rows.map(mapRowToAppointment) as AppointmentWithPatientInfo[];
  } catch (error) {
    console.error("Error fetching appointments:", error);
    throw error;
  }
}

/**
 * Get appointments for a patient within a date range
 */
export async function getAppointmentsByPatient(
  patientId: string,
  startDate?: Date,
  endDate?: Date
): Promise<Appointment[]> {
  const pool = getPostgresPool();

  let query = `
    SELECT * FROM appointments
    WHERE patient_id = $1
  `;

  const params: any[] = [patientId];

  if (startDate && endDate) {
    query += ` AND scheduled_at BETWEEN $2 AND $3`;
    params.push(startDate, endDate);
  }

  query += ` ORDER BY scheduled_at ASC`;

  try {
    const result = await pool.query(query, params);
    return result.rows.map(mapRowToAppointment);
  } catch (error) {
    console.error("Error fetching patient appointments:", error);
    throw error;
  }
}

/**
 * Get a single appointment by ID
 */
export async function getAppointmentById(appointmentId: string): Promise<Appointment | null> {
  const pool = getPostgresPool();

  try {
    const result = await pool.query(
      `SELECT * FROM appointments WHERE id = $1`,
      [appointmentId]
    );

    if (result.rows.length === 0) return null;
    return mapRowToAppointment(result.rows[0]);
  } catch (error) {
    console.error("Error fetching appointment:", error);
    throw error;
  }
}

/**
 * Update appointment status
 */
export async function updateAppointmentStatus(
  appointmentId: string,
  status: "scheduled" | "confirmed" | "cancelled" | "no_show" | "completed",
  roomId?: string
): Promise<Appointment> {
  const pool = getPostgresPool();
  const now = new Date();

  try {
    const query = roomId
      ? `UPDATE appointments 
         SET status = $1, sala_videoconsulta_id = $2, updated_at = $3
         WHERE id = $4
         RETURNING *`
      : `UPDATE appointments 
         SET status = $1, updated_at = $2
         WHERE id = $3
         RETURNING *`;

    const params = roomId ? [status, roomId, now, appointmentId] : [status, now, appointmentId];

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      throw new Error("Appointment not found");
    }

    return mapRowToAppointment(result.rows[0]);
  } catch (error) {
    console.error("Error updating appointment:", error);
    throw error;
  }
}

/**
 * Update appointment details
 */
export async function updateAppointment(
  appointmentId: string,
  updates: Partial<Appointment>
): Promise<Appointment> {
  const pool = getPostgresPool();
  const now = new Date();

  const allowedFields = ["tipo", "duracao_minutos", "notas", "status"];
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key) && value !== undefined) {
      fields.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (fields.length === 0) {
    throw new Error("No valid fields to update");
  }

  fields.push(`updated_at = $${paramIndex}`);
  values.push(now);
  paramIndex++;

  values.push(appointmentId);

  const query = `
    UPDATE appointments
    SET ${fields.join(", ")}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  try {
    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      throw new Error("Appointment not found");
    }

    return mapRowToAppointment(result.rows[0]);
  } catch (error) {
    console.error("Error updating appointment:", error);
    throw error;
  }
}

/**
 * Cancel an appointment
 */
export async function cancelAppointment(
  appointmentId: string,
  motivo?: string
): Promise<Appointment> {
  return updateAppointment(appointmentId, {
    status: "cancelled",
    notas: motivo
      ? `Cancelado: ${motivo}`
      : "Cancelado",
  } as any);
}

/**
 * Delete an appointment (only if scheduled)
 */
export async function deleteAppointment(appointmentId: string): Promise<boolean> {
  const pool = getPostgresPool();

  try {
    const appointment = await getAppointmentById(appointmentId);
    if (!appointment) {
      throw new Error("Appointment not found");
    }

    if (appointment.status !== "scheduled") {
      throw new Error(
        `Cannot delete appointment with status: ${appointment.status}`
      );
    }

    const result = await pool.query(
      `DELETE FROM appointments WHERE id = $1`,
      [appointmentId]
    );

    return result.rowCount! > 0;
  } catch (error) {
    console.error("Error deleting appointment:", error);
    throw error;
  }
}

/**
 * Get available time slots for a professional on a specific date
 */
export async function getAvailableSlots(
  professionalUsername: string,
  date: Date,
  slotDurationMinutes: number = 30,
  workStartHour: number = 8,
  workEndHour: number = 18
): Promise<Date[]> {
  const pool = getPostgresPool();

  const startOfDay = new Date(date);
  startOfDay.setHours(workStartHour, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(workEndHour, 0, 0, 0);

  try {
    const result = await pool.query(
      `SELECT scheduled_at, duracao_minutos FROM appointments
       WHERE professional_username = $1 
       AND scheduled_at BETWEEN $2 AND $3
       AND status != 'cancelled'
       ORDER BY scheduled_at ASC`,
      [professionalUsername, startOfDay, endOfDay]
    );

    const bookedSlots = new Set<number>();

    result.rows.forEach((row: any) => {
      const slotStart = new Date(row.scheduled_at).getTime();
      const slotEnd = slotStart + row.duracao_minutos * 60 * 1000;

      // Mark all minutes as booked
      let current = slotStart;
      while (current < slotEnd) {
        bookedSlots.add(current);
        current += slotDurationMinutes * 60 * 1000;
      }
    });

    const availableSlots: Date[] = [];
    let current = startOfDay.getTime();

    while (current < endOfDay.getTime()) {
      if (!bookedSlots.has(current)) {
        availableSlots.push(new Date(current));
      }
      current += slotDurationMinutes * 60 * 1000;
    }

    return availableSlots;
  } catch (error) {
    console.error("Error fetching available slots:", error);
    throw error;
  }
}

/**
 * Check for conflicts with existing appointments
 */
export async function checkAppointmentConflict(
  professionalUsername: string,
  patientId: string,
  scheduledAt: Date,
  duracaoMinutos: number = 30
): Promise<boolean> {
  const pool = getPostgresPool();

  const startTime = new Date(scheduledAt);
  const endTime = new Date(scheduledAt.getTime() + duracaoMinutos * 60 * 1000);

  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM appointments
       WHERE professional_username = $1
       AND scheduled_at < $2
       AND (scheduled_at + INTERVAL '1 minute' * duracao_minutos) > $3
       AND status != 'cancelled'`,
      [professionalUsername, endTime, startTime]
    );

    return parseInt(result.rows[0].count, 10) > 0;
  } catch (error) {
    console.error("Error checking appointment conflict:", error);
    throw error;
  }
}

/**
 * Get upcoming appointments (next 7 days)
 */
export async function getUpcomingAppointments(
  professionalUsername: string
): Promise<AppointmentWithPatientInfo[]> {
  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  return getAppointmentsByProfessional(
    professionalUsername,
    now,
    sevenDaysLater
  );
}

/**
 * Helper function to map database row to Appointment object
 */
function mapRowToAppointment(row: any): Appointment {
  return {
    id: row.id,
    professional_username: row.professional_username,
    patient_id: row.patient_id,
    scheduled_at: new Date(row.scheduled_at).toISOString(),
    tipo: row.tipo,
    status: row.status,
    duracao_minutos: row.duracao_minutos,
    notas: row.notas,
    sala_videoconsulta_id: row.sala_videoconsulta_id,
    created_at: new Date(row.created_at).toISOString(),
    updated_at: new Date(row.updated_at).toISOString(),
  };
}
