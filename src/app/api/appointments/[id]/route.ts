import { NextRequest, NextResponse } from "next/server";
import {
  getAppointmentById,
  updateAppointment,
  deleteAppointment,
  updateAppointmentStatus,
  initializeAppointmentsTable,
} from "@/lib/appointmentManager";
import { getAuthenticatedUserFromRequest } from "@/lib/authSession";
import { sendAppointmentConfirmationEmail } from "@/lib/emailService";
import { getPostgresPool } from "@/lib/postgres";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    await initializeAppointmentsTable();

    const user = await getAuthenticatedUserFromRequest(request);
    if (!user?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appointment = await getAppointmentById(id);

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    // Check authorization - user must be the professional or admin
    if (appointment.professional_username !== user.username) {
      return NextResponse.json(
        { error: "Forbidden - not your appointment" },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, data: appointment });
  } catch (error) {
    console.error("Error fetching appointment:", error);
    return NextResponse.json(
      { error: "Failed to fetch appointment", details: String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    await initializeAppointmentsTable();

    const user = await getAuthenticatedUserFromRequest(request);
    if (!user?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appointment = await getAppointmentById(id);

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    // Check authorization
    if (appointment.professional_username !== user.username) {
      return NextResponse.json(
        { error: "Forbidden - not your appointment" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status, tipo, duracao_minutos, notas, sala_videoconsulta_id } =
      body;

    // If status is being updated to 'completed', can include room_id
    if (status) {
      const updated = await updateAppointmentStatus(
        id,
        status,
        sala_videoconsulta_id
      );

      // Send confirmation email if status changed to 'confirmed' (async, non-blocking)
      if (status === "confirmed") {
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
              console.error("Failed to send status update email:", err);
            });
          }
        } catch (emailError) {
          console.error("Error preparing status update email:", emailError);
          // Don't throw - email is secondary to appointment update
        }
      }

      return NextResponse.json({
        success: true,
        message: "Appointment updated successfully",
        data: updated,
      });
    }

    // Update other fields
    const updates: any = {};
    if (tipo !== undefined) updates.tipo = tipo;
    if (duracao_minutos !== undefined) updates.duracao_minutos = duracao_minutos;
    if (notas !== undefined) updates.notas = notas;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const updated = await updateAppointment(id, updates);

    return NextResponse.json({
      success: true,
      message: "Appointment updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("Error updating appointment:", error);
    return NextResponse.json(
      { error: "Failed to update appointment", details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    await initializeAppointmentsTable();

    const user = await getAuthenticatedUserFromRequest(request);
    if (!user?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appointment = await getAppointmentById(id);

    if (!appointment) {
      return NextResponse.json(
        { error: "Appointment not found" },
        { status: 404 }
      );
    }

    // Check authorization
    if (appointment.professional_username !== user.username) {
      return NextResponse.json(
        { error: "Forbidden - not your appointment" },
        { status: 403 }
      );
    }

    const deleted = await deleteAppointment(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Failed to delete appointment" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Appointment deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting appointment:", error);

    if (error.message?.includes("Cannot delete")) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete appointment", details: String(error) },
      { status: 500 }
    );
  }
}
