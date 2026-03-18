import { z } from 'zod';

const optionalTrimmedString = z
  .string()
  .transform((value) => value.trim())
  .optional();

export const patientCreateSchema = z.object({
  nome: z.string().trim().min(1, 'Nome é obrigatório'),
  nomeCompleto: z.string().trim().min(1, 'Nome completo é obrigatório'),
  idade: z.number().int().min(0).max(150),
  sexo: z.enum(['M', 'F', 'Outro']),
  cpf: z.string().trim().min(1, 'CPF é obrigatório'),
  dataNascimento: z.string().trim().min(1, 'Data de nascimento é obrigatória'),
  telefone: optionalTrimmedString,
  email: optionalTrimmedString,
});

export const patientPatchSchema = patientCreateSchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: 'Payload de atualização vazio',
});

export const routeIdSchema = z.object({
  id: z.string().trim().min(1, 'id é obrigatório'),
});
