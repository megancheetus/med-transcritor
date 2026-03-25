'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Patient } from '@/lib/types';

interface SessionUser {
  username: string;
  fullName?: string | null;
}

interface SendToMedicalRecordModalProps {
  isOpen: boolean;
  transcriptionContent: string;
  sourceRefId?: string;
  onClose: () => void;
  onSaved?: () => void;
}

type TipoDocumento = 'Consulta' | 'Exame' | 'Procedimento' | 'Prescrição' | 'Internação';

function toTodayDateString() {
  return new Date().toISOString().split('T')[0];
}

function buildInitialResumo(content: string): string {
  const sanitized = content.replace(/\s+/g, ' ').trim();
  if (!sanitized) return '';
  return sanitized.length > 220 ? `${sanitized.slice(0, 220)}...` : sanitized;
}

function buildInitialConteudo(content: string): string {
  const trimmed = content.trim();
  if (!trimmed) return '';

  return [
    'Conteúdo originado por transcrição automática, revisado pelo profissional.',
    '',
    trimmed,
  ].join('\n');
}

export function SendToMedicalRecordModal({
  isOpen,
  transcriptionContent,
  sourceRefId,
  onClose,
  onSaved,
}: SendToMedicalRecordModalProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);

  const [patientId, setPatientId] = useState('');
  const [data, setData] = useState(toTodayDateString());
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>('Consulta');
  const [profissional, setProfissional] = useState('');
  const [especialidade, setEspecialidade] = useState('Clínica Geral');
  const [resumo, setResumo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [clinicianReviewed, setClinicianReviewed] = useState(true);

  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === patientId) || null,
    [patients, patientId]
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSaveError('');
    setResumo(buildInitialResumo(transcriptionContent));
    setConteudo(buildInitialConteudo(transcriptionContent));
    setData(toTodayDateString());
    setTipoDocumento('Consulta');
    setEspecialidade('Clínica Geral');
    setClinicianReviewed(true);

    const loadPatients = async () => {
      try {
        setIsLoadingPatients(true);
        const response = await fetch('/api/patients');

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.error || 'Não foi possível carregar pacientes.');
        }

        const data = await response.json();
        const loadedPatients = Array.isArray(data?.patients) ? (data.patients as Patient[]) : [];
        setPatients(loadedPatients);

        setPatientId((current) => {
          if (current && loadedPatients.some((patient) => patient.id === current)) {
            return current;
          }

          return loadedPatients.length > 0 ? loadedPatients[0].id : '';
        });
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Erro desconhecido ao carregar pacientes.');
      } finally {
        setIsLoadingPatients(false);
      }
    };

    const loadSessionUser = async () => {
      try {
        const response = await fetch('/api/auth/session');
        if (!response.ok) {
          return;
        }

        const data = await response.json();
        const user = data?.user as SessionUser | undefined;

        if (!user?.username) {
          return;
        }

        setSessionUser(user);
        setProfissional(user.fullName?.trim() || user.username);
      } catch {
        // Mantém profissional editável manualmente quando não houver sessão disponível.
      }
    };

    void loadPatients();
    void loadSessionUser();
  }, [isOpen, transcriptionContent]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveError('');

    if (!patientId) {
      setSaveError('Selecione um paciente para salvar no prontuário.');
      return;
    }

    if (!conteudo.trim()) {
      setSaveError('Conteúdo clínico é obrigatório.');
      return;
    }

    if (!profissional.trim()) {
      setSaveError('Informe o profissional responsável.');
      return;
    }

    try {
      setIsSaving(true);

      const response = await fetch('/api/medical-records/from-transcription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId,
          data,
          tipoDocumento,
          profissional: profissional.trim(),
          especialidade: especialidade.trim() || 'Clínica Geral',
          resumo: resumo.trim() || undefined,
          conteudo: conteudo.trim(),
          sourceRefId,
          clinicianReviewed,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Erro ao salvar registro no prontuário.');
      }

      onSaved?.();
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Erro inesperado ao salvar prontuário.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-slate-200 bg-white p-4 sm:p-6">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-bold leading-tight break-words text-slate-900">Enviar para prontuário</h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
              Revise o conteúdo antes de salvar no prontuário do paciente.
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 inline-flex items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 shrink-0"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-6">
          {saveError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {saveError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Paciente *</label>
              <select
                value={patientId}
                onChange={(event) => setPatientId(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                disabled={isLoadingPatients || isSaving}
              >
                {patients.length === 0 && <option value="">Nenhum paciente cadastrado</option>}
                {patients.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.nomeCompleto} - {patient.cpf}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Data do registro *</label>
              <input
                type="date"
                value={data}
                onChange={(event) => setData(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Tipo de documento *</label>
              <select
                value={tipoDocumento}
                onChange={(event) => setTipoDocumento(event.target.value as TipoDocumento)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                disabled={isSaving}
              >
                <option value="Consulta">Consulta</option>
                <option value="Exame">Exame</option>
                <option value="Procedimento">Procedimento</option>
                <option value="Prescrição">Prescrição</option>
                <option value="Internação">Internação</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Profissional *</label>
              <input
                type="text"
                value={profissional}
                onChange={(event) => setProfissional(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                placeholder={sessionUser?.username || 'Nome do profissional'}
                disabled={isSaving}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Especialidade *</label>
              <input
                type="text"
                value={especialidade}
                onChange={(event) => setEspecialidade(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
                disabled={isSaving}
              />
            </div>
          </div>

          {selectedPatient && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Paciente selecionado: <span className="font-semibold text-slate-800">{selectedPatient.nomeCompleto}</span>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Resumo</label>
            <textarea
              value={resumo}
              onChange={(event) => setResumo(event.target.value)}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
              placeholder="Resumo clínico breve"
              disabled={isSaving}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Conteúdo clínico *</label>
            <textarea
              value={conteudo}
              onChange={(event) => setConteudo(event.target.value)}
              rows={12}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200"
              placeholder="Revisar conteúdo antes de salvar"
              disabled={isSaving}
            />
          </div>

          <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <input
              type="checkbox"
              checked={clinicianReviewed}
              onChange={(event) => setClinicianReviewed(event.target.checked)}
              className="mt-1"
              disabled={isSaving}
            />
            <span>Confirmo que revisei clinicamente o texto antes de salvar no prontuário.</span>
          </label>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 text-center leading-tight whitespace-normal transition hover:bg-slate-50"
              disabled={isSaving}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto min-h-11 rounded-lg bg-[#1ea58c] px-4 py-2 text-sm font-semibold text-white text-center leading-tight whitespace-normal transition hover:bg-[#18956e] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSaving || isLoadingPatients || !patients.length}
            >
              {isSaving ? 'Salvando...' : 'Salvar no prontuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
