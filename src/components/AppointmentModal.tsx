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

  /**
   * Format a Date to a datetime-local string (YYYY-MM-DDTHH:MM) in BRT.
   * Uses Intl to always produce the America/Sao_Paulo representation,
   * regardless of the browser's own timezone setting.
   */
  const toDatetimeLocal = (d: Date) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
  };

  useEffect(() => {
    if (appointment) {
      const date = new Date(appointment.scheduled_at);
      setFormData({
        patientId: appointment.patient_id,
        scheduledAt: toDatetimeLocal(date),
        tipo: appointment.tipo,
        duracaoMinutos: appointment.duracao_minutos,
        notas: appointment.notas || "",
      });
    } else if (selectedDate) {
      const dateStr = toDatetimeLocal(selectedDate);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-xl font-bold text-slate-900 md:text-2xl">
            {appointment ? "Editar Agendamento" : "Novo Agendamento"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Organize o atendimento selecionando paciente, horário e detalhes da consulta.
          </p>
        </div>

        {error && (
          <div className="mx-6 mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid gap-0 md:grid-cols-12">
          <div className="space-y-4 border-b border-slate-200 bg-slate-50 p-6 md:col-span-4 md:border-b-0 md:border-r">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">Paciente *</label>
              {patients.length === 0 ? (
                <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700">
                ⚠️ Nenhum paciente registrado. <a href="/prontuario" className="underline">Cadastre um paciente</a> primeiro.
                </div>
              ) : (
                <select
                  value={formData.patientId}
                  onChange={(e) =>
                    setFormData({ ...formData, patientId: e.target.value })
                  }
                  disabled={isLoading}
                  className="w-full rounded-md border border-slate-300 bg-white p-2.5 text-sm text-slate-800 disabled:bg-slate-100"
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

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">Tipo</label>
              <select
                value={formData.tipo}
                onChange={(e) =>
                  setFormData({ ...formData, tipo: e.target.value })
                }
                disabled={isLoading}
                className="w-full rounded-md border border-slate-300 bg-white p-2.5 text-sm text-slate-800 disabled:bg-slate-100"
              >
                <option value="consulta">Consulta</option>
                <option value="retorno">Retorno</option>
                <option value="exame">Exame</option>
                <option value="procedimento">Procedimento</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">
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
                className="w-full rounded-md border border-slate-300 bg-white p-2.5 text-sm text-slate-800 disabled:bg-slate-100"
              >
                <option value="15">15 minutos</option>
                <option value="30">30 minutos</option>
                <option value="45">45 minutos</option>
                <option value="60">1 hora</option>
                <option value="90">1 hora 30 min</option>
              </select>
            </div>
          </div>

          <div className="space-y-4 p-6 md:col-span-8">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                Data e Hora *
              </label>
              <input
                type="datetime-local"
                value={formData.scheduledAt}
                onChange={(e) =>
                  setFormData({ ...formData, scheduledAt: e.target.value })
                }
                disabled={isLoading}
                className="w-full rounded-md border border-slate-300 bg-white p-2.5 text-sm text-slate-800 disabled:bg-slate-100"
              />
            </div>

            {!appointment && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-600">
                    Horários Disponíveis
                  </label>
                  {loadingSlots && <span className="text-xs text-slate-500">Carregando...</span>}
                </div>

                {availableSlots.length > 0 ? (
                  <div className="grid max-h-44 grid-cols-3 gap-2 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-5">
                    {availableSlots.map((slot) => {
                      const slotStr = toDatetimeLocal(slot);
                      return (
                        <button
                          key={slotStr}
                          type="button"
                          onClick={() =>
                            setFormData({ ...formData, scheduledAt: slotStr })
                          }
                          className={`rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                            formData.scheduledAt === slotStr
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {slot.toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "America/Sao_Paulo",
                          })}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                    Nenhum horário disponível para a data selecionada.
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-600">Observações</label>
              <textarea
                value={formData.notas}
                onChange={(e) =>
                  setFormData({ ...formData, notas: e.target.value })
                }
                disabled={isLoading}
                className="w-full resize-none rounded-md border border-slate-300 bg-white p-2.5 text-sm text-slate-800 disabled:bg-slate-100"
                rows={4}
                placeholder="Notas adicionais..."
              />
            </div>
          </div>

          <div className="md:col-span-12 flex justify-end gap-2 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? "Salvando..." : appointment ? "Atualizar" : "Agendar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
