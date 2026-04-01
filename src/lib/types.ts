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
  complementaryExamItems?: ComplementaryExamItem[];
  complementaryExams?: string[];
  medications?: string[];
  allergies?: string[];
  followUpDate?: string;
  bioimpedance?: BioimpedanceData;
  sourceType?: 'manual' | 'transcription' | 'teleconsulta';
  sourceRefId?: string;
  aiGenerated?: boolean;
  clinicianReviewed?: boolean;
  reviewedAt?: string;
}

export type ComplementaryExamStatus = 'solicitado' | 'realizado' | 'pendente' | 'cancelado' | 'nao_informado';

export interface ComplementaryExamItem {
  nome: string;
  data?: string;
  resultado?: string;
  status?: ComplementaryExamStatus;
}

export interface BioimpedanceSegmentalData {
  leftArmKg?: number;
  rightArmKg?: number;
  trunkKg?: number;
  leftLegKg?: number;
  rightLegKg?: number;
}

export interface BioimpedanceData {
  measuredAt?: string;
  source?: string;
  score?: number;
  alturaCm?: number;
  pesoKg?: number;
  imc?: number;
  gorduraCorporalPercent?: number;
  massaGorduraKg?: number;
  massaMagraKg?: number;
  musculoEsqueleticoKg?: number;
  aguaCorporalTotalL?: number;
  gorduraVisceralNivel?: number;
  taxaMetabolicaBasalKcal?: number;
  segmentalLean?: BioimpedanceSegmentalData;
  segmentalFat?: BioimpedanceSegmentalData;
  observacoes?: string;
}

export interface MedicalRecordVersion {
  id: string;
  medicalRecordId: string;
  versionNumber: number;
  snapshotJson: Record<string, unknown>;
  changedBy: string;
  changeReason?: string;
  createdAt: string;
}

export interface MedicalRecordAuditLog {
  id: string;
  username: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadataJson?: Record<string, unknown>;
  ipHash?: string;
  userAgent?: string;
  createdAt: string;
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
