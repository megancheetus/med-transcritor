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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface PatientDashboardProps {
  patient: Patient;
  onEditClick?: () => void;
  onAddMedicalRecord?: () => void;
  onStartTeleconsulta?: () => void;
  onDeletePatient?: () => void;
  onSendPortalWelcomeEmail?: () => void;
  onSendProfileUpdateEmail?: () => void;
  isSendingPortalWelcomeEmail?: boolean;
  isSendingProfileUpdateEmail?: boolean;
  refreshKey?: number;
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

const MEDICAL_RECORDS_PAGE_SIZE = 20;
const DOCUMENT_TYPE_FILTERS: Array<MedicalRecord['tipoDocumento']> = [
  'Consulta',
  'Exame',
  'Procedimento',
  'Prescrição',
  'Internação',
];

function mergeUniqueRecords(current: MedicalRecord[], incoming: MedicalRecord[]): MedicalRecord[] {
  const map = new Map<string, MedicalRecord>();

  for (const record of current) {
    map.set(record.id, record);
  }

  for (const record of incoming) {
    map.set(record.id, record);
  }

  return Array.from(map.values());
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

function formatNumber(value?: number, suffix?: string): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '--';
  }

  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${suffix || ''}`;
}

function parseOptionalNumber(value: string): number | undefined {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) {
    return undefined;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseCsvField(value: string): string[] | undefined {
  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return parsed.length > 0 ? parsed : undefined;
}

function csvFromArray(values?: string[]): string {
  return values && values.length > 0 ? values.join(', ') : '';
}

function EditRecordModal({
  record,
  onClose,
  onSave,
  isSaving,
}: {
  record: MedicalRecord;
  onClose: () => void;
  onSave: (payload: Partial<Omit<MedicalRecord, 'id' | 'patientId'>>) => Promise<void>;
  isSaving: boolean;
}) {
  const [formData, setFormData] = useState({
    data: record.data,
    tipoDocumento: record.tipoDocumento,
    profissional: record.profissional,
    especialidade: record.especialidade,
    resumo: record.resumo || '',
    conteudo: record.conteudo,
    cid10Codes: csvFromArray(record.cid10Codes),
    medications: csvFromArray(record.medications),
    allergies: csvFromArray(record.allergies),
    followUpDate: record.followUpDate || '',
    bioAlturaCm: record.bioimpedance?.alturaCm?.toString() || '',
    bioPesoKg: record.bioimpedance?.pesoKg?.toString() || '',
    bioImc: record.bioimpedance?.imc?.toString() || '',
    bioGorduraPercent: record.bioimpedance?.gorduraCorporalPercent?.toString() || '',
    bioMassaMagraKg: record.bioimpedance?.massaMagraKg?.toString() || '',
    bioMassaGorduraKg: record.bioimpedance?.massaGorduraKg?.toString() || '',
    bioMusculoEsqueleticoKg: record.bioimpedance?.musculoEsqueleticoKg?.toString() || '',
    bioAguaCorporalL: record.bioimpedance?.aguaCorporalTotalL?.toString() || '',
    bioGorduraVisceralNivel: record.bioimpedance?.gorduraVisceralNivel?.toString() || '',
    bioTmbKcal: record.bioimpedance?.taxaMetabolicaBasalKcal?.toString() || '',
    bioObservacoes: record.bioimpedance?.observacoes || '',
    leanLeftArm: record.bioimpedance?.segmentalLean?.leftArmKg?.toString() || '',
    leanRightArm: record.bioimpedance?.segmentalLean?.rightArmKg?.toString() || '',
    leanTrunk: record.bioimpedance?.segmentalLean?.trunkKg?.toString() || '',
    leanLeftLeg: record.bioimpedance?.segmentalLean?.leftLegKg?.toString() || '',
    leanRightLeg: record.bioimpedance?.segmentalLean?.rightLegKg?.toString() || '',
    fatLeftArm: record.bioimpedance?.segmentalFat?.leftArmKg?.toString() || '',
    fatRightArm: record.bioimpedance?.segmentalFat?.rightArmKg?.toString() || '',
    fatTrunk: record.bioimpedance?.segmentalFat?.trunkKg?.toString() || '',
    fatLeftLeg: record.bioimpedance?.segmentalFat?.leftLegKg?.toString() || '',
    fatRightLeg: record.bioimpedance?.segmentalFat?.rightLegKg?.toString() || '',
  });

  useEffect(() => {
    const peso = parseOptionalNumber(formData.bioPesoKg);
    const alturaCm = parseOptionalNumber(formData.bioAlturaCm);

    if (!peso || !alturaCm || alturaCm <= 0) {
      if (formData.bioImc !== '') {
        setFormData((prev) => ({ ...prev, bioImc: '' }));
      }
      return;
    }

    const alturaM = alturaCm / 100;
    const calculatedImc = peso / (alturaM * alturaM);
    const normalizedImc = calculatedImc.toFixed(2);

    if (formData.bioImc !== normalizedImc) {
      setFormData((prev) => ({ ...prev, bioImc: normalizedImc }));
    }
  }, [formData.bioAlturaCm, formData.bioPesoKg, formData.bioImc]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await onSave({
      data: formData.data,
      tipoDocumento: formData.tipoDocumento,
      profissional: formData.profissional,
      especialidade: formData.especialidade,
      resumo: formData.resumo.trim() || undefined,
      conteudo: formData.conteudo.trim(),
      cid10Codes: parseCsvField(formData.cid10Codes),
      medications: parseCsvField(formData.medications),
      allergies: parseCsvField(formData.allergies),
      followUpDate: formData.followUpDate || undefined,
      bioimpedance: {
        alturaCm: parseOptionalNumber(formData.bioAlturaCm),
        pesoKg: parseOptionalNumber(formData.bioPesoKg),
        imc: parseOptionalNumber(formData.bioImc),
        gorduraCorporalPercent: parseOptionalNumber(formData.bioGorduraPercent),
        massaMagraKg: parseOptionalNumber(formData.bioMassaMagraKg),
        massaGorduraKg: parseOptionalNumber(formData.bioMassaGorduraKg),
        musculoEsqueleticoKg: parseOptionalNumber(formData.bioMusculoEsqueleticoKg),
        aguaCorporalTotalL: parseOptionalNumber(formData.bioAguaCorporalL),
        gorduraVisceralNivel: parseOptionalNumber(formData.bioGorduraVisceralNivel),
        taxaMetabolicaBasalKcal: parseOptionalNumber(formData.bioTmbKcal),
        observacoes: formData.bioObservacoes.trim() || undefined,
        segmentalLean: {
          leftArmKg: parseOptionalNumber(formData.leanLeftArm),
          rightArmKg: parseOptionalNumber(formData.leanRightArm),
          trunkKg: parseOptionalNumber(formData.leanTrunk),
          leftLegKg: parseOptionalNumber(formData.leanLeftLeg),
          rightLegKg: parseOptionalNumber(formData.leanRightLeg),
        },
        segmentalFat: {
          leftArmKg: parseOptionalNumber(formData.fatLeftArm),
          rightArmKg: parseOptionalNumber(formData.fatRightArm),
          trunkKg: parseOptionalNumber(formData.fatTrunk),
          leftLegKg: parseOptionalNumber(formData.fatLeftLeg),
          rightLegKg: parseOptionalNumber(formData.fatRightLeg),
        },
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 border-b border-slate-200 bg-white p-4 sm:p-5 flex items-center justify-between">
          <h3 className="text-base sm:text-lg font-bold text-slate-900">Editar registro</h3>
          <button onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-slate-100" aria-label="Fechar edição">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input type="date" value={formData.data} onChange={(e) => setFormData((prev) => ({ ...prev, data: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <select value={formData.tipoDocumento} onChange={(e) => setFormData((prev) => ({ ...prev, tipoDocumento: e.target.value as MedicalRecord['tipoDocumento'] }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="Consulta">Consulta</option>
              <option value="Exame">Exame</option>
              <option value="Procedimento">Procedimento</option>
              <option value="Prescrição">Prescrição</option>
              <option value="Internação">Internação</option>
            </select>
            <input type="text" value={formData.profissional} onChange={(e) => setFormData((prev) => ({ ...prev, profissional: e.target.value }))} placeholder="Profissional" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input type="text" value={formData.especialidade} onChange={(e) => setFormData((prev) => ({ ...prev, especialidade: e.target.value }))} placeholder="Especialidade" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>

          <input type="text" value={formData.resumo} onChange={(e) => setFormData((prev) => ({ ...prev, resumo: e.target.value }))} placeholder="Resumo" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <textarea value={formData.conteudo} onChange={(e) => setFormData((prev) => ({ ...prev, conteudo: e.target.value }))} rows={6} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input type="text" value={formData.cid10Codes} onChange={(e) => setFormData((prev) => ({ ...prev, cid10Codes: e.target.value }))} placeholder="CID-10 (separados por vírgula)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input type="text" value={formData.medications} onChange={(e) => setFormData((prev) => ({ ...prev, medications: e.target.value }))} placeholder="Medicações (separadas por vírgula)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input type="text" value={formData.allergies} onChange={(e) => setFormData((prev) => ({ ...prev, allergies: e.target.value }))} placeholder="Alergias (separadas por vírgula)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input type="date" value={formData.followUpDate} onChange={(e) => setFormData((prev) => ({ ...prev, followUpDate: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>

          <div className="rounded-lg border border-slate-200 p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Bioimpedância</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <input type="text" value={formData.bioAlturaCm} onChange={(e) => setFormData((prev) => ({ ...prev, bioAlturaCm: e.target.value }))} placeholder="Altura (cm)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="text" value={formData.bioPesoKg} onChange={(e) => setFormData((prev) => ({ ...prev, bioPesoKg: e.target.value }))} placeholder="Peso (kg)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="text" value={formData.bioImc} readOnly placeholder="IMC automático" className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm" />
              <input type="text" value={formData.bioGorduraPercent} onChange={(e) => setFormData((prev) => ({ ...prev, bioGorduraPercent: e.target.value }))} placeholder="PGC (%)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="text" value={formData.bioMassaMagraKg} onChange={(e) => setFormData((prev) => ({ ...prev, bioMassaMagraKg: e.target.value }))} placeholder="Massa magra (kg)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="text" value={formData.bioMassaGorduraKg} onChange={(e) => setFormData((prev) => ({ ...prev, bioMassaGorduraKg: e.target.value }))} placeholder="Massa gordura (kg)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="text" value={formData.bioMusculoEsqueleticoKg} onChange={(e) => setFormData((prev) => ({ ...prev, bioMusculoEsqueleticoKg: e.target.value }))} placeholder="Músculo esquelético (kg)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="text" value={formData.bioAguaCorporalL} onChange={(e) => setFormData((prev) => ({ ...prev, bioAguaCorporalL: e.target.value }))} placeholder="Água corporal (L)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input type="text" value={formData.bioGorduraVisceralNivel} onChange={(e) => setFormData((prev) => ({ ...prev, bioGorduraVisceralNivel: e.target.value }))} placeholder="Gordura visceral" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <input type="text" value={formData.bioTmbKcal} onChange={(e) => setFormData((prev) => ({ ...prev, bioTmbKcal: e.target.value }))} placeholder="TMB (kcal)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-semibold text-slate-600 mb-2">Massa magra segmentar (kg)</p>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={formData.leanLeftArm} onChange={(e) => setFormData((prev) => ({ ...prev, leanLeftArm: e.target.value }))} placeholder="Braço E" className="rounded border border-slate-300 px-2 py-1.5 text-xs" />
                  <input type="text" value={formData.leanRightArm} onChange={(e) => setFormData((prev) => ({ ...prev, leanRightArm: e.target.value }))} placeholder="Braço D" className="rounded border border-slate-300 px-2 py-1.5 text-xs" />
                  <input type="text" value={formData.leanLeftLeg} onChange={(e) => setFormData((prev) => ({ ...prev, leanLeftLeg: e.target.value }))} placeholder="Perna E" className="rounded border border-slate-300 px-2 py-1.5 text-xs" />
                  <input type="text" value={formData.leanRightLeg} onChange={(e) => setFormData((prev) => ({ ...prev, leanRightLeg: e.target.value }))} placeholder="Perna D" className="rounded border border-slate-300 px-2 py-1.5 text-xs" />
                  <input type="text" value={formData.leanTrunk} onChange={(e) => setFormData((prev) => ({ ...prev, leanTrunk: e.target.value }))} placeholder="Tronco" className="col-span-2 rounded border border-slate-300 px-2 py-1.5 text-xs" />
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-semibold text-slate-600 mb-2">Massa de gordura segmentar (kg)</p>
                <div className="grid grid-cols-2 gap-2">
                  <input type="text" value={formData.fatLeftArm} onChange={(e) => setFormData((prev) => ({ ...prev, fatLeftArm: e.target.value }))} placeholder="Braço E" className="rounded border border-slate-300 px-2 py-1.5 text-xs" />
                  <input type="text" value={formData.fatRightArm} onChange={(e) => setFormData((prev) => ({ ...prev, fatRightArm: e.target.value }))} placeholder="Braço D" className="rounded border border-slate-300 px-2 py-1.5 text-xs" />
                  <input type="text" value={formData.fatLeftLeg} onChange={(e) => setFormData((prev) => ({ ...prev, fatLeftLeg: e.target.value }))} placeholder="Perna E" className="rounded border border-slate-300 px-2 py-1.5 text-xs" />
                  <input type="text" value={formData.fatRightLeg} onChange={(e) => setFormData((prev) => ({ ...prev, fatRightLeg: e.target.value }))} placeholder="Perna D" className="rounded border border-slate-300 px-2 py-1.5 text-xs" />
                  <input type="text" value={formData.fatTrunk} onChange={(e) => setFormData((prev) => ({ ...prev, fatTrunk: e.target.value }))} placeholder="Tronco" className="col-span-2 rounded border border-slate-300 px-2 py-1.5 text-xs" />
                </div>
              </div>
            </div>

            <textarea value={formData.bioObservacoes} onChange={(e) => setFormData((prev) => ({ ...prev, bioObservacoes: e.target.value }))} rows={3} placeholder="Observações de bioimpedância" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" disabled={isSaving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60">
              {isSaving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
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
  onSendPortalWelcomeEmail,
  onSendProfileUpdateEmail,
  isSendingPortalWelcomeEmail = false,
  isSendingProfileUpdateEmail = false,
  refreshKey = 0,
}: PatientDashboardProps) {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [recordsCursor, setRecordsCursor] = useState<string | null>(null);
  const [hasMoreRecords, setHasMoreRecords] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    tipoDocumento: '',
    profissional: '',
    dateFrom: '',
    dateTo: '',
  });
  const [debouncedProfissional, setDebouncedProfissional] = useState('');
  const [versions, setVersions] = useState<MedicalRecordVersionItem[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [selectedRecordForVersions, setSelectedRecordForVersions] = useState<MedicalRecord | null>(null);
  const [selectedRecordForEdit, setSelectedRecordForEdit] = useState<MedicalRecord | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const timelineRef = useRef<HTMLDivElement | null>(null);

  const normalizedFilters = useMemo(
    () => ({
      tipoDocumento: filters.tipoDocumento,
      profissional: debouncedProfissional.trim(),
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    }),
    [debouncedProfissional, filters.dateFrom, filters.dateTo, filters.tipoDocumento]
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedProfissional(filters.profissional);
    }, 350);

    return () => clearTimeout(timeout);
  }, [filters.profissional]);

  const fetchRecords = useCallback(
    async (options?: { reset?: boolean; cursor?: string | null }) => {
      const shouldReset = options?.reset ?? false;
      const cursor = options?.cursor || null;

      try {
        if (shouldReset) {
          setIsLoading(true);
        } else {
          setIsLoadingMore(true);
        }

        setError(null);

        const params = new URLSearchParams();
        params.set('patientId', patient.id);
        params.set('limit', String(MEDICAL_RECORDS_PAGE_SIZE));

        if (!shouldReset && cursor) {
          params.set('cursor', cursor);
        }

        if (normalizedFilters.tipoDocumento) {
          params.set('tipoDocumento', normalizedFilters.tipoDocumento);
        }

        if (normalizedFilters.profissional) {
          params.set('profissional', normalizedFilters.profissional);
        }

        if (normalizedFilters.dateFrom) {
          params.set('dateFrom', normalizedFilters.dateFrom);
        }

        if (normalizedFilters.dateTo) {
          params.set('dateTo', normalizedFilters.dateTo);
        }

        const response = await fetch(`/api/medical-records?${params.toString()}`);

        if (!response.ok) {
          throw new Error('Erro ao buscar registros médicos');
        }

        const data = await response.json();
        const fetchedRecords: MedicalRecord[] = Array.isArray(data?.records) ? data.records : [];

        setRecords((prev) =>
          shouldReset ? fetchedRecords : mergeUniqueRecords(prev, fetchedRecords)
        );
        setRecordsCursor(typeof data?.nextCursor === 'string' ? data.nextCursor : null);
        setHasMoreRecords(Boolean(data?.hasMore));
      } catch (err) {
        console.error('Erro ao carregar registros:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [normalizedFilters, patient.id]
  );

  useEffect(() => {
    fetchRecords({ reset: true, cursor: null });
  }, [fetchRecords, refreshKey]);

  const handleTimelineScroll = useCallback(() => {
    if (!timelineRef.current || isLoading || isLoadingMore || !hasMoreRecords) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = timelineRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;

    if (distanceToBottom < 160) {
      fetchRecords({ reset: false, cursor: recordsCursor });
    }
  }, [fetchRecords, hasMoreRecords, isLoading, isLoadingMore, recordsCursor]);

  const handleDeleteRecord = async (recordId: string) => {
    if (!confirm('Tem certeza que deseja deletar este registro?')) return;

    const changeReason = prompt('Informe o motivo da exclusão deste registro:')?.trim();

    if (!changeReason) {
      alert('Motivo da exclusão é obrigatório.');
      return;
    }

    try {
      const response = await fetch(`/api/medical-records/${recordId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ changeReason }),
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

  const handleOpenEditRecord = (record: MedicalRecord) => {
    setSelectedRecordForEdit(record);
  };

  const handleCloseEditRecord = () => {
    setSelectedRecordForEdit(null);
  };

  const handleSaveEditRecord = async (payload: Partial<Omit<MedicalRecord, 'id' | 'patientId'>>) => {
    if (!selectedRecordForEdit) {
      return;
    }

    try {
      setIsSavingEdit(true);

      const response = await fetch(`/api/medical-records/${selectedRecordForEdit.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || 'Erro ao atualizar registro');
      }

      const updatedRecord = (await response.json()) as MedicalRecord;
      setRecords((prev) => prev.map((record) => (record.id === updatedRecord.id ? updatedRecord : record)));
      setSelectedRecordForEdit(null);
    } catch (err) {
      console.error('Erro ao editar registro:', err);
      alert(err instanceof Error ? err.message : 'Erro ao editar registro');
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white p-4 sm:p-6">
        <div className="mb-4 flex flex-col min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl min-[360px]:text-2xl sm:text-3xl leading-tight break-words font-bold text-slate-900">{patient.nomeCompleto}</h1>
            <p className="text-xs min-[360px]:text-sm leading-tight text-slate-600">{patient.cpf}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {onAddMedicalRecord && (
              <button
                onClick={onAddMedicalRecord}
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs min-[360px]:text-sm font-medium text-white hover:bg-green-700 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Novo Registro
              </button>
            )}
            {onStartTeleconsulta && (
              <button
                onClick={onStartTeleconsulta}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1ea58c] px-3 py-1.5 text-xs min-[360px]:text-sm font-medium text-white hover:bg-[#18956e] transition"
              >
                <Phone className="h-3.5 w-3.5" />
                Teleconsulta
              </button>
            )}
            {onEditClick && (
              <button
                onClick={onEditClick}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs min-[360px]:text-sm font-medium text-white hover:bg-blue-700 transition"
              >
                <Edit2 className="h-3.5 w-3.5" />
                Editar
              </button>
            )}
            {onSendPortalWelcomeEmail && (
              <button
                onClick={onSendPortalWelcomeEmail}
                disabled={isSendingPortalWelcomeEmail}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs min-[360px]:text-sm font-medium text-white hover:bg-emerald-700 transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Mail className="h-3.5 w-3.5" />
                {isSendingPortalWelcomeEmail ? 'Enviando tutorial...' : 'Enviar tutorial'}
              </button>
            )}
            {onSendProfileUpdateEmail && (
              <button
                onClick={onSendProfileUpdateEmail}
                disabled={isSendingProfileUpdateEmail}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs min-[360px]:text-sm font-medium text-white hover:bg-teal-700 transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Mail className="h-3.5 w-3.5" />
                {isSendingProfileUpdateEmail ? 'Enviando atualização...' : 'Enviar atualização'}
              </button>
            )}
            {onDeletePatient && (
              <button
                onClick={onDeletePatient}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs min-[360px]:text-sm font-medium text-red-700 hover:bg-red-100 transition"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir Paciente
              </button>
            )}
            <div className="rounded-full bg-blue-100 p-2.5 sm:p-3">
              <User className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Patient Info Grid */}
        <div className="grid grid-cols-2 gap-2.5 min-[360px]:gap-3 md:gap-4 md:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-[11px] min-[360px]:text-xs leading-tight font-medium text-slate-600">Idade</p>
            <p className="mt-1 text-base min-[360px]:text-lg leading-tight font-semibold text-slate-900">{patient.idade}</p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-[11px] min-[360px]:text-xs leading-tight font-medium text-slate-600">Sexo</p>
            <p className="mt-1 text-base min-[360px]:text-lg leading-tight font-semibold text-slate-900">
              {patient.sexo === 'M' ? 'Masculino' : patient.sexo === 'F' ? 'Feminino' : 'Outro'}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-[11px] min-[360px]:text-xs leading-tight font-medium text-slate-600">Nascimento</p>
            <p className="mt-1 text-base min-[360px]:text-lg leading-tight font-semibold text-slate-900">
              {formatDate(patient.dataNascimento)}
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-[11px] min-[360px]:text-xs leading-tight font-medium text-slate-600">Registros</p>
            <p className="mt-1 text-base min-[360px]:text-lg leading-tight font-semibold text-slate-900">
              {records.length}
              {hasMoreRecords ? '+' : ''}
            </p>
          </div>
        </div>

        {/* Contact Info */}
        {(patient.telefone || patient.email) && (
          <div className="mt-4 flex flex-wrap gap-4">
            {patient.telefone && (
              <div className="flex items-center gap-2 text-xs min-[360px]:text-sm text-slate-600">
                <Phone className="h-4 w-4 text-slate-400" />
                {patient.telefone}
              </div>
            )}
            {patient.email && (
              <div className="flex items-center gap-2 text-xs min-[360px]:text-sm text-slate-600">
                <Mail className="h-4 w-4 text-slate-400" />
                {patient.email}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div ref={timelineRef} onScroll={handleTimelineScroll} className="flex-1 overflow-y-auto p-4 sm:p-6">
        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <div className="mb-5 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 min-[360px]:p-4 md:grid-cols-4">
          <select
            value={filters.tipoDocumento}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, tipoDocumento: event.target.value }))
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs min-[360px]:text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="">Todos os tipos</option>
            {DOCUMENT_TYPE_FILTERS.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={filters.profissional}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, profissional: event.target.value }))
            }
            placeholder="Filtrar por profissional"
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs min-[360px]:text-sm text-slate-700 placeholder-slate-400 focus:border-blue-500 focus:outline-none"
          />

          <input
            type="date"
            value={filters.dateFrom}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, dateFrom: event.target.value }))
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs min-[360px]:text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
          />

          <input
            type="date"
            value={filters.dateTo}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, dateTo: event.target.value }))
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs min-[360px]:text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
          />
        </div>

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
            <h2 className="text-base min-[360px]:text-lg leading-tight font-semibold text-slate-900">Histórico de Registros</h2>

            <div className="relative space-y-6 min-[360px]:space-y-8 pl-7 min-[360px]:pl-8">
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
                            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] min-[360px]:text-xs font-medium ${sourceBadge.className}`}
                            title={`Origem: ${sourceBadge.label}`}
                          >
                            {sourceBadge.label}
                          </span>
                        </div>
                      );
                    })()}

                    <div className="mb-3 flex flex-col min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between gap-2.5">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-lg p-2 ${getDocumentColor(record.tipoDocumento)}`}>
                          {getDocumentIcon(record.tipoDocumento)}
                        </div>
                        <div>
                          <p className="text-sm min-[360px]:text-base leading-tight font-semibold text-slate-900">{record.tipoDocumento}</p>
                          <p className="text-xs min-[360px]:text-sm leading-tight text-slate-600">{record.profissional}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] min-[360px]:text-xs font-medium text-slate-700">
                          <Calendar className="h-3 w-3" />
                          {formatDate(record.data)}
                        </span>
                        <button
                          onClick={() => handleOpenVersions(record)}
                          className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] min-[360px]:text-xs font-medium text-blue-700 transition hover:bg-blue-100"
                          title="Ver histórico de versões"
                        >
                          <History className="h-3.5 w-3.5" />
                          Versões
                        </button>
                        <button
                          onClick={() => handleOpenEditRecord(record)}
                          className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] min-[360px]:text-xs font-medium text-indigo-700 transition hover:bg-indigo-100"
                          title="Editar registro"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          Editar
                        </button>
                        <button
                          onClick={() => handleDeleteRecord(record.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] min-[360px]:text-xs font-medium text-red-700 transition hover:bg-red-100"
                          title="Deletar registro"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Excluir
                        </button>
                      </div>
                    </div>

                    <div className="mb-3">
                      <p className="text-[11px] min-[360px]:text-xs font-medium uppercase tracking-wide text-slate-500">
                        {record.especialidade}
                      </p>
                    </div>

                    {record.resumo && (
                      <p className="mb-3 text-xs min-[360px]:text-sm leading-relaxed font-medium text-slate-800">{record.resumo}</p>
                    )}

                    <p className="text-xs min-[360px]:text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{record.conteudo}</p>

                    {(record.cid10Codes?.length ||
                      record.medications?.length ||
                      record.allergies?.length ||
                      record.followUpDate ||
                      record.bioimpedance) && (
                      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <h4 className="text-[11px] min-[360px]:text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Dados clínicos estruturados
                        </h4>

                        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                          {record.cid10Codes && record.cid10Codes.length > 0 && (
                            <div>
                              <p className="text-[11px] font-semibold text-slate-500">CID-10</p>
                              <p className="text-xs min-[360px]:text-sm text-slate-800">{record.cid10Codes.join(', ')}</p>
                            </div>
                          )}

                          {record.medications && record.medications.length > 0 && (
                            <div>
                              <p className="text-[11px] font-semibold text-slate-500">Medicações</p>
                              <p className="text-xs min-[360px]:text-sm text-slate-800">{record.medications.join(', ')}</p>
                            </div>
                          )}

                          {record.allergies && record.allergies.length > 0 && (
                            <div>
                              <p className="text-[11px] font-semibold text-slate-500">Alergias</p>
                              <p className="text-xs min-[360px]:text-sm text-slate-800">{record.allergies.join(', ')}</p>
                            </div>
                          )}

                          {record.followUpDate && (
                            <div>
                              <p className="text-[11px] font-semibold text-slate-500">Follow-up</p>
                              <p className="text-xs min-[360px]:text-sm text-slate-800">{formatDate(record.followUpDate)}</p>
                            </div>
                          )}
                        </div>

                        {record.bioimpedance && (
                          <div className="mt-3 border-t border-slate-200 pt-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Bioimpedância</p>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs min-[360px]:text-sm">
                              <p className="text-slate-700"><span className="font-medium">Altura:</span> {formatNumber(record.bioimpedance.alturaCm, ' cm')}</p>
                              <p className="text-slate-700"><span className="font-medium">Peso:</span> {formatNumber(record.bioimpedance.pesoKg, ' kg')}</p>
                              <p className="text-slate-700"><span className="font-medium">IMC:</span> {formatNumber(record.bioimpedance.imc)}</p>
                              <p className="text-slate-700"><span className="font-medium">PGC:</span> {formatNumber(record.bioimpedance.gorduraCorporalPercent, '%')}</p>
                              <p className="text-slate-700"><span className="font-medium">Massa magra:</span> {formatNumber(record.bioimpedance.massaMagraKg, ' kg')}</p>
                              <p className="text-slate-700"><span className="font-medium">Massa gordura:</span> {formatNumber(record.bioimpedance.massaGorduraKg, ' kg')}</p>
                            </div>

                            {record.bioimpedance.segmentalLean && (
                              <div className="mt-3">
                                <p className="text-[11px] font-semibold text-slate-500">Massa magra segmentar (kg)</p>
                                <div className="mt-1 grid grid-cols-2 gap-2 text-xs min-[360px]:text-sm">
                                  <p className="text-slate-700">Braço E: {formatNumber(record.bioimpedance.segmentalLean.leftArmKg, ' kg')}</p>
                                  <p className="text-slate-700">Braço D: {formatNumber(record.bioimpedance.segmentalLean.rightArmKg, ' kg')}</p>
                                  <p className="text-slate-700">Perna E: {formatNumber(record.bioimpedance.segmentalLean.leftLegKg, ' kg')}</p>
                                  <p className="text-slate-700">Perna D: {formatNumber(record.bioimpedance.segmentalLean.rightLegKg, ' kg')}</p>
                                  <p className="text-slate-700 col-span-2">Tronco: {formatNumber(record.bioimpedance.segmentalLean.trunkKg, ' kg')}</p>
                                </div>
                              </div>
                            )}

                            {record.bioimpedance.segmentalFat && (
                              <div className="mt-3">
                                <p className="text-[11px] font-semibold text-slate-500">Massa de gordura segmentar (kg)</p>
                                <div className="mt-1 grid grid-cols-2 gap-2 text-xs min-[360px]:text-sm">
                                  <p className="text-slate-700">Braço E: {formatNumber(record.bioimpedance.segmentalFat.leftArmKg, ' kg')}</p>
                                  <p className="text-slate-700">Braço D: {formatNumber(record.bioimpedance.segmentalFat.rightArmKg, ' kg')}</p>
                                  <p className="text-slate-700">Perna E: {formatNumber(record.bioimpedance.segmentalFat.leftLegKg, ' kg')}</p>
                                  <p className="text-slate-700">Perna D: {formatNumber(record.bioimpedance.segmentalFat.rightLegKg, ' kg')}</p>
                                  <p className="text-slate-700 col-span-2">Tronco: {formatNumber(record.bioimpedance.segmentalFat.trunkKg, ' kg')}</p>
                                </div>
                              </div>
                            )}

                            {record.bioimpedance.observacoes && (
                              <p className="mt-2 text-xs min-[360px]:text-sm text-slate-700">
                                <span className="font-medium">Observações:</span> {record.bioimpedance.observacoes}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoadingMore && (
                <div className="pl-2 text-xs text-slate-500">Carregando mais registros...</div>
              )}

              {!hasMoreRecords && records.length > 0 && (
                <div className="pl-2 text-xs text-slate-400">Fim dos registros carregados</div>
              )}
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

      {selectedRecordForEdit && (
        <EditRecordModal
          record={selectedRecordForEdit}
          onClose={handleCloseEditRecord}
          onSave={handleSaveEditRecord}
          isSaving={isSavingEdit}
        />
      )}
    </div>
  );
}
