import { redirect } from 'next/navigation';
import PatientPortalShell from '@/components/PatientPortalShell';
import { getAuthenticatedPatientFromCookies } from '@/lib/patientSession';
import { getMedicalRecordsForPatientPortal } from '@/lib/medicalRecordManager';

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default async function PacienteHistoricoPage() {
  const patient = await getAuthenticatedPatientFromCookies();

  if (!patient) {
    redirect('/paciente/login');
  }

  const records = await getMedicalRecordsForPatientPortal(patient.id, 200);

  return (
    <PatientPortalShell
      title="Histórico de Atendimentos"
      subtitle="Sua linha do tempo de consultas"
      patientName={patient.nomeCompleto}
      patientCpf={patient.cpf}
    >
      {records.length === 0 ? (
        <div className="bg-white border border-[#cfe0e8] rounded-xl p-4 sm:p-6 shadow-sm">
          <h3 className="text-base sm:text-lg font-bold text-[#155b79]">Histórico</h3>
          <p className="mt-2 text-sm leading-relaxed text-[#4b6573]">
            Ainda não há atendimentos registrados para este paciente.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((record) => (
            <article key={record.id} className="bg-white border border-[#cfe0e8] rounded-xl p-4 sm:p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm sm:text-base font-bold text-[#155b79]">{record.tipoDocumento}</h3>
                <span className="text-xs text-[#4b6573]">{formatDate(record.data)}</span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-[#4b6573]">
                {record.profissional} - {record.especialidade}
              </p>
              {record.resumo && (
                <p className="mt-3 text-sm font-semibold text-[#0c161c]">{record.resumo}</p>
              )}
            </article>
          ))}
        </div>
      )}
    </PatientPortalShell>
  );
}
