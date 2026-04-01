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

export default async function PacienteMedicamentosPage() {
  const patient = await getAuthenticatedPatientFromCookies();

  if (!patient) {
    redirect('/paciente/login');
  }

  const records = await getMedicalRecordsForPatientPortal(patient.id, 150);
  const medicationRecords = records.filter(
    (record) => (record.medications && record.medications.length > 0) || record.tipoDocumento === 'Prescrição'
  );

  return (
    <PatientPortalShell
      title="Medicamentos"
      subtitle="Prescrições e orientações"
      patientName={patient.nomeCompleto}
      patientCpf={patient.cpf}
    >
      {medicationRecords.length === 0 ? (
        <div className="bg-white border border-[#cfe0e8] rounded-xl p-4 sm:p-6 shadow-sm">
          <h3 className="text-base sm:text-lg font-bold text-[#155b79]">Medicamentos prescritos</h3>
          <p className="mt-2 text-sm leading-relaxed text-[#4b6573]">
            Ainda não há medicações registradas em seu histórico.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {medicationRecords.map((record) => (
            <article key={record.id} className="bg-white border border-[#cfe0e8] rounded-xl p-4 sm:p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm sm:text-base font-bold text-[#155b79]">{record.tipoDocumento}</h3>
                <span className="text-xs text-[#4b6573]">{formatDate(record.data)}</span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-[#4b6573]">
                {record.profissional} - {record.especialidade}
              </p>

              {record.medications && record.medications.length > 0 ? (
                <ul className="mt-3 list-disc pl-5 text-sm text-[#0c161c] space-y-1">
                  {record.medications.map((item, index) => (
                    <li key={`${record.id}-med-${index}`}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-[#4b6573]">Sem lista estruturada de medicações neste registro.</p>
              )}
            </article>
          ))}
        </div>
      )}
    </PatientPortalShell>
  );
}
