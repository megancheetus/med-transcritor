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
