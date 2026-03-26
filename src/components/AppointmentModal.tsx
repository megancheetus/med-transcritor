"use client";

import React, { useEffect, useState } from "react";
import { Appointment } from "@/lib/appointmentManager";

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AppointmentFormData) => Promise<void>;
  selectedDate?: Date;
  appointment?: Appointment;
  isLoading?: boolean;
  patients: Array<{ id: string; nome: string; email: string }>;
}

export interface AppointmentFormData {
  patientId: string;
  scheduledAt: string;
  tipo: string;
  duracaoMinutos: number;
  notas: string;
}

export default function AppointmentModal({
  isOpen,
  onClose,
  onSubmit,
  selectedDate,
  appointment,
  isLoading = false,
  patients,
}: AppointmentModalProps) {
  const [formData, setFormData] = useState<AppointmentFormData>({
    patientId: "",
    scheduledAt: "",
    tipo: "consulta",
    duracaoMinutos: 30,
    notas: "",
  });

  const [error, setError] = useState<string>("");
  const [availableSlots, setAvailableSlots] = useState<Date[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    if (appointment) {
      const date = new Date(appointment.scheduled_at);
      setFormData({
        patientId: appointment.patient_id,
        scheduledAt: date.toISOString().slice(0, 16),
        tipo: appointment.tipo,
        duracaoMinutos: appointment.duracao_minutos,
        notas: appointment.notas || "",
      });
    } else if (selectedDate) {
      const dateStr = selectedDate.toISOString().slice(0, 16);
      setFormData((prev) => ({
        ...prev,
        scheduledAt: dateStr,
      }));
    }
  }, [appointment, selectedDate]);

  // Load available slots when date changes
  useEffect(() => {
    if (formData.scheduledAt && !appointment) {
      loadAvailableSlots();
    }
  }, [formData.scheduledAt, formData.duracaoMinutos]);

  const loadAvailableSlots = async () => {
    try {
      setLoadingSlots(true);
      const date = formData.scheduledAt.split("T")[0];

      const response = await fetch(
        `/api/appointments/available-slots?date=${date}&slotDuration=${formData.duracaoMinutos}`
      );

      if (!response.ok) throw new Error("Failed to load available slots");

      const data = await response.json();
      setAvailableSlots(
        data.data.map((slot: string) => new Date(slot))
      );
    } catch (err) {
      console.error("Error loading slots:", err);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      if (!formData.patientId || !formData.scheduledAt) {
        setError("Por favor, preencha todos os campos obrigatórios");
        return;
      }

      await onSubmit(formData);
      setFormData({
        patientId: "",
        scheduledAt: "",
        tipo: "consulta",
        duracaoMinutos: 30,
        notas: "",
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "Erro ao salvar agendamento");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-96 overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">
          {appointment ? "Editar Agendamento" : "Novo Agendamento"}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Patient Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Paciente *</label>
            {patients.length === 0 ? (
              <div className="p-3 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded text-sm">
                ⚠️ Nenhum paciente registrado. <a href="/prontuario" className="underline">Cadastre um paciente</a> primeiro.
              </div>
            ) : (
              <select
                value={formData.patientId}
                onChange={(e) =>
                  setFormData({ ...formData, patientId: e.target.value })
                }
                disabled={isLoading}
                className="w-full p-2 border rounded-md disabled:bg-gray-100"
              >
                <option value="">Selecione um paciente</option>
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.nome}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Date and Time */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Data e Hora *
            </label>
            <input
              type="datetime-local"
              value={formData.scheduledAt}
              onChange={(e) =>
                setFormData({ ...formData, scheduledAt: e.target.value })
              }
              disabled={isLoading}
              className="w-full p-2 border rounded-md disabled:bg-gray-100"
            />
          </div>

          {/* Appointment Type */}
          <div>
            <label className="block text-sm font-medium mb-2">Tipo</label>
            <select
              value={formData.tipo}
              onChange={(e) =>
                setFormData({ ...formData, tipo: e.target.value })
              }
              disabled={isLoading}
              className="w-full p-2 border rounded-md disabled:bg-gray-100"
            >
              <option value="consulta">Consulta</option>
              <option value="retorno">Retorno</option>
              <option value="exame">Exame</option>
              <option value="procedimento">Procedimento</option>
            </select>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Duração (minutos)
            </label>
            <select
              value={formData.duracaoMinutos}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  duracaoMinutos: parseInt(e.target.value),
                })
              }
              disabled={isLoading}
              className="w-full p-2 border rounded-md disabled:bg-gray-100"
            >
              <option value="15">15 minutos</option>
              <option value="30">30 minutos</option>
              <option value="45">45 minutos</option>
              <option value="60">1 hora</option>
              <option value="90">1 hora 30 min</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-2">Observações</label>
            <textarea
              value={formData.notas}
              onChange={(e) =>
                setFormData({ ...formData, notas: e.target.value })
              }
              disabled={isLoading}
              className="w-full p-2 border rounded-md disabled:bg-gray-100 resize-none"
              rows={3}
              placeholder="Notas adicionais..."
            />
          </div>

          {/* Available Slots (if not editing) */}
          {!appointment && availableSlots.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">Horários Disponíveis</label>
              <div className="grid grid-cols-3 gap-2 max-h-24 overflow-y-auto">
                {availableSlots.map((slot) => {
                  const slotStr = slot.toISOString().slice(0, 16);
                  return (
                    <button
                      key={slotStr}
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, scheduledAt: slotStr })
                      }
                      className={`p-2 text-xs rounded border transition-colors ${
                        formData.scheduledAt === slotStr
                          ? "bg-blue-500 text-white border-blue-600"
                          : "border-gray-300 hover:bg-gray-100"
                      }`}
                    >
                      {slot.toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? "Salvando..." : appointment ? "Atualizar" : "Agendar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
