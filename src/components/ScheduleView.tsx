"use client";

import React, { useState, useEffect } from "react";
import { AppointmentWithPatientInfo } from "@/lib/appointmentManager";

interface ScheduleViewProps {
  appointments: AppointmentWithPatientInfo[];
  onSelectDate: (date: Date) => void;
  onEditAppointment: (appointment: AppointmentWithPatientInfo) => void;
  onDeleteAppointment: (appointmentId: string) => Promise<void>;
  viewMode: "week" | "month";
}

export default function ScheduleView({
  appointments,
  onSelectDate,
  onEditAppointment,
  onDeleteAppointment,
  viewMode,
}: ScheduleViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [deleting, setDeleting] = useState<string | false>(false);

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getWeekDays = (date: Date) => {
    const curr = new Date(date);
    const first = curr.getDate() - curr.getDay();

    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(curr.setDate(first + i)));
    }
    return days;
  };

  const getAppointmentsForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return appointments.filter((apt) =>
      apt.scheduled_at.startsWith(dateStr)
    );
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDelete = async (appointmentId: string) => {
    if (
      confirm("Tem certeza que deseja cancelar este agendamento?")
    ) {
      setDeleting(appointmentId);
      try {
        await onDeleteAppointment(appointmentId);
      } finally {
        setDeleting(false);
      }
    }
  };

  if (viewMode === "week") {
    const weekDays = getWeekDays(currentDate);

    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Header */}
        <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
          <button
            onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)))}
            className="px-3 py-2 border rounded-md hover:bg-white"
          >
            ← Semana Anterior
          </button>
          <h3 className="text-lg font-semibold">
            {weekDays[0].toLocaleDateString("pt-BR")} -{" "}
            {weekDays[6].toLocaleDateString("pt-BR")}
          </h3>
          <button
            onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)))}
            className="px-3 py-2 border rounded-md hover:bg-white"
          >
            Próxima Semana →
          </button>
        </div>

        {/* Week Grid */}
        <div className="grid grid-cols-7 gap-1 p-2 bg-gray-50">
          {weekDays.map((day) => {
            const dayAppts = getAppointmentsForDate(day);
            const dayName = day.toLocaleDateString("pt-BR", { weekday: "short" });
            const dayNum = day.getDate();

            return (
              <div
                key={day.toISOString()}
                className="border rounded-lg bg-white p-2 min-h-32"
              >
                <div className="font-semibold text-sm text-gray-600 mb-2">
                  {dayName} {dayNum}
                </div>
                <div className="space-y-1">
                  {dayAppts.map((apt) => (
                    <div
                      key={apt.id}
                      className="bg-blue-50 border-l-4 border-blue-500 p-1 text-xs rounded cursor-pointer hover:bg-blue-100 group relative"
                    >
                      <div className="font-semibold">{formatTime(apt.scheduled_at)}</div>
                      <div className="text-gray-700 truncate">{apt.patient_nome}</div>
                      <div className="absolute hidden group-hover:flex gap-1 right-1 top-1">
                        <button
                          onClick={() => onEditAppointment(apt)}
                          className="p-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(apt.id)}
                          disabled={deleting === apt.id}
                          className="p-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                          title="Deletar"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => onSelectDate(day)}
                  className="mt-2 w-full p-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                >
                  + Novo
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Month view
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const days = [];

  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
        <button
          onClick={() =>
            setCurrentDate(
              new Date(currentDate.getFullYear(), currentDate.getMonth() - 1)
            )
          }
          className="px-3 py-2 border rounded-md hover:bg-white"
        >
          ← Mês Anterior
        </button>
        <h3 className="text-lg font-semibold">
          {currentDate.toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric",
          })}
        </h3>
        <button
          onClick={() =>
            setCurrentDate(
              new Date(currentDate.getFullYear(), currentDate.getMonth() + 1)
            )
          }
          className="px-3 py-2 border rounded-md hover:bg-white"
        >
          Próximo Mês →
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 p-2">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map((day) => (
          <div key={day} className="bg-gray-50 p-2 text-center font-bold text-sm">
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-px bg-gray-200 p-2">
        {days.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="bg-white p-2 min-h-24" />;
          }

          const dayAppts = getAppointmentsForDate(day);

          return (
            <div
              key={day.toISOString()}
              className="bg-white p-2 min-h-24 hover:bg-gray-50 cursor-pointer"
            >
              <div className="font-semibold text-sm mb-1">{day.getDate()}</div>
              <div className="space-y-1 text-xs">
                {dayAppts.slice(0, 2).map((apt) => (
                  <div
                    key={apt.id}
                    className="bg-blue-100 text-blue-800 p-1 rounded truncate hover:bg-blue-200"
                    onClick={() => onEditAppointment(apt)}
                    title={`${apt.patient_nome} - ${formatTime(apt.scheduled_at)}`}
                  >
                    {formatTime(apt.scheduled_at)} {apt.patient_nome}
                  </div>
                ))}
                {dayAppts.length > 2 && (
                  <div className="text-gray-600">+{dayAppts.length - 2} mais</div>
                )}
              </div>
              <button
                onClick={() => onSelectDate(day)}
                className="mt-1 w-full p-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
              >
                +
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
