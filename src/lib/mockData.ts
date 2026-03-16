/**
 * Dados mockados para o Prontuário Eletrônico
 */

import { Patient, MedicalRecord } from './types';

export const mockPatients: Patient[] = [
  {
    id: 'P001',
    nome: 'João Silva',
    nomeCompleto: 'João Carlos Silva Santos',
    idade: 45,
    sexo: 'M',
    cpf: '123.456.789-00',
    dataNascimento: '1979-05-12',
    telefone: '(11) 98765-4321',
    email: 'joao.silva@email.com',
  },
  {
    id: 'P002',
    nome: 'Maria Santos',
    nomeCompleto: 'Maria Oliveira Santos',
    idade: 38,
    sexo: 'F',
    cpf: '987.654.321-00',
    dataNascimento: '1986-08-20',
    telefone: '(11) 99876-5432',
    email: 'maria.santos@email.com',
  },
  {
    id: 'P003',
    nome: 'Pedro Costa',
    nomeCompleto: 'Pedro Henrique Costa Ferreira',
    idade: 62,
    sexo: 'M',
    cpf: '456.123.789-00',
    dataNascimento: '1963-12-03',
    telefone: '(11) 97654-3210',
    email: 'pedro.costa@email.com',
  },
];

export const mockMedicalRecords: MedicalRecord[] = [
  {
    id: 'M001',
    patientId: 'P001',
    data: '2026-03-10',
    tipoDocumento: 'Consulta',
    profissional: 'Dr. Roberto Alves',
    especialidade: 'Cardiologia',
    conteudo:
      'Paciente apresenta queixa de palpitações. Realizado exame físico com ausculta cardíaca normal. ECG solicitado para avaliação complementar. Pressão arterial 140/90 mmHg.',
    resumo: 'Avaliação de palpitações. Solicitado ECG.',
  },
  {
    id: 'M002',
    patientId: 'P001',
    data: '2026-02-28',
    tipoDocumento: 'Exame',
    profissional: 'Laboratório Central',
    especialidade: 'Patologia Clínica',
    conteudo:
      'Hemograma completo: Hb 14.5 g/dL, Ht 43%, leucócitos 7.5 mil, plaquetas 250 mil. Dentro dos limites normais.',
    resumo: 'Hemograma normal.',
  },
  {
    id: 'M003',
    patientId: 'P001',
    data: '2026-02-10',
    tipoDocumento: 'Prescrição',
    profissional: 'Dra. Paula Mendes',
    especialidade: 'Clínica Geral',
    conteudo:
      'Prescrito: Enalapril 10mg 1x ao dia, Atorvastatina 20mg 1x ao dia à noite, Ácido acetilsalicílico 100mg 1x ao dia.',
    resumo: 'Prescrição de anti-hipertensivo, estatina e antiadesivo.',
  },
  {
    id: 'M004',
    patientId: 'P002',
    data: '2026-03-12',
    tipoDocumento: 'Consulta',
    profissional: 'Dra. Juliana Costa',
    especialidade: 'Ginecologia',
    conteudo:
      'Paciente em consulta de rotina. Sem queixas. Ciclo menstrual regular. Exame pélvico normal. Realizado Papanicolau.',
    resumo: 'Consulta ginecológica de rotina. Papanicolau realizado.',
  },
  {
    id: 'M005',
    patientId: 'P002',
    data: '2026-03-01',
    tipoDocumento: 'Exame',
    profissional: 'Radiologia Diagnóstica',
    especialidade: 'Radiologia',
    conteudo:
      'Ultrassom de abdômen: Fígado, pâncreas e rins sem alterações. Vesícula semivazia. Sem cálculos biliares. Conclusão: Ultrassom normal.',
    resumo: 'Ultrassom de abdômen normal.',
  },
  {
    id: 'M006',
    patientId: 'P003',
    data: '2026-03-14',
    tipoDocumento: 'Consulta',
    profissional: 'Dr. Carlos Mendes',
    especialidade: 'Geriatria',
    conteudo:
      'Paciente idoso em acompanhamento multidisciplinar. Queixa de dores articulares generalizadas. Prescritos exercícios físicos leves e encaminhamento para fisioterapia. Avaliação cognitiva normal.',
    resumo: 'Avaliação geriátrica. Encaminhamento para fisioterapia.',
  },
  {
    id: 'M007',
    patientId: 'P003',
    data: '2026-02-20',
    tipoDocumento: 'Procedimento',
    profissional: 'Dr. Fernando Silva',
    especialidade: 'Ortopedia',
    conteudo:
      'Bloqueio articular de joelho esquerdo com corticoide. Procedimento realizado sob anestesia local com sucesso. Paciente tolerou bem. Repouso relativo recomendado por 48 horas.',
    resumo: 'Bloqueio articular de joelho com corticoide.',
  },
];

/**
 * Obtém os registros médicos de um paciente específico
 */
export function getPatientRecords(patientId: string): MedicalRecord[] {
  return mockMedicalRecords
    .filter((record) => record.patientId === patientId)
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
}

/**
 * Busca pacientes por nome
 */
export function searchPatients(query: string): Patient[] {
  const lowerQuery = query.toLowerCase();
  return mockPatients.filter(
    (patient) =>
      patient.nome.toLowerCase().includes(lowerQuery) ||
      patient.nomeCompleto.toLowerCase().includes(lowerQuery) ||
      patient.cpf.includes(query)
  );
}
