import { z } from 'zod';

export const medicalRecordDocumentTypes = [
  'Consulta',
  'Exame',
  'Procedimento',
  'Prescrição',
  'Internação',
] as const;

const optionalTrimmedString = z
  .string()
  .transform((value) => value.trim())
  .optional();

const optionalStringArray = z.array(z.string().trim().min(1)).optional();

export const medicalRecordCreateSchema = z.object({
  patientId: z.string().trim().min(1, 'patientId é obrigatório'),
  data: z.string().trim().min(1, 'Data é obrigatória'),
  tipoDocumento: z.enum(medicalRecordDocumentTypes),
  profissional: z.string().trim().min(1, 'Profissional é obrigatório'),
  especialidade: z.string().trim().min(1, 'Especialidade é obrigatória'),
  conteudo: z.string().trim().min(1, 'Conteúdo é obrigatório'),
  resumo: optionalTrimmedString,
  soapSubjetivo: optionalTrimmedString,
  soapObjetivo: optionalTrimmedString,
  soapAvaliacao: optionalTrimmedString,
  soapPlano: optionalTrimmedString,
  cid10Codes: optionalStringArray,
  medications: optionalStringArray,
  allergies: optionalStringArray,
  followUpDate: optionalTrimmedString,
});

export const medicalRecordPatchSchema = z
  .object({
    data: z.string().trim().min(1).optional(),
    tipoDocumento: z.enum(medicalRecordDocumentTypes).optional(),
    profissional: z.string().trim().min(1).optional(),
    especialidade: z.string().trim().min(1).optional(),
    conteudo: z.string().trim().min(1).optional(),
    resumo: optionalTrimmedString,
    soapSubjetivo: optionalTrimmedString,
    soapObjetivo: optionalTrimmedString,
    soapAvaliacao: optionalTrimmedString,
    soapPlano: optionalTrimmedString,
    cid10Codes: optionalStringArray,
    medications: optionalStringArray,
    allergies: optionalStringArray,
    followUpDate: optionalTrimmedString,
    sourceType: z.enum(['manual', 'transcription', 'teleconsulta']).optional(),
    sourceRefId: optionalTrimmedString,
    aiGenerated: z.boolean().optional(),
    clinicianReviewed: z.boolean().optional(),
    reviewedAt: optionalTrimmedString,
    changeReason: z.string().trim().min(3, 'Motivo da alteração deve ter ao menos 3 caracteres').optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Payload de atualização vazio',
  });

export const medicalRecordDeleteSchema = z.object({
  changeReason: z
    .string()
    .trim()
    .min(3, 'Motivo da exclusão deve ter ao menos 3 caracteres'),
});

export const medicalRecordFromTranscriptionSchema = z.object({
  patientId: z.string().trim().min(1, 'patientId é obrigatório'),
  data: z.string().trim().optional(),
  tipoDocumento: z.enum(medicalRecordDocumentTypes).default('Consulta'),
  profissional: z.string().trim().min(1, 'Profissional é obrigatório'),
  especialidade: z.string().trim().optional(),
  resumo: z.string().trim().optional(),
  conteudo: z.string().trim().min(1, 'Conteúdo clínico é obrigatório'),
  sourceRefId: z.string().trim().optional(),
  clinicianReviewed: z.boolean().optional(),
});

export const patientIdQuerySchema = z.object({
  patientId: z.string().trim().min(1, 'patientId é obrigatório'),
});

export const routeIdSchema = z.object({
  id: z.string().trim().min(1, 'id é obrigatório'),
});
