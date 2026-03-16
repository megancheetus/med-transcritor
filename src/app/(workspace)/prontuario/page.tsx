'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Patient, MedicalRecord } from '@/lib/types';
import { PatientList } from '@/components/PatientList';
import { PatientDashboard } from '@/components/PatientDashboard';
import { EmptyState } from '@/components/EmptyState';
import AppShell from '@/components/AppShell';
import { AddPatientModal } from '@/components/AddPatientModal';
import { EditPatientModal } from '@/components/EditPatientModal';
import { AddMedicalRecordModal } from '@/components/AddMedicalRecordModal';

export default function ProntuarioPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddMedicalRecordModalOpen, setIsAddMedicalRecordModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carrega lista de pacientes do servidor
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('/api/patients');
        
        if (!response.ok) {
          throw new Error('Erro ao buscar pacientes');
        }
        
        const data = await response.json();
        setPatients(data.patients || []);
      } catch (err) {
        console.error('Erro ao carregar pacientes:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPatients();
  }, []);

  const handleAddPatient = useCallback(async (newPatient: Omit<Patient, 'id'>) => {
    try {
      const response = await fetch('/api/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newPatient),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao criar paciente');
      }

      const createdPatient = await response.json();
      setPatients((prev) => [createdPatient, ...prev]);
      setIsAddModalOpen(false);
    } catch (err) {
      console.error('Erro ao adicionar paciente:', err);
      alert(err instanceof Error ? err.message : 'Erro ao adicionar paciente');
    }
  }, []);

  const handleEditPatient = useCallback(async (updatedPatient: Patient) => {
    try {
      const response = await fetch(`/api/patients/${updatedPatient.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedPatient),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar paciente');
      }

      const patientData = await response.json();
      
      setPatients((prev) =>
        prev.map((p) => (p.id === updatedPatient.id ? patientData : p))
      );
      
      setSelectedPatient(patientData);
      setIsEditModalOpen(false);
    } catch (err) {
      console.error('Erro ao editar paciente:', err);
      alert(err instanceof Error ? err.message : 'Erro ao editar paciente');
    }
  }, []);

  const handleAddMedicalRecord = useCallback(
    async (record: Omit<MedicalRecord, 'id'>) => {
      try {
        const response = await fetch('/api/medical-records', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(record),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Erro ao criar registro médico');
        }

        setIsAddMedicalRecordModalOpen(false);
        // Força recarregamento dos registros no PatientDashboard
        setSelectedPatient(selectedPatient ? { ...selectedPatient } : null);
      } catch (err) {
        console.error('Erro ao adicionar registro:', err);
        alert(err instanceof Error ? err.message : 'Erro ao adicionar registro');
      }
    },
    [selectedPatient]
  );

  const handleStartTeleconsulta = useCallback(async () => {
    if (!selectedPatient) {
      alert('Selecione um paciente primeiro');
      return;
    }

    try {
      const response = await fetch('/api/videoconsultations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ patientId: selectedPatient.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao criar teleconsulta');
      }

      const data = await response.json();
      // Redirecionar para a sala de videoconsulta
      router.push(`/room/${data.room.id}?role=professional`);
    } catch (err) {
      console.error('Erro ao iniciar teleconsulta:', err);
      alert(err instanceof Error ? err.message : 'Erro ao iniciar teleconsulta');
    }
  }, [selectedPatient, router]);

  return (
    <AppShell
      title="Prontuário Eletrônico"
      subtitle="Gerenciamento centralizado dos registros médicos de pacientes"
    >
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-xl bg-white shadow-sm border border-[#cfe0e8]">
          <div className="text-center">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 mb-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
            </div>
            <p className="text-slate-600 font-medium">Carregando pacientes...</p>
          </div>
        </div>
      ) : (
        <div className="flex gap-6 h-full rounded-xl overflow-hidden bg-white shadow-sm border border-[#cfe0e8]">
          {/* Master (Sidebar) */}
          <div className="w-80 flex-shrink-0 border-r border-[#cfe0e8] bg-white overflow-hidden">
            <PatientList
              patients={patients}
              selectedPatient={selectedPatient}
              onSelectPatient={setSelectedPatient}
              onAddClick={() => setIsAddModalOpen(true)}
            />
          </div>

          {/* Detail (Main Content) */}
          <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-white">
            {selectedPatient ? (
              <PatientDashboard 
                patient={selectedPatient}
                onEditClick={() => setIsEditModalOpen(true)}
                onAddMedicalRecord={() => setIsAddMedicalRecordModalOpen(true)}
                onStartTeleconsulta={handleStartTeleconsulta}
              />
            ) : (
              <EmptyState />
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <AddPatientModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddPatient}
      />

      <EditPatientModal
        isOpen={isEditModalOpen}
        patient={selectedPatient}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleEditPatient}
      />

      <AddMedicalRecordModal
        isOpen={isAddMedicalRecordModalOpen}
        patientId={selectedPatient?.id || ''}
        onClose={() => setIsAddMedicalRecordModalOpen(false)}
        onAdd={handleAddMedicalRecord}
      />
    </AppShell>
  );
}
