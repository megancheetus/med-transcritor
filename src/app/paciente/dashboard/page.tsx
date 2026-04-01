import Image from "next/image";
import Link from "next/link";
import { redirect } from 'next/navigation';
import { getAuthenticatedPatientFromCookies } from '@/lib/patientSession';
import PatientPortalShell from '@/components/PatientPortalShell';
import {
  getLatestBioimpedanceByPatientId,
  getMedicalRecordsForPatientPortal,
} from '@/lib/medicalRecordManager';

function formatDate(dateString?: string): string {
  if (!dateString) {
    return '--';
  }

  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatNumber(value?: number, suffix?: string): string {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '--';
  }

  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}${suffix || ''}`;
}

function truncateText(text?: string, maxLength = 90): string {
  if (!text) {
    return '';
  }

  const normalized = text.replace(/\s+/g, ' ').trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

export default async function PacienteDashboard() {
  const patient = await getAuthenticatedPatientFromCookies();

  if (!patient) {
    redirect('/paciente/login');
  }

  const records = await getMedicalRecordsForPatientPortal(patient.id, 200);
  const latestBioimpedance = await getLatestBioimpedanceByPatientId(patient.id);

  const latestMedicationRecord = records.find(
    (record) => record.medications && record.medications.length > 0
  );

  const latestProblemRecord = records.find(
    (record) =>
      (record.cid10Codes && record.cid10Codes.length > 0) ||
      !!record.soapAvaliacao?.trim() ||
      !!record.resumo?.trim()
  );

  const recentAttendances = records.slice(0, 3);

  const getAttendanceClinicalSummary = (record: (typeof recentAttendances)[number]): string => {
    if (record.cid10Codes && record.cid10Codes.length > 0) {
      return `Diagnóstico: ${truncateText(record.cid10Codes.join(', '), 80)}`;
    }

    if (record.soapAvaliacao?.trim()) {
      return `Diagnóstico: ${truncateText(record.soapAvaliacao, 80)}`;
    }

    if (record.soapPlano?.trim()) {
      return `Conduta: ${truncateText(record.soapPlano, 80)}`;
    }

    if (record.resumo?.trim()) {
      return `Resumo: ${truncateText(record.resumo, 80)}`;
    }

    return 'Sem resumo clínico disponível neste atendimento.';
  };

  const latestProblemLabel = latestProblemRecord?.cid10Codes?.length
    ? latestProblemRecord.cid10Codes.join(', ')
    : latestProblemRecord?.soapAvaliacao?.trim() || latestProblemRecord?.resumo?.trim() || 'Sem CID/problema registrado';

  return (
    <PatientPortalShell
      title="Dashboard do Paciente"
      subtitle="Acompanhe seus dados clínicos em um só lugar"
      patientName={patient.nomeCompleto}
      patientCpf={patient.cpf}
    >
      <div className="space-y-6">
        <div className="bg-white border border-[#cfe0e8] rounded-xl p-4 sm:p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <Image src="/favicon.png" alt="OmniNote" width={28} height={28} className="w-7 h-7" />
            <h3 className="text-lg font-bold text-[#155b79]">Bem-vindo(a), {patient.nomeCompleto}</h3>
          </div>
          <p className="text-sm text-[#4b6573]">
            Este é o seu painel principal. Use os atalhos abaixo ou o menu lateral para acessar prontuário, composição corporal, medicamentos e histórico de atendimentos.
          </p>
          <div className="mt-4 grid grid-cols-1 sm:flex sm:flex-wrap gap-2">
            <Link href="/paciente/prontuario" className="inline-flex w-full sm:w-auto justify-center items-center rounded-lg bg-[#1a6a8d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#155b79] transition">
              Ver prontuário
            </Link>
            <Link href="/paciente/composicao-corporal" className="inline-flex w-full sm:w-auto justify-center items-center rounded-lg bg-[#0f766e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d5f59] transition">
              Ver composição corporal
            </Link>
            <Link href="/paciente/medicamentos" className="inline-flex w-full sm:w-auto justify-center items-center rounded-lg bg-[#1ea58c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#178c74] transition">
              Ver medicamentos
            </Link>
            <Link href="/paciente/historico" className="inline-flex w-full sm:w-auto justify-center items-center rounded-lg bg-[#fbbf24] px-4 py-2 text-sm font-semibold text-[#0c161c] hover:bg-[#f59e1b] transition">
              Ver histórico
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-[#cfe0e8] rounded-xl p-4 sm:p-5 shadow-sm">
            <p className="text-xs min-[360px]:text-sm leading-tight text-[#4b6573]">Composição corporal</p>
            <p className="text-xl min-[360px]:text-2xl leading-tight font-bold text-[#155b79] mt-1">Bioimpedância</p>
            {latestBioimpedance?.bioimpedance ? (
              <div className="mt-2 space-y-1 text-[11px] min-[360px]:text-xs leading-relaxed text-[#1ea58c]">
                <p>Última avaliação em {formatDate(latestBioimpedance.recordDate)}</p>
                <p>
                  Peso: {formatNumber(latestBioimpedance.bioimpedance.pesoKg, ' kg')} | IMC: {formatNumber(latestBioimpedance.bioimpedance.imc)} | PGC: {formatNumber(latestBioimpedance.bioimpedance.gorduraCorporalPercent, '%')}
                </p>
              </div>
            ) : (
              <p className="text-[11px] min-[360px]:text-xs leading-relaxed text-[#1ea58c] mt-2">Sem dados de bioimpedância registrados até o momento.</p>
            )}
          </div>

          <div className="bg-white border border-[#cfe0e8] rounded-xl p-4 sm:p-5 shadow-sm">
            <p className="text-xs min-[360px]:text-sm leading-tight text-[#4b6573]">Prontuário</p>
            <p className="text-xl min-[360px]:text-2xl leading-tight font-bold text-[#155b79] mt-1">Problemas ativos e em acompanhamento</p>
            <p className="text-[11px] min-[360px]:text-xs leading-relaxed text-[#1ea58c] mt-2 line-clamp-3">
              {latestProblemLabel}
            </p>
            <p className="text-[11px] text-[#7b8d97] mt-1">
              {latestProblemRecord ? `Atualizado em ${formatDate(latestProblemRecord.data)}` : 'Sem registros clínicos ainda'}
            </p>
          </div>

          <div className="bg-white border border-[#cfe0e8] rounded-xl p-4 sm:p-5 shadow-sm">
            <p className="text-xs min-[360px]:text-sm leading-tight text-[#4b6573]">Medicamentos</p>
            <p className="text-xl min-[360px]:text-2xl leading-tight font-bold text-[#155b79] mt-1">Medicamentos atuais</p>
            {latestMedicationRecord?.medications && latestMedicationRecord.medications.length > 0 ? (
              <div className="mt-2 space-y-1 text-[11px] min-[360px]:text-xs leading-relaxed text-[#1ea58c]">
                <p>Registro em {formatDate(latestMedicationRecord.data)}</p>
                <p className="line-clamp-3">{latestMedicationRecord.medications.join(', ')}</p>
              </div>
            ) : (
              <p className="text-[11px] min-[360px]:text-xs leading-relaxed text-[#1ea58c] mt-2">Sem medicações registradas no prontuário.</p>
            )}
          </div>

          <div className="bg-white border border-[#cfe0e8] rounded-xl p-4 sm:p-5 shadow-sm">
            <p className="text-xs min-[360px]:text-sm leading-tight text-[#4b6573]">Histórico</p>
            <p className="text-xl min-[360px]:text-2xl leading-tight font-bold text-[#155b79] mt-1">Últimos contatos</p>
            {recentAttendances.length > 0 ? (
              <ul className="mt-2 space-y-2 text-[11px] min-[360px]:text-xs leading-relaxed text-[#1ea58c]">
                {recentAttendances.map((record) => (
                  <li key={record.id} className="rounded-md bg-[#f4faf9] px-2 py-1.5">
                    <p className="line-clamp-1">
                      {formatDate(record.data)} - {record.profissional}
                    </p>
                    <p className="text-[#2c6b63] line-clamp-2">
                      {getAttendanceClinicalSummary(record)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] min-[360px]:text-xs leading-relaxed text-[#1ea58c] mt-2">Sem atendimentos registrados até o momento.</p>
            )}
          </div>
        </div>
      </div>
    </PatientPortalShell>
  );
}
