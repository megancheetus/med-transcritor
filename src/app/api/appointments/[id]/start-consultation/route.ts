import { NextRequest, NextResponse } from "next/server";
import {
  getAppointmentById,
  updateAppointmentStatus,
  initializeAppointmentsTable,
} from "@/lib/appointmentManager";
import { getAuthenticatedUserFromRequest } from "@/lib/authSession";
import { createVideoConsultaRoom } from "@/lib/videoConsultationManager";
import { sendAppointmentConfirmationEmail } from "@/lib/emailService";
import { getPostgresPool } from "@/lib/postgres";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Start a video consultation for a scheduled appointment
 * POST /api/appointments/[id]/start-consultation
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    // Initialize tables
    await initializeAppointmentsTable();

    // Get auth session
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get appointment
    const appointment = await getAppointmentById(id);
    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    // Verify authorization
    if (appointment.professional_username !== user.username) {
      return NextResponse.json(
        { error: "Forbidden - not your appointment" },
        { status: 403 }
      );
    }

    // Check appointment status
    if (appointment.status === "cancelled") {
      return NextResponse.json(
        { error: "Cannot start consultation for cancelled appointment" },
        { status: 400 }
      );
    }

    if (appointment.status === "completed") {
      return NextResponse.json(
        { error: "This consultation has already been completed" },
        { status: 400 }
      );
    }

    // Check if appointment time is within reasonable window (30 min before to 120 min after)
    const now = new Date();
    const appointmentTime = new Date(appointment.scheduled_at);
    const minutesBefore = (appointmentTime.getTime() - now.getTime()) / (1000 * 60);
    const minutesAfter = (now.getTime() - appointmentTime.getTime()) / (1000 * 60);

    if (minutesBefore > 30) {
      return NextResponse.json(
        {
          error: `Consultation cannot be started 30 minutes before scheduled time. Time remaining: ${Math.round(minutesBefore)} minutes.`,
        },
        { status: 400 }
      );
    }

    if (minutesAfter > 120) {
      return NextResponse.json(
        {
          error: "Scheduled consultation time has passed (over 2 hours late)",
        },
        { status: 400 }
      );
    }

    // Create video consultation room
    try {
      const room = await createVideoConsultaRoom(
        user.username,
        appointment.patient_id
      );

      // Update appointment with room ID and status to 'confirmed'
      await updateAppointmentStatus(id, "confirmed", room.id);

      // Send confirmation email (async, don't await to not block response)
      try {
        const pool = getPostgresPool();
        
        const patientResult = await pool.query(
          `SELECT nome, email FROM patients WHERE id = $1`,
          [appointment.patient_id]
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
            appointmentDate: new Date(appointment.scheduled_at),
            appointmentType: appointment.tipo,
            appointmentDuration: appointment.duracao_minutos,
            appointmentNotes: appointment.notas,
          }).catch((err) => {
            console.error("Failed to send consultation confirmation email:", err);
          });
        }
      } catch (emailError) {
        console.error("Error preparing consultation confirmation email:", emailError);
        // Don't throw - email is secondary to consultation start
      }

      return NextResponse.json({
        success: true,
        message: "Video consultation room created",
        data: {
          roomId: room.id,
          roomToken: room.roomToken,
          appointmentId: appointment.id,
          redirectUrl: `/room/${room.id}`,
        },
      });
    } catch (error) {
      console.error("Error creating video room:", error);
      return NextResponse.json(
        { error: "Failed to create video consultation room", details: String(error) },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error starting consultation:", error);
    return NextResponse.json(
      { error: "Failed to start consultation", details: String(error) },
      { status: 500 }
    );
  }
}
