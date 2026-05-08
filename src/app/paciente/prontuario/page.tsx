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

export default async function PacienteProntuarioPage() {
  const patient = await getAuthenticatedPatientFromCookies();

  if (!patient) {
    redirect('/paciente/login');
  }

  const records = await getMedicalRecordsForPatientPortal(patient.id, 100);

  return (
    <PatientPortalShell
      title="Prontuário do Paciente"
      subtitle="Seus registros clínicos"
      patientName={patient.nomeCompleto}
      patientCpf={patient.cpf}
    >
      {records.length === 0 ? (
        <div className="bg-white border border-[#cfe0e8] rounded-xl p-4 sm:p-6 shadow-sm">
          <h3 className="text-base sm:text-lg font-bold text-[#155b79]">Prontuário</h3>
          <p className="mt-2 text-sm leading-relaxed text-[#4b6573]">
            Ainda não há registros no seu prontuário.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
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
              <p className="mt-2 text-sm leading-relaxed text-[#0c161c] whitespace-pre-wrap">{record.conteudo}</p>
            </article>
          ))}
        </div>
      )}
    </PatientPortalShell>
  );
}
