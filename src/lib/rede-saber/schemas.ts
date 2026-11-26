import { z } from "zod";

const senha = z.string().min(8, "A senha deve ter ao menos 8 caracteres.").max(128);
const papelAutoCadastro = z.enum(["idoso", "familiar", "profissional_cras", "escola"]);
const redirect = z
  .string()
  .url()
  .max(300)
  .refine((value) => value.startsWith("https://") || value.startsWith("http://localhost"), "Use uma URL HTTPS ou localhost.");

export const registerSchema = z.object({
  email: z.string().trim().email().max(255),
  senha,
  nome: z.string().trim().min(2).max(160),
  telefone: z.string().trim().max(30).optional(),
  papel: papelAutoCadastro,
  co_entidade: z.string().trim().regex(/^\d{1,8}$/).optional(),
  redirect_to: redirect.optional(),
});

export const loginSchema = z.object({ email: z.string().trim().email().max(255), senha });
export const refreshSchema = z.object({ refresh_token: z.string().min(20).max(5000) });

const perfilFields = {
  saberes: z.array(z.string().trim().min(2).max(80)).max(20).default([]),
  horarios: z.array(z.enum(["manha", "tarde", "noite"])).max(3).default([]),
  distancia_max_km: z.coerce.number().min(0).max(50).default(10),
};

export const createIdosoSchema = z.object({
  cpf: z.string().min(11).max(20),
  nome: z.string().trim().min(2).max(160),
  data_nascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  municipio_codigo: z.string().regex(/^\d{7}$/),
  user_id: z.string().uuid().optional(),
  ...perfilFields,
});

export const perfilIdosoSchema = z.object({
  municipio_codigo: z.string().regex(/^\d{7}$/),
  ...perfilFields,
});

export const vinculoSchema = z.object({
  idoso_id: z.string().uuid(),
  responsavel_id: z.string().uuid().optional(),
  tipo: z.enum(["filho", "neto", "cuidador", "outro"]),
});

export const criancaSchema = z.object({
  nome: z.string().trim().min(2).max(160),
  data_nascimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  co_entidade: z.string().trim().regex(/^\d{1,8}$/),
});

export const autorizacaoSchema = z.object({ responsavel_id: z.string().uuid() });

export const pedidoSchema = z.object({
  co_entidade: z.string().trim().regex(/^\d{1,8}$/),
  tema: z.string().trim().min(2).max(160),
  turma: z.string().trim().max(100).optional(),
  periodo: z.enum(["manha", "tarde", "noite"]),
});

export const decisaoSchema = z.object({
  decisao: z.enum(["aprovado", "recusado"]),
  motivo: z.string().trim().max(500).optional(),
});

export const pareamentoSchema = z.object({
  pedido_id: z.string().uuid(),
  limite: z.coerce.number().int().min(1).max(50).default(10),
});

export const encontroSchema = z.object({
  pareamento_id: z.string().uuid(),
  crianca_id: z.string().uuid(),
  data: z.string().datetime({ offset: true }),
  local: z.enum(["escola", "cras", "biblioteca"]),
});

export const presencaSchema = z.object({ pessoa_id: z.string().uuid(), presente: z.boolean() });

export const roleAssignmentSchema = z.object({
  papel: z.enum(["admin", "coordenacao", "escola", "idoso", "familiar", "profissional_cras"]),
  co_entidade: z.string().trim().regex(/^\d{1,8}$/).optional(),
});
