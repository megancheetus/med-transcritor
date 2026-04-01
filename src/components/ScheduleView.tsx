"use client";

import React, { useState, useEffect } from "react";
import { AppointmentWithPatientInfo } from "@/lib/appointmentManager";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [deleting, setDeleting] = useState<string | false>(false);

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

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

  const openPatientInfo = (patientId: string) => {
    const params = new URLSearchParams();
    params.set("patientId", patientId);
    router.push(`/prontuario?${params.toString()}`);
  };

  if (viewMode === "week") {
    const weekDays = getWeekDays(currentDate);

    return (
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <button
            onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - 7)))}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            ← Semana Anterior
          </button>
          <h3 className="text-sm font-semibold text-slate-800 md:text-base">
            {weekDays[0].toLocaleDateString("pt-BR")} -{" "}
            {weekDays[6].toLocaleDateString("pt-BR")}
          </h3>
          <button
            onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + 7)))}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
          >
            Próxima Semana →
          </button>
        </div>

        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 px-2 py-1">
          {weekDays.map((day) => (
            <div
              key={`label-${day.toISOString()}`}
              className="p-2 text-center text-xs font-bold uppercase tracking-wide text-slate-500"
            >
              {day.toLocaleDateString("pt-BR", { weekday: "short" })}
            </div>
          ))}
        </div>

        {/* Week Grid */}
        <div className="grid grid-cols-1 gap-px bg-slate-200 p-2 md:grid-cols-7">
          {weekDays.map((day) => {
            const dayAppts = getAppointmentsForDate(day);
            const dayIsToday = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className="group min-h-32 bg-white p-2 transition-colors hover:bg-slate-50"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div
                    className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold ${
                      dayIsToday ? "bg-blue-600 text-white" : "text-slate-700"
                    }`}
                  >
                    {day.getDate()}
                  </div>
                  <button
                    onClick={() => onSelectDate(day)}
                    className="rounded-md border border-emerald-300 bg-white px-2 py-0.5 text-xs font-semibold text-emerald-700 opacity-0 transition-opacity hover:bg-emerald-50 group-hover:opacity-100"
                    title="Novo agendamento"
                  >
                    +
                  </button>
                </div>

                <div className="space-y-1">
                  {dayAppts.slice(0, 5).map((apt) => (
                    <div
                      key={apt.id}
                      className="rounded-sm border border-emerald-600/20 bg-emerald-500/95 px-1.5 py-1 text-[11px] text-white"
                    >
                      <div className="font-semibold">{formatTime(apt.scheduled_at)}</div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openPatientInfo(apt.patient_id);
                        }}
                        className="max-w-full truncate text-left underline decoration-white/70 underline-offset-2"
                        title={`Abrir prontuário de ${apt.patient_nome}`}
                      >
                        {apt.patient_nome}
                      </button>
                      <div className="mt-1 flex gap-1">
                        <button
                          onClick={() => onEditAppointment(apt)}
                          className="rounded bg-amber-500 px-1 py-0.5 text-[10px] font-semibold text-white hover:bg-amber-600"
                          title="Editar"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(apt.id)}
                          disabled={deleting === apt.id}
                          className="rounded bg-red-500 px-1 py-0.5 text-[10px] font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                          title="Cancelar"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ))}

                  {dayAppts.length > 5 && (
                    <div className="text-[10px] font-medium text-slate-500">+{dayAppts.length - 5} mais</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
          Dica: use o botão + no canto do dia para criar agendamento rapidamente e clique no nome do paciente para abrir o prontuário.
        </div>
      </div>
    );
  }

  // Month view
  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const days: Array<Date | null> = [];

  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));
  }

  while (days.length < 42) {
    days.push(null);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
        <button
          onClick={() =>
            setCurrentDate(
              new Date(currentDate.getFullYear(), currentDate.getMonth() - 1)
            )
          }
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
        >
          ← Mês Anterior
        </button>
        <h3 className="text-base font-semibold capitalize text-slate-900 md:text-lg">
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
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
        >
          Próximo Mês →
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 px-2 py-1">
        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"].map((day) => (
          <div key={day} className="p-2 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
            {day}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-px bg-slate-200 p-2">
        {days.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="min-h-20 bg-slate-100 md:min-h-24" />;
          }

          const dayAppts = getAppointmentsForDate(day);
          const dayIsToday = isToday(day);
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();

          return (
            <div
              key={day.toISOString()}
              className={`group min-h-20 cursor-pointer bg-white p-1.5 transition-colors hover:bg-slate-50 md:min-h-24 ${
                !isCurrentMonth ? "opacity-60" : ""
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <div
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
                    dayIsToday
                      ? "bg-blue-600 text-white"
                      : "text-slate-700"
                  }`}
                >
                  {day.getDate()}
                </div>
                {dayAppts.length > 0 && (
                  <span className="text-[10px] font-medium text-slate-500">
                    {dayAppts.length}
                  </span>
                )}
              </div>

              <button
                onClick={() => onSelectDate(day)}
                className="mb-1 rounded-md border border-emerald-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-700 opacity-100 transition-colors hover:bg-emerald-50 md:opacity-0 md:group-hover:opacity-100"
                title="Novo agendamento"
              >
                + Novo
              </button>

              <div className="space-y-1">
                {dayAppts.slice(0, 3).map((apt) => (
                  <div
                    key={apt.id}
                    className="rounded-sm bg-emerald-500/95 px-1 py-0.5 text-[10px] leading-3 text-white hover:bg-emerald-600"
                    onClick={() => onEditAppointment(apt)}
                    title={`${apt.patient_nome} - ${formatTime(apt.scheduled_at)}`}
                  >
                    <div className="font-semibold">{formatTime(apt.scheduled_at)}</div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openPatientInfo(apt.patient_id);
                      }}
                      className="max-w-full truncate text-left underline decoration-white/70 underline-offset-2"
                      title={`Abrir prontuário de ${apt.patient_nome}`}
                    >
                      {apt.patient_nome}
                    </button>
                  </div>
                ))}
                {dayAppts.length > 3 && (
                  <div className="text-[10px] font-medium text-slate-500">+{dayAppts.length - 3} mais</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
        Dica: use o botão + no dia para novo agendamento e clique no nome do paciente para abrir o prontuário.
      </div>
    </div>
  );
}
