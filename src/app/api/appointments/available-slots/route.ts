import { NextRequest, NextResponse } from "next/server";
import { getAvailableSlots, initializeAppointmentsTable } from "@/lib/appointmentManager";
import { getAuthenticatedUserFromRequest } from "@/lib/authSession";

export async function GET(request: NextRequest) {
  try {
    await initializeAppointmentsTable();

    const user = await getAuthenticatedUserFromRequest(request);
    if (!user?.username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const slotDuration = searchParams.get("slotDuration") || "30";
    const workStartHour = searchParams.get("workStartHour") || "8";
    const workEndHour = searchParams.get("workEndHour") || "18";

    if (!date) {
      return NextResponse.json(
        { error: "Missing required parameter: date" },
        { status: 400 }
      );
    }

    const selectedDate = new Date(date);

    // Validate date format
    if (isNaN(selectedDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format" },
        { status: 400 }
      );
    }

    const slots = await getAvailableSlots(
      user.username,
      selectedDate,
      parseInt(slotDuration, 10),
      parseInt(workStartHour, 10),
      parseInt(workEndHour, 10)
    );

    return NextResponse.json({
      success: true,
      date: date,
      data: slots.map((slot) => slot.toISOString()),
      count: slots.length,
    });
  } catch (error) {
    console.error("Error fetching available slots:", error);
    return NextResponse.json(
      { error: "Failed to fetch available slots", details: String(error) },
      { status: 500 }
    );
  }
}
