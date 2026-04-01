import Link from "next/link";
import { redirect } from 'next/navigation';
import { Activity, Clock3, FileText, Pill } from 'lucide-react';
import { getAuthenticatedPatientFromCookies } from '@/lib/patientSession';
import PatientPortalShell from '@/components/PatientPortalShell';
import {
  getLatestBioimpedanceByPatientId,
  getMedicalRecordsForPatientPortal,
} from '@/lib/medicalRecordManager';
import { listPatientPortalMessages } from '@/lib/patientPortalMessageManager';
import PatientUnreadMessagesToast from '@/components/PatientUnreadMessagesToast';

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

function getTrendLabel(current?: number, previous?: number, suffix = ''): string {
  if (current === undefined || previous === undefined) {
    return 'Sem comparativo recente';
  }

  const delta = current - previous;

  if (delta === 0) {
    return `Estável (0${suffix})`;
  }

  const signal = delta > 0 ? '+' : '';
  return `${signal}${delta.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}${suffix} vs anterior`;
}

function getTrendToneClass(current?: number, previous?: number): string {
  if (current === undefined || previous === undefined || current === previous) {
    return 'text-[#5d7180]';
  }

  return current > previous ? 'text-[#0f766e]' : 'text-[#b45309]';
}

export default async function PacienteDashboard() {
  const patient = await getAuthenticatedPatientFromCookies();

  if (!patient) {
    redirect('/paciente/login');
  }

  const records = await getMedicalRecordsForPatientPortal(patient.id, 200);
  const latestBioimpedance = await getLatestBioimpedanceByPatientId(patient.id);
  const portalMessages = await listPatientPortalMessages(patient.id, 5);
  const latestUnreadMessage = portalMessages.messages.find((message) => !message.readAt);

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
  const latestRecord = records[0];
  const bioRecords = records.filter((record) => !!record.bioimpedance);
  const latestBioFromHistory = bioRecords[0]?.bioimpedance;
  const previousBioFromHistory = bioRecords[1]?.bioimpedance;

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

  const followUpStatus = latestProblemRecord?.followUpDate
    ? `Próxima consulta em ${formatDate(latestProblemRecord.followUpDate)}`
    : 'Sem próxima consulta agendada';

  return (
    <PatientPortalShell
      title="Dashboard do Paciente"
      subtitle="Acompanhe seus dados clínicos em um só lugar"
      patientName={patient.nomeCompleto}
      patientCpf={patient.cpf}
    >
      <PatientUnreadMessagesToast
        unreadCount={portalMessages.unreadCount}
        latestUnreadMessageId={latestUnreadMessage?.id}
        latestUnreadMessageTitle={latestUnreadMessage?.title}
      />

      <div className="space-y-6">
        {portalMessages.unreadCount > 0 && (
          <div className="rounded-xl border border-[#f1d69a] bg-[#fff8e8] p-4 sm:p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#9a640b]">Aviso de mensagem</p>
                <h3 className="mt-1 text-base sm:text-lg font-bold text-[#7a4b00]">
                  Você tem {portalMessages.unreadCount} mensagem(ns) não lida(s) da equipe de saúde.
                </h3>
                {latestUnreadMessage && (
                  <p className="mt-1 text-sm text-[#8b5c12] line-clamp-2">
                    Última: {latestUnreadMessage.title}
                  </p>
                )}
              </div>

              <Link
                href="/paciente/mensagens"
                className="inline-flex w-full sm:w-auto justify-center items-center rounded-lg bg-[#a16508] px-4 py-2 text-sm font-semibold text-white hover:bg-[#8d5707] transition"
              >
                Ver mensagens
              </Link>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-r from-[#e8f5fb] via-[#f1fbf7] to-[#fff8e8] border border-[#cfe0e8] rounded-xl p-4 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-[#155b79]">Resumo do dia</h3>
              <p className="text-sm text-[#4b6573] mt-1">Olá, {patient.nomeCompleto}. Confira os principais pontos do seu acompanhamento.</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-white/70 border border-[#cfe0e8] px-3 py-1 text-xs text-[#3f5e6f] font-semibold">
              Atualizado em {formatDate(latestRecord?.data)}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="rounded-lg border border-[#dbeaf1] bg-white/80 p-3">
              <p className="text-[11px] text-[#5d7180]">Última evolução clínica</p>
              <p className="text-sm font-semibold text-[#164f68] line-clamp-1">{latestRecord ? formatDate(latestRecord.data) : 'Sem registros'}</p>
            </div>
            <div className="rounded-lg border border-[#dbeaf1] bg-white/80 p-3">
              <p className="text-[11px] text-[#5d7180]">Medicações em uso</p>
              <p className="text-sm font-semibold text-[#164f68]">{latestMedicationRecord?.medications?.length || 0} item(ns)</p>
            </div>
            <div className="rounded-lg border border-[#dbeaf1] bg-white/80 p-3">
              <p className="text-[11px] text-[#5d7180]">Status de seguimento</p>
              <p className="text-sm font-semibold text-[#164f68] line-clamp-1">{followUpStatus}</p>
            </div>
          </div>

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
          <div className="bg-white border border-[#b8e8dd] rounded-xl p-4 sm:p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs min-[360px]:text-sm leading-tight text-[#3f6e67]">Composição corporal</p>
                <p className="text-xl min-[360px]:text-2xl leading-tight font-bold text-[#0f766e] mt-1">Bioimpedância</p>
              </div>
              <span className="rounded-full bg-[#e8fbf5] p-2">
                <Activity className="h-4 w-4 text-[#0f766e]" />
              </span>
            </div>
            {latestBioimpedance?.bioimpedance ? (
              <div className="mt-2 space-y-2 text-[11px] min-[360px]:text-xs leading-relaxed text-[#1b8f7b]">
                <p>Última avaliação em {formatDate(latestBioimpedance.recordDate)}</p>
                <p>
                  Peso: {formatNumber(latestBioimpedance.bioimpedance.pesoKg, ' kg')} | IMC: {formatNumber(latestBioimpedance.bioimpedance.imc)} | PGC: {formatNumber(latestBioimpedance.bioimpedance.gorduraCorporalPercent, '%')}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="rounded-md bg-[#f1fbf7] border border-[#cdeee4] px-2 py-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-[#588178]">Tendência IMC</p>
                    <p className={`font-semibold ${getTrendToneClass(latestBioFromHistory?.imc, previousBioFromHistory?.imc)}`}>
                      {getTrendLabel(latestBioFromHistory?.imc, previousBioFromHistory?.imc)}
                    </p>
                  </div>
                  <div className="rounded-md bg-[#f1fbf7] border border-[#cdeee4] px-2 py-1.5">
                    <p className="text-[10px] uppercase tracking-wide text-[#588178]">Tendência PGC</p>
                    <p className={`font-semibold ${getTrendToneClass(latestBioFromHistory?.gorduraCorporalPercent, previousBioFromHistory?.gorduraCorporalPercent)}`}>
                      {getTrendLabel(latestBioFromHistory?.gorduraCorporalPercent, previousBioFromHistory?.gorduraCorporalPercent, '%')}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[11px] min-[360px]:text-xs leading-relaxed text-[#1ea58c] mt-2">Sem dados de bioimpedância registrados até o momento.</p>
            )}
          </div>

          <div className="bg-white border border-[#c9ddf8] rounded-xl p-4 sm:p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs min-[360px]:text-sm leading-tight text-[#4d6787]">Prontuário</p>
                <p className="text-xl min-[360px]:text-2xl leading-tight font-bold text-[#155b79] mt-1">Problemas ativos e em acompanhamento</p>
              </div>
              <span className="rounded-full bg-[#eef5ff] p-2">
                <FileText className="h-4 w-4 text-[#1f5d9a]" />
              </span>
            </div>
            <p className="text-[11px] min-[360px]:text-xs leading-relaxed text-[#246a8a] mt-2 line-clamp-3">
              {latestProblemLabel}
            </p>
            <p className="text-[11px] text-[#7b8d97] mt-1">
              {latestProblemRecord ? `Atualizado em ${formatDate(latestProblemRecord.data)}` : 'Sem registros clínicos ainda'}
            </p>
          </div>

          <div className="bg-white border border-[#b9e8d4] rounded-xl p-4 sm:p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs min-[360px]:text-sm leading-tight text-[#4d7a66]">Medicamentos</p>
                <p className="text-xl min-[360px]:text-2xl leading-tight font-bold text-[#14795e] mt-1">Medicamentos atuais</p>
              </div>
              <span className="rounded-full bg-[#edfbf5] p-2">
                <Pill className="h-4 w-4 text-[#14795e]" />
              </span>
            </div>
            {latestMedicationRecord?.medications && latestMedicationRecord.medications.length > 0 ? (
              <div className="mt-2 space-y-1 text-[11px] min-[360px]:text-xs leading-relaxed text-[#188768]">
                <p>Registro em {formatDate(latestMedicationRecord.data)}</p>
                <p className="line-clamp-3">{latestMedicationRecord.medications.join(', ')}</p>
              </div>
            ) : (
              <p className="text-[11px] min-[360px]:text-xs leading-relaxed text-[#1ea58c] mt-2">Sem medicações registradas no prontuário.</p>
            )}
          </div>

          <div className="bg-white border border-[#f3ddad] rounded-xl p-4 sm:p-5 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs min-[360px]:text-sm leading-tight text-[#806532]">Histórico</p>
                <p className="text-xl min-[360px]:text-2xl leading-tight font-bold text-[#a16508] mt-1">Últimos contatos</p>
              </div>
              <span className="rounded-full bg-[#fff7e7] p-2">
                <Clock3 className="h-4 w-4 text-[#a16508]" />
              </span>
            </div>
            {recentAttendances.length > 0 ? (
              <ul className="mt-3 border-l-2 border-[#f2c97a] pl-4 space-y-3 text-[11px] min-[360px]:text-xs leading-relaxed text-[#8f5c09]">
                {recentAttendances.map((record) => (
                  <li key={record.id} className="relative rounded-md bg-[#fffaf0] border border-[#f8e4bb] px-2.5 py-2">
                    <span className="absolute -left-[21px] top-3 h-2.5 w-2.5 rounded-full bg-[#d99a2b]" />
                    <p className="line-clamp-1 font-semibold text-[#8f5c09]">
                      {formatDate(record.data)} - {record.profissional}
                    </p>
                    <p className="text-[#9f731d] line-clamp-2">
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
