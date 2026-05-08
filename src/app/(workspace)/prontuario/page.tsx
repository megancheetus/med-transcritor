'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Patient, MedicalRecord } from '@/lib/types';
import { PatientList } from '@/components/PatientList';
import { PatientDashboard } from '@/components/PatientDashboard';
import { EmptyState } from '@/components/EmptyState';
import AppShell from '@/components/AppShell';
import { AddPatientModal } from '@/components/AddPatientModal';
import { EditPatientModal } from '@/components/EditPatientModal';
import { AddMedicalRecordModal } from '@/components/AddMedicalRecordModal';

const PATIENTS_PAGE_SIZE = 30;
type CreatePatientPayload = Omit<Patient, 'id'> & { notifyPatientByEmail?: boolean };
type CreateMedicalRecordPayload = Omit<MedicalRecord, 'id'> & { notifyPatientByEmail?: boolean };

type EmailNotificationStatus = 'sent' | 'skipped-no-email' | 'disabled' | 'failed';

type EmailNotificationPayload = {
  status: EmailNotificationStatus;
  message: string;
};

type FeedbackState = {
  type: 'success' | 'warning' | 'error';
  text: string;
};

function buildFeedbackFromEmailNotification(
  notification: EmailNotificationPayload | undefined,
  defaultSuccessMessage: string
): FeedbackState {
  if (!notification) {
    return { type: 'success', text: defaultSuccessMessage };
  }

  if (notification.status === 'sent') {
    return { type: 'success', text: notification.message };
  }

  if (notification.status === 'failed') {
    return { type: 'warning', text: notification.message };
  }

  return { type: 'warning', text: notification.message };
}

function mergeUniquePatients(current: Patient[], incoming: Patient[]): Patient[] {
  const map = new Map<string, Patient>();

  for (const patient of current) {
    map.set(patient.id, patient);
  }

  for (const patient of incoming) {
    map.set(patient.id, patient);
  }

  return Array.from(map.values());
}

export default function ProntuarioPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientsCursor, setPatientsCursor] = useState<string | null>(null);
  const [hasMorePatients, setHasMorePatients] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddMedicalRecordModalOpen, setIsAddMedicalRecordModalOpen] = useState(false);
  const [recordsRefreshKey, setRecordsRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMorePatients, setIsLoadingMorePatients] = useState(false);
  const [isSendingWelcomeEmail, setIsSendingWelcomeEmail] = useState(false);
  const [isSendingProfileUpdateEmail, setIsSendingProfileUpdateEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [showMobileDetail, setShowMobileDetail] = useState(false);
  const patientsCursorRef = useRef<string | null>(null);

  const fetchPatients = useCallback(
    async (options?: { reset?: boolean; search?: string }) => {
      const shouldReset = options?.reset ?? false;
      const search = options?.search ?? debouncedSearchQuery;

      try {
        if (shouldReset) {
          setIsLoading(true);
          setPatientsCursor(null);
          patientsCursorRef.current = null;
          setHasMorePatients(false);
        } else {
          setIsLoadingMorePatients(true);
        }

        setError(null);

        const params = new URLSearchParams();
        params.set('limit', String(PATIENTS_PAGE_SIZE));

        if (search.trim()) {
          params.set('search', search.trim());
        }

        const cursorToUse = shouldReset ? null : patientsCursorRef.current;

        if (cursorToUse) {
          params.set('cursor', cursorToUse);
        }

        const response = await fetch(`/api/patients?${params.toString()}`);

        if (!response.ok) {
          throw new Error('Erro ao buscar pacientes');
        }

        const data = await response.json();
        const fetchedPatients: Patient[] = Array.isArray(data?.patients) ? data.patients : [];

        setPatients((prev) =>
          shouldReset ? fetchedPatients : mergeUniquePatients(prev, fetchedPatients)
        );

        const nextCursor = typeof data?.nextCursor === 'string' ? data.nextCursor : null;
        setPatientsCursor(nextCursor);
        patientsCursorRef.current = nextCursor;
        setHasMorePatients(Boolean(data?.hasMore));

      } catch (err) {
        console.error('Erro ao carregar pacientes:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setIsLoading(false);
        setIsLoadingMorePatients(false);
      }
    },
    [debouncedSearchQuery]
  );

  useEffect(() => {
    setSelectedPatient((prev) => {
      if (patients.length === 0) {
        return null;
      }

      if (!prev) {
        return patients[0];
      }

      return patients.find((patient) => patient.id === prev.id) || patients[0];
    });
  }, [patients]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 350);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  useEffect(() => {
    fetchPatients({ reset: true, search: debouncedSearchQuery });
  }, [debouncedSearchQuery, fetchPatients]);

  const handleAddPatient = useCallback(async (newPatient: CreatePatientPayload) => {
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

      const createdPatientResponse = await response.json();
      const emailNotification = createdPatientResponse.emailNotification as EmailNotificationPayload | undefined;
      const { emailNotification: _, ...createdPatient } = createdPatientResponse as Patient & {
        emailNotification?: EmailNotificationPayload;
      };

      setPatients((prev) => [createdPatient, ...prev.filter((p) => p.id !== createdPatient.id)]);
      setSelectedPatient(createdPatient);
      setIsAddModalOpen(false);
      setFeedback(
        buildFeedbackFromEmailNotification(
          emailNotification,
          'Paciente criado com sucesso.'
        )
      );
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
    async (record: CreateMedicalRecordPayload) => {
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

        const createdRecordResponse = await response.json();
        const emailNotification = createdRecordResponse.emailNotification as EmailNotificationPayload | undefined;

        setIsAddMedicalRecordModalOpen(false);
        setRecordsRefreshKey((prev) => prev + 1);
        setFeedback(
          buildFeedbackFromEmailNotification(
            emailNotification,
            'Registro médico criado com sucesso.'
          )
        );
      } catch (err) {
        console.error('Erro ao adicionar registro:', err);
        alert(err instanceof Error ? err.message : 'Erro ao adicionar registro');
      }
    },
    [selectedPatient]
  );

  const handleSendPortalWelcomeEmail = useCallback(async () => {
    if (!selectedPatient) {
      return;
    }

    try {
      setIsSendingWelcomeEmail(true);
      const response = await fetch(`/api/patients/${selectedPatient.id}/send-portal-welcome-email`, {
        method: 'POST',
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || 'Erro ao enviar e-mail de tutorial.');
      }

      const emailNotification = data?.emailNotification as EmailNotificationPayload | undefined;
      setFeedback(
        buildFeedbackFromEmailNotification(
          emailNotification,
          'Solicitação de envio do e-mail de tutorial concluída.'
        )
      );
    } catch (err) {
      console.error('Erro ao enviar tutorial do portal:', err);
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao enviar e-mail de tutorial.',
      });
    } finally {
      setIsSendingWelcomeEmail(false);
    }
  }, [selectedPatient]);

  const handleSendProfileUpdateEmail = useCallback(async () => {
    if (!selectedPatient) {
      return;
    }

    try {
      setIsSendingProfileUpdateEmail(true);
      const response = await fetch(`/api/patients/${selectedPatient.id}/send-profile-update-email`, {
        method: 'POST',
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || 'Erro ao enviar e-mail de atualização.');
      }

      const emailNotification = data?.emailNotification as EmailNotificationPayload | undefined;
      setFeedback(
        buildFeedbackFromEmailNotification(
          emailNotification,
          'Solicitação de envio do e-mail de atualização concluída.'
        )
      );
    } catch (err) {
      console.error('Erro ao enviar atualização de perfil:', err);
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Erro ao enviar e-mail de atualização.',
      });
    } finally {
      setIsSendingProfileUpdateEmail(false);
    }
  }, [selectedPatient]);

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

  const handleDeletePatient = useCallback(async () => {
    if (!selectedPatient) {
      alert('Selecione um paciente primeiro');
      return;
    }

    const confirmed = window.confirm(
      `Tem certeza que deseja excluir o paciente ${selectedPatient.nomeCompleto}? Esta ação removerá também os registros médicos vinculados.`
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/patients/${selectedPatient.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao excluir paciente');
      }

      const deletedPatientId = selectedPatient.id;

      setPatients((prev) => prev.filter((p) => p.id !== deletedPatientId));
      setSelectedPatient((prev) => (prev?.id === deletedPatientId ? null : prev));
    } catch (err) {
      console.error('Erro ao excluir paciente:', err);
      alert(err instanceof Error ? err.message : 'Erro ao excluir paciente');
    }
  }, [patients, selectedPatient]);

  const handleSelectPatient = useCallback((patient: Patient) => {
    setSelectedPatient(patient);
    setShowMobileDetail(true);
  }, []);

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

      {feedback && (
        <div
          className={`mb-4 rounded-lg p-4 text-sm border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : feedback.type === 'warning'
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-red-50 text-red-700 border-red-200'
          }`}
        >
          {feedback.text}
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
          {/* Master (Sidebar) — hidden on mobile when detail is open */}
          <div className={`w-full md:w-80 flex-shrink-0 md:border-r border-[#cfe0e8] bg-white overflow-hidden ${showMobileDetail && selectedPatient ? 'hidden md:block' : ''}`}>
            <PatientList
              patients={patients}
              selectedPatient={selectedPatient}
              onSelectPatient={handleSelectPatient}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              onLoadMore={() => {
                if (!isLoadingMorePatients && hasMorePatients) {
                  fetchPatients({ reset: false, search: debouncedSearchQuery });
                }
              }}
              hasMore={hasMorePatients}
              isLoading={isLoading}
              isLoadingMore={isLoadingMorePatients}
              onAddClick={() => setIsAddModalOpen(true)}
            />
          </div>

          {/* Detail (Main Content) — full screen on mobile when a patient is selected */}
          <div className={`flex-1 overflow-y-auto bg-gradient-to-b from-slate-50 to-white ${showMobileDetail && selectedPatient ? 'block' : 'hidden md:block'}`}>
            {selectedPatient ? (
              <>
                {/* Mobile back button */}
                <div className="sticky top-0 z-10 flex items-center gap-2 px-4 py-3 bg-white/95 backdrop-blur-sm border-b border-[#cfe0e8] md:hidden">
                  <button
                    onClick={() => setShowMobileDetail(false)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar à lista
                  </button>
                  <span className="text-sm text-slate-400 truncate ml-auto">{selectedPatient.nomeCompleto}</span>
                </div>
                <PatientDashboard 
                  patient={selectedPatient}
                  onEditClick={() => setIsEditModalOpen(true)}
                  onAddMedicalRecord={() => setIsAddMedicalRecordModalOpen(true)}
                  onStartTeleconsulta={handleStartTeleconsulta}
                  onDeletePatient={handleDeletePatient}
                  onSendPortalWelcomeEmail={handleSendPortalWelcomeEmail}
                  onSendProfileUpdateEmail={handleSendProfileUpdateEmail}
                  isSendingPortalWelcomeEmail={isSendingWelcomeEmail}
                  isSendingProfileUpdateEmail={isSendingProfileUpdateEmail}
                  refreshKey={recordsRefreshKey}
                />
              </>
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
