'use client';

import { Patient, MedicalRecord } from '@/lib/types';
import {
  Calendar,
  User,
  Phone,
  Mail,
  FileText,
  Stethoscope,
  Clock,
  Edit2,
  Plus,
  Trash2,
  History,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface PatientDashboardProps {
  patient: Patient;
  onEditClick?: () => void;
  onAddMedicalRecord?: () => void;
  onStartTeleconsulta?: () => void;
  onDeletePatient?: () => void;
}

interface MedicalRecordVersionItem {
  id: string;
  medicalRecordId: string;
  versionNumber: number;
  snapshotJson: Record<string, unknown>;
  changedBy: string;
  changeReason?: string;
  createdAt: string;
}

function getDocumentIcon(tipoDocumento: string) {
  switch (tipoDocumento) {
    case 'Consulta':
      return <Stethoscope className="h-5 w-5 text-blue-600" />;
    case 'Exame':
      return <FileText className="h-5 w-5 text-purple-600" />;
    case 'Procedimento':
      return <Clock className="h-5 w-5 text-orange-600" />;
    case 'Prescrição':
      return <FileText className="h-5 w-5 text-green-600" />;
    case 'Internação':
      return <Stethoscope className="h-5 w-5 text-red-600" />;
    default:
      return <FileText className="h-5 w-5 text-slate-600" />;
  }
}

function getDocumentColor(tipoDocumento: string): string {
  switch (tipoDocumento) {
    case 'Consulta':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'Exame':
      return 'bg-purple-100 text-purple-800 border-purple-300';
    case 'Procedimento':
      return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'Prescrição':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'Internação':
      return 'bg-red-100 text-red-800 border-red-300';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-300';
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getSourceBadge(sourceType?: MedicalRecord['sourceType']): {
  label: string;
  className: string;
} {
  switch (sourceType) {
    case 'transcription':
      return {
        label: 'Transcrição IA',
        className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      };
    case 'teleconsulta':
      return {
        label: 'Teleconsulta',
        className: 'bg-cyan-100 text-cyan-700 border-cyan-200',
      };
    case 'manual':
    default:
      return {
        label: 'Manual',
        className: 'bg-slate-100 text-slate-700 border-slate-200',
      };
  }
}

export function PatientDashboard({
  patient,
  onEditClick,
  onAddMedicalRecord,
  onStartTeleconsulta,
  onDeletePatient,
}: PatientDashboardProps) {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<MedicalRecordVersionItem[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [selectedRecordForVersions, setSelectedRecordForVersions] = useState<MedicalRecord | null>(null);

  // Carrega registros médicos do servidor
  useEffect(() => {
    const fetchRecords = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`/api/medical-records?patientId=${patient.id}`);

        if (!response.ok) {
          throw new Error('Erro ao buscar registros médicos');
        }

        const data = await response.json();
        setRecords(data.records || []);
      } catch (err) {
        console.error('Erro ao carregar registros:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecords();
  }, [patient.id]);

  const handleDeleteRecord = async (recordId: string) => {
    if (!confirm('Tem certeza que deseja deletar este registro?')) return;

    try {
      const response = await fetch(`/api/medical-records/${recordId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Erro ao deletar registro');
      }

      setRecords((prev) => prev.filter((r) => r.id !== recordId));
    } catch (err) {
      console.error('Erro ao deletar:', err);
      alert(err instanceof Error ? err.message : 'Erro ao deletar registro');
    }
  };

  const handleOpenVersions = async (record: MedicalRecord) => {
    try {
      setSelectedRecordForVersions(record);
      setIsLoadingVersions(true);
      setVersionsError(null);

      const response = await fetch(`/api/medical-records/${record.id}/versions`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.error || 'Não foi possível carregar o histórico de versões'
        );
      }

      const data = await response.json();
      setVersions(Array.isArray(data?.versions) ? data.versions : []);
    } catch (err) {
      console.error('Erro ao carregar versões:', err);
      setVersionsError(err instanceof Error ? err.message : 'Erro desconhecido');
      setVersions([]);
    } finally {
      setIsLoadingVersions(false);
    }
  };

  const handleCloseVersionsModal = () => {
    setSelectedRecordForVersions(null);
    setVersions([]);
    setVersionsError(null);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">{patient.nomeCompleto}</h1>
            <p className="text-sm text-slate-600">{patient.cpf}</p>
          </div>
          <div className="flex items-center gap-3">
            {onAddMedicalRecord && (
              <button
                onClick={onAddMedicalRecord}
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Novo Registro
              </button>
            )}
            {onStartTeleconsulta && (
              <button
                onClick={onStartTeleconsulta}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1ea58c] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#18956e] transition"
              >
                <Phone className="h-3.5 w-3.5" />
                Teleconsulta
              </button>
            )}
            {onEditClick && (
              <button
                onClick={onEditClick}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Editar
              </button>
            )}
            {onDeletePatient && (
              <button
                onClick={onDeletePatient}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir Paciente
              </button>
            )}
            <div className="rounded-full bg-blue-100 p-3">
              <User className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Patient Info Grid */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-600">Idade</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{patient.idade}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-600">Sexo</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {patient.sexo === 'M' ? 'Masculino' : patient.sexo === 'F' ? 'Feminino' : 'Outro'}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-600">Nascimento</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {formatDate(patient.dataNascimento)}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-600">Registros</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{records.length}</p>
          </div>
        </div>

        {/* Contact Info */}
        {(patient.telefone || patient.email) && (
          <div className="mt-4 flex flex-wrap gap-4">
            {patient.telefone && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Phone className="h-4 w-4 text-slate-400" />
                {patient.telefone}
              </div>
            )}
            {patient.email && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Mail className="h-4 w-4 text-slate-400" />
                {patient.email}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto p-6">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <div className="text-center">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 mb-3">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
              </div>
              <p className="text-slate-600 font-medium">Carregando registros...</p>
            </div>
          </div>
        ) : records.length === 0 ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-slate-500">Nenhum registro médico encontrado</p>
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-900">Histórico de Registros</h2>

            <div className="relative space-y-8 pl-8">
              {/* Vertical line */}
              <div className="absolute left-3 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-200 to-slate-200" />

              {records.map((record) => (
                <div key={record.id} className="relative">
                  {/* Timeline dot */}
                  <div className="absolute -left-7 top-1 h-5 w-5 rounded-full border-4 border-white bg-blue-600 shadow-md" />

                  {/* Card */}
                  <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md hover:border-slate-300">
                    {(() => {
                      const sourceBadge = getSourceBadge(record.sourceType);
                      return (
                        <div className="mb-3 flex items-center justify-end">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${sourceBadge.className}`}
                            title={`Origem: ${sourceBadge.label}`}
                          >
                            {sourceBadge.label}
                          </span>
                        </div>
                      );
                    })()}

                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-lg p-2 ${getDocumentColor(record.tipoDocumento)}`}>
                          {getDocumentIcon(record.tipoDocumento)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{record.tipoDocumento}</p>
                          <p className="text-sm text-slate-600">{record.profissional}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                          <Calendar className="h-3 w-3" />
                          {formatDate(record.data)}
                        </span>
                        <button
                          onClick={() => handleOpenVersions(record)}
                          className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                          title="Ver histórico de versões"
                        >
                          <History className="h-3.5 w-3.5" />
                          Versões
                        </button>
                        <button
                          onClick={() => handleDeleteRecord(record.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-100"
                          title="Deletar registro"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Excluir
                        </button>
                      </div>
                    </div>

                    <div className="mb-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {record.especialidade}
                      </p>
                    </div>

                    {record.resumo && (
                      <p className="mb-3 text-sm font-medium text-slate-800">{record.resumo}</p>
                    )}

                    <p className="text-sm leading-relaxed text-slate-700">{record.conteudo}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedRecordForVersions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white p-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Histórico de versões</h3>
                <p className="text-sm text-slate-600">
                  Registro: {selectedRecordForVersions.tipoDocumento} - {selectedRecordForVersions.profissional}
                </p>
              </div>
              <button
                onClick={handleCloseVersionsModal}
                className="rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Fechar histórico de versões"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5">
              {versionsError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {versionsError}
                </div>
              )}

              {isLoadingVersions ? (
                <div className="flex h-32 items-center justify-center text-sm text-slate-600">
                  Carregando versões...
                </div>
              ) : versions.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  Nenhuma versão anterior encontrada para este registro.
                </div>
              ) : (
                <div className="space-y-3">
                  {versions.map((version) => {
                    const snapshotConteudo =
                      typeof version.snapshotJson?.conteudo === 'string'
                        ? version.snapshotJson.conteudo
                        : '';

                    const snapshotResumo =
                      typeof version.snapshotJson?.resumo === 'string'
                        ? version.snapshotJson.resumo
                        : '';

                    return (
                      <div
                        key={version.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 font-semibold text-blue-700">
                            Versão {version.versionNumber}
                          </span>
                          <span className="text-slate-600">
                            {formatDateTime(version.createdAt)}
                          </span>
                          <span className="text-slate-500">por {version.changedBy}</span>
                        </div>

                        {version.changeReason && (
                          <p className="mb-2 text-xs text-slate-600">
                            Motivo: <span className="font-medium text-slate-700">{version.changeReason}</span>
                          </p>
                        )}

                        {snapshotResumo && (
                          <p className="mb-2 text-sm font-medium text-slate-800">{snapshotResumo}</p>
                        )}

                        {snapshotConteudo && (
                          <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                            {snapshotConteudo}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
