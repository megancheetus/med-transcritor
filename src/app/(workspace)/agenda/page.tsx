"use client";

import React, { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import AppointmentModal, { AppointmentFormData } from "@/components/AppointmentModal";
import ScheduleView from "@/components/ScheduleView";
import { AppointmentWithPatientInfo } from "@/lib/appointmentManager";

interface Patient {
  id: string;
  nome: string;
  email: string;
}

export default function AgendaPage() {
  const [appointments, setAppointments] = useState<AppointmentWithPatientInfo[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [patientsError, setPatientsError] = useState<string>("");

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [editingAppointment, setEditingAppointment] = useState<AppointmentWithPatientInfo | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const [viewMode, setViewMode] = useState<"week" | "month">("week");

  // Load appointments
  useEffect(() => {
    loadAppointments();
  }, []);

  // Load patients
  useEffect(() => {
    loadPatients();
  }, []);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/appointments", {
        cache: 'no-store'
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Não autenticado. Por favor, faça login novamente.");
        }
        throw new Error("Failed to load appointments");
      }

      const data = await response.json();
      setAppointments(data.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPatients = async () => {
    try {
      setPatientsLoading(true);
      setPatientsError("");
      const response = await fetch("/api/patients", { 
        cache: 'no-store' 
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to load patients`);
      }

      const data = await response.json();
      setPatients(data.patients || []);
    } catch (err: any) {
      const errorMsg = err.message || "Failed to load patients";
      console.error("Error loading patients:", err);
      setPatientsError(errorMsg);
    } finally {
      setPatientsLoading(false);
    }
  };

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
    setEditingAppointment(undefined);
    setModalOpen(true);
  };

  const handleEditAppointment = (appointment: AppointmentWithPatientInfo) => {
    setEditingAppointment(appointment);
    setSelectedDate(new Date(appointment.scheduled_at));
    setModalOpen(true);
  };

  const handleSubmitAppointment = async (formData: AppointmentFormData) => {
    setSubmitting(true);
    try {
      const method = editingAppointment ? "PATCH" : "POST";
      const url = editingAppointment
        ? `/api/appointments/${editingAppointment.id}`
        : "/api/appointments";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: formData.patientId,
          scheduledAt: new Date(formData.scheduledAt).toISOString(),
          tipo: formData.tipo,
          duracaoMinutos: formData.duracaoMinutos,
          notas: formData.notas,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save appointment");
      }

      setModalOpen(false);
      setEditingAppointment(undefined);
      setSelectedDate(undefined);
      await loadAppointments();
    } catch (err: any) {
      throw new Error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAppointment = async (appointmentId: string) => {
    try {
      const response = await fetch(`/api/appointments/${appointmentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete appointment");
      }

      await loadAppointments();
    } catch (err: any) {
      throw new Error(err.message);
    }
  };

  return (
    <AppShell
      title="Agenda de Consultas"
      subtitle="Gerencie seus agendamentos de pacientes"
    >
      {/* Controls - View Mode */}
      <div className="mb-6 flex gap-4 items-center">
        <label className="text-sm font-medium text-gray-700">Visualizar:</label>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("week")}
            className={`px-4 py-2 rounded-md transition-colors ${
              viewMode === "week"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-800 hover:bg-gray-300"
            }`}
          >
            Semana
          </button>
          <button
            onClick={() => setViewMode("month")}
            className={`px-4 py-2 rounded-md transition-colors ${
              viewMode === "month"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-800 hover:bg-gray-300"
            }`}
          >
            Mês
          </button>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => handleSelectDate(new Date())}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          + Novo Agendamento
        </button>
      </div>

      {/* Error Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {patientsError && (
        <div className="mb-4 p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded">
          ⚠️ Aviso: {patientsError}
        </div>
      )}

      {/* Main Schedule View */}
      {loading ? (
        <div className="flex justify-center items-center h-96">
          <div className="text-gray-500">Carregando agenda...</div>
        </div>
      ) : (
        <ScheduleView
          appointments={appointments}
          onSelectDate={handleSelectDate}
          onEditAppointment={handleEditAppointment}
          onDeleteAppointment={handleDeleteAppointment}
          viewMode={viewMode}
        />
      )}

      {/* Stats Section */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="text-gray-500 text-sm font-medium">Total de Agendamentos</div>
          <div className="text-3xl font-bold text-gray-900 mt-2">
            {appointments.length}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-400">
          <div className="text-gray-500 text-sm font-medium">Agendado</div>
          <div className="text-3xl font-bold text-blue-600 mt-2">
            {appointments.filter((a) => a.status === "scheduled").length}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="text-gray-500 text-sm font-medium">Confirmado</div>
          <div className="text-3xl font-bold text-green-600 mt-2">
            {appointments.filter((a) => a.status === "confirmed").length}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <div className="text-gray-500 text-sm font-medium">Cancelado</div>
          <div className="text-3xl font-bold text-red-600 mt-2">
            {appointments.filter((a) => a.status === "cancelled").length}
          </div>
        </div>
      </div>

      {/* Modal */}
      <AppointmentModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingAppointment(undefined);
          setSelectedDate(undefined);
        }}
        onSubmit={handleSubmitAppointment}
        selectedDate={selectedDate}
        appointment={editingAppointment}
        isLoading={submitting}
        patients={patients}
      />
    </AppShell>
  );
}
