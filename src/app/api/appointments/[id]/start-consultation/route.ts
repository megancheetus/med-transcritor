import { NextRequest, NextResponse } from "next/server";
import {
  getAppointmentById,
  updateAppointmentStatus,
  initializeAppointmentsTable,
} from "@/lib/appointmentManager";
import { getAuthenticatedUserFromRequest } from "@/lib/authSession";
import { createVideoConsultaRoom } from "@/lib/videoConsultationManager";

/**
 * Start a video consultation for a scheduled appointment
 * POST /api/appointments/[id]/start-consultation
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Initialize tables
    await initializeAppointmentsTable();

    // Get auth session
    const user = await getAuthenticatedUserFromRequest(request);
    if (!user?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get appointment
    const appointment = await getAppointmentById(params.id);
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
      await updateAppointmentStatus(params.id, "confirmed", room.id);

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
