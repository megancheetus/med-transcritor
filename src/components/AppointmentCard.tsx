"use client";

import React, { useState, useEffect } from "react";
import { AppointmentWithPatientInfo } from "@/lib/appointmentManager";
import { useRouter } from "next/navigation";

interface AppointmentCardProps {
  appointment: AppointmentWithPatientInfo;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  expanded?: boolean;
  onStartConsultation?: () => Promise<void>;
  onStatusChange?: (status: string) => Promise<void>;
}

export default function AppointmentCard({
  appointment,
  onEdit,
  onDelete,
  expanded = false,
  onStartConsultation,
  onStatusChange,
}: AppointmentCardProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [startingConsult, setStartingConsult] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [canStart, setCanStart] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const checkCanStart = () => {
      const now = new Date();
      const appointmentTime = new Date(appointment.scheduled_at);
      const minutesBefore =
        (appointmentTime.getTime() - now.getTime()) / (1000 * 60);
      const minutesAfter = 
        (now.getTime() - appointmentTime.getTime()) / (1000 * 60);

      // Can start 30 min before or until 2 hours after
      const can =
        appointment.status !== "cancelled" &&
        appointment.status !== "completed" &&
        minutesBefore <= 30 &&
        minutesAfter <= 120;

      setCanStart(can);
    };

    checkCanStart();
    const interval = setInterval(checkCanStart, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, [appointment]);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Tem certeza que deseja cancelar este agendamento?")) {
      setDeleting(true);
      try {
        await onDelete();
      } finally {
        setDeleting(false);
      }
    }
  };

  const handleStatusChange = async (e: React.MouseEvent, newStatus: string) => {
    e.stopPropagation();
    if (!onStatusChange) return;
    setChangingStatus(true);
    setError("");
    try {
      await onStatusChange(newStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar status");
    } finally {
      setChangingStatus(false);
    }
  };

  const handleStartConsultation = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setStartingConsult(true);
    setError("");

    try {
      const response = await fetch(
        `/api/appointments/${appointment.id}/start-consultation`,
        { method: "POST" }
      );

      if (!response.ok) {
        const data = await response.json();
        const message =
          data.error ||
          `HTTP ${response.status}: Failed to start consultation`;
        setError(message);
        return;
      }

      const data = await response.json();

      // Redirect to video room
      if (data.data?.redirectUrl) {
        router.push(data.data.redirectUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setStartingConsult(false);
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "America/Sao_Paulo",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "scheduled":
        return "bg-blue-100 border-blue-500 text-blue-800";
      case "confirmed":
        return "bg-green-100 border-green-500 text-green-800";
      case "completed":
        return "bg-gray-100 border-gray-500 text-gray-800";
      case "cancelled":
        return "bg-red-100 border-red-500 text-red-800";
      case "no_show":
        return "bg-yellow-100 border-yellow-500 text-yellow-800";
      default:
        return "bg-gray-100 border-gray-500 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      scheduled: "Agendado",
      confirmed: "Confirmado",
      completed: "Concluído",
      cancelled: "Cancelado",
      no_show: "Não Compareceu",
    };
    return labels[status] || status;
  };

  if (expanded) {
    return (
      <div className="bg-white rounded-lg shadow border-l-4 border-blue-500 p-6 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              {appointment.patient_nome}
            </h3>
            <p className="text-gray-600">
              {appointment.patient_email}
              {appointment.patient_telefone && ` • ${appointment.patient_telefone}`}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-semibold border ${getStatusColor(
              appointment.status
            )}`}
          >
            {getStatusLabel(appointment.status)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-500 font-medium">Data</div>
            <div className="text-gray-900">{formatDate(appointment.scheduled_at)}</div>
          </div>
          <div>
            <div className="text-gray-500 font-medium">Horário</div>
            <div className="text-gray-900">{formatTime(appointment.scheduled_at)}</div>
          </div>
          <div>
            <div className="text-gray-500 font-medium">Tipo</div>
            <div className="text-gray-900 capitalize">{appointment.tipo}</div>
          </div>
          <div>
            <div className="text-gray-500 font-medium">Duração</div>
            <div className="text-gray-900">{appointment.duracao_minutos} min</div>
          </div>
        </div>

        {appointment.notas && (
          <div>
            <div className="text-gray-500 font-medium mb-1">Observações</div>
            <div className="text-gray-700 bg-gray-50 p-3 rounded">
              {appointment.notas}
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-4 border-t">
          {canStart ? (
            <button
              onClick={handleStartConsultation}
              disabled={startingConsult}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 font-medium transition-colors"
            >
              {startingConsult ? "Iniciando..." : "🎥 Iniciar Consulta"}
            </button>
          ) : (
            <button
              disabled
              className="flex-1 px-4 py-2 bg-gray-300 text-gray-500 rounded-md cursor-not-allowed"
            >
              Não disponível
            </button>
          )}

          {appointment.status === "scheduled" && onStatusChange && (
            <button
              onClick={(e) => handleStatusChange(e, "confirmed")}
              disabled={changingStatus}
              className="px-4 py-2 border border-emerald-500 text-emerald-600 rounded-md hover:bg-emerald-50 disabled:opacity-50 font-medium transition-colors"
            >
              {changingStatus ? "..." : "✔ Confirmar"}
            </button>
          )}

          {(appointment.status === "scheduled" || appointment.status === "confirmed") && onStatusChange && (
            <button
              onClick={(e) => handleStatusChange(e, "completed")}
              disabled={changingStatus}
              className="px-4 py-2 border border-slate-500 text-slate-600 rounded-md hover:bg-slate-50 disabled:opacity-50 font-medium transition-colors"
            >
              {changingStatus ? "..." : "✅ Finalizar"}
            </button>
          )}

          {(appointment.status === "scheduled" || appointment.status === "confirmed") && onStatusChange && (
            <button
              onClick={(e) => handleStatusChange(e, "no_show")}
              disabled={changingStatus}
              className="px-4 py-2 border border-yellow-500 text-yellow-600 rounded-md hover:bg-yellow-50 disabled:opacity-50 font-medium transition-colors"
            >
              {changingStatus ? "..." : "Não Compareceu"}
            </button>
          )}

          <button
            onClick={onEdit}
            className="px-4 py-2 border border-yellow-500 text-yellow-600 rounded-md hover:bg-yellow-50 transition-colors"
          >
            ✏️ Editar
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-4 py-2 border border-red-500 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {deleting ? "..." : "🗑️"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg p-3 border-l-4 cursor-pointer hover:shadow-md transition-shadow ${getStatusColor(appointment.status)}`}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <div className="font-semibold text-sm">{formatTime(appointment.scheduled_at)}</div>
          <div className="text-xs opacity-75 truncate">{appointment.patient_nome}</div>
        </div>
        {canStart && (
          <button
            onClick={handleStartConsultation}
            disabled={startingConsult}
            className="ml-2 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
            title="Iniciar consulta"
          >
            🎥
          </button>
        )}
      </div>
      <div className="hidden group-hover:flex gap-1">
        <button
          onClick={onEdit}
          className="flex-1 p-1 bg-yellow-500 text-white rounded text-xs hover:bg-yellow-600"
        >
          ✏️
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex-1 p-1 bg-red-500 text-white rounded text-xs hover:bg-red-600 disabled:opacity-50"
        >
          {deleting ? "..." : "🗑️"}
        </button>
      </div>
    </div>
  );
}
