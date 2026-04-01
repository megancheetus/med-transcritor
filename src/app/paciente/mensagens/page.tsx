import { redirect } from 'next/navigation';
import { getAuthenticatedPatientFromCookies } from '@/lib/patientSession';
import PatientMessagesPanel from '@/components/PatientMessagesPanel';

export default async function PacienteMensagensPage() {
  const patient = await getAuthenticatedPatientFromCookies();

  if (!patient) {
    redirect('/paciente/login');
  }

  return (
    <PatientMessagesPanel
      patientName={patient.nomeCompleto}
      patientCpf={patient.cpf}
    />
  );
}
