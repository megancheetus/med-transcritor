import { NextRequest, NextResponse } from "next/server";
import {
  getAppointmentsByProfessional,
  getAppointmentsByPatient,
  createAppointment,
  initializeAppointmentsTable,
  checkAppointmentConflict,
  getAppointmentById,
} from "@/lib/appointmentManager";
import { getAuthenticatedUserFromRequest } from "@/lib/authSession";
import { sendAppointmentConfirmationEmail } from "@/lib/emailService";
import { getPostgresPool } from "@/lib/postgres";

export async function GET(request: NextRequest) {
  try {
    // Initialize table
    await initializeAppointmentsTable();

    // Get auth session
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const viewMode = searchParams.get("view"); // 'professional' or 'patient'
    const startDate = searchParams.get("start");
    const endDate = searchParams.get("end");
    const patientId = searchParams.get("patientId");

    const start = startDate ? new Date(startDate) : undefined;
    const end = endDate ? new Date(endDate) : undefined;

    let appointments;

    if (viewMode === "patient" && patientId) {
      // Get appointments for a specific patient
      appointments = await getAppointmentsByPatient(patientId, start, end);
    } else {
      // Get appointments for the professional (default)
      appointments = await getAppointmentsByProfessional(
        user.username,
        start,
        end
      );
    }

    return NextResponse.json({
      success: true,
      data: appointments,
      count: appointments.length,
    });
  } catch (error) {
    console.error("Error fetching appointments:", error);
    return NextResponse.json(
      { error: "Failed to fetch appointments", details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Initialize table
    await initializeAppointmentsTable();

    // Get auth session
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      patientId,
      scheduledAt,
      tipo = "consulta",
      duracaoMinutos = 30,
      notas,
    } = body;

    // Validation
    if (!patientId || !scheduledAt) {
      return NextResponse.json(
        { error: "Missing required fields: patientId, scheduledAt" },
        { status: 400 }
      );
    }

    const appointment_date = new Date(scheduledAt);

    // Check if date is in the future
    if (appointment_date < new Date()) {
      return NextResponse.json(
        { error: "Cannot schedule appointments in the past" },
        { status: 400 }
      );
    }

    // Check for conflicts
    const hasConflict = await checkAppointmentConflict(
      user.username,
      patientId,
      appointment_date,
      duracaoMinutos
    );

    if (hasConflict) {
      return NextResponse.json(
        {
          error: "Time slot conflict - professional has overlapping appointment",
        },
        { status: 409 }
      );
    }

    // Create appointment
    const appointment = await createAppointment(
      user.username,
      patientId,
      appointment_date,
      tipo,
      duracaoMinutos,
      notas
    );

    // Send confirmation email (async, don't await to not block response)
    try {
      // Get patient and professional data
      const pool = getPostgresPool();
      
      const patientResult = await pool.query(
        `SELECT nome, email FROM patients WHERE id = $1`,
        [patientId]
      );
      
      const professionalResult = await pool.query(
        `SELECT full_name FROM app_users WHERE username = $1`,
        [user.username]
      );

      const patient = patientResult.rows[0];
      const professional = professionalResult.rows[0];

      if (patient?.email && professional?.full_name) {
        // Send email asynchronously without blocking
        sendAppointmentConfirmationEmail({
          to: patient.email,
          patientName: patient.nome,
          professionalName: professional.full_name,
          appointmentDate: appointment_date,
          appointmentType: tipo,
          appointmentDuration: duracaoMinutos,
          appointmentNotes: notas,
        }).catch((err) => {
          console.error("Failed to send appointment confirmation email:", err);
        });
      }
    } catch (emailError) {
      console.error("Error preparing appointment confirmation email:", emailError);
      // Don't throw - email is secondary to appointment creation
    }

    return NextResponse.json(
      {
        success: true,
        message: "Appointment created successfully",
        data: appointment,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating appointment:", error);

    if (error.message?.includes("Já existe um agendamento")) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create appointment", details: String(error) },
      { status: 500 }
    );
  }
}
