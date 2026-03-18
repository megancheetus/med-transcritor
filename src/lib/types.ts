/**
 * Tipos para o módulo de Prontuário Eletrônico
 */

export interface Patient {
  id: string;
  nome: string;
  nomeCompleto: string;
  idade: number;
  sexo: 'M' | 'F' | 'Outro';
  cpf: string;
  dataNascimento: string;
  telefone?: string;
  email?: string;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  data: string;
  tipoDocumento: 'Consulta' | 'Exame' | 'Procedimento' | 'Prescrição' | 'Internação';
  profissional: string;
  especialidade: string;
  conteudo: string;
  resumo?: string;
  soapSubjetivo?: string;
  soapObjetivo?: string;
  soapAvaliacao?: string;
  soapPlano?: string;
  cid10Codes?: string[];
  medications?: string[];
  allergies?: string[];
  followUpDate?: string;
  sourceType?: 'manual' | 'transcription' | 'teleconsulta';
  sourceRefId?: string;
  aiGenerated?: boolean;
  clinicianReviewed?: boolean;
  reviewedAt?: string;
}

export type SortOrder = 'asc' | 'desc';

// Tipos para Teleconsultas
export interface VideoConsultaRoom {
  id: string;
  professionalUsername: string;
  patientId: string;
  patientName?: string;
  status: 'waiting' | 'active' | 'ended' | 'expired';
  roomToken: string;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  expiresAt: string;
  duracaoSegundos?: number;
  foiGravada: boolean;
  transcricaoId?: string;
}

export interface VideoConsultaLog {
  id: string;
  roomId: string;
  evento: 'professional_joined' | 'patient_joined' | 'disconnected' | 'recording_started' | 'recording_stopped';
  timestamp: string;
  username: string;
}
