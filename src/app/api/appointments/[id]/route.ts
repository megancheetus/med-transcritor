import { NextRequest, NextResponse } from "next/server";
import {
  getAppointmentById,
  updateAppointment,
  deleteAppointment,
  updateAppointmentStatus,
  initializeAppointmentsTable,
} from "@/lib/appointmentManager";
import { getAuthenticatedUserFromRequest } from "@/lib/authSession";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await initializeAppointmentsTable();

    const user = await getAuthenticatedUserFromRequest(request);
    if (!user?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appointment = await getAppointmentById(params.id);

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
  { params }: { params: { id: string } }
) {
  try {
    await initializeAppointmentsTable();

    const user = await getAuthenticatedUserFromRequest(request);
    if (!user?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appointment = await getAppointmentById(params.id);

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
        params.id,
        status,
        sala_videoconsulta_id
      );
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

    const updated = await updateAppointment(params.id, updates);

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
  { params }: { params: { id: string } }
) {
  try {
    await initializeAppointmentsTable();

    const user = await getAuthenticatedUserFromRequest(request);
    if (!user?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appointment = await getAppointmentById(params.id);

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

    const deleted = await deleteAppointment(params.id);

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
