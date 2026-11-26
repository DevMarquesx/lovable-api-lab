import { createHmac } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getEscolas, municipiosData } from "@/lib/observatorio-data";
import { ApiError, portalError, portalJson, readValidatedJson, requiredUuid } from "./http";
import {
  autorizacaoSchema,
  createIdosoSchema,
  criancaSchema,
  decisaoSchema,
  encontroSchema,
  loginSchema,
  pareamentoSchema,
  pedidoSchema,
  perfilIdosoSchema,
  presencaSchema,
  refreshSchema,
  registerSchema,
  roleAssignmentSchema,
  vinculoSchema,
} from "./schemas";
import {
  calculateMatchScore,
  checkMeetingProtection,
  is60Plus,
  isCertificateValid,
  isValidCpf,
  normalizeCpf,
} from "./validation";

type Client = SupabaseClient<Database>;
type Role = Database["public"]["Enums"]["app_role"];
type Session = { client: Client; userId: string; roles: Role[]; profile: { id: string; nome: string; telefone: string | null } | null };

function createApiClient(token?: string): Client {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new ApiError(503, "BACKEND_NAO_CONFIGURADO", "O backend não está configurado.");

  const apiFetch: typeof fetch = (input, init) => {
    const headers = new Headers(typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined);
    if (init?.headers) new Headers(init.headers).forEach((value, name) => headers.set(name, value));
    if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };

  return createClient<Database>(url, key, {
    global: { fetch: apiFetch, ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

function databaseError(error: { code?: string; message: string }): never {
  if (error.code === "23505") throw new ApiError(409, "REGISTRO_DUPLICADO", "Já existe um registro com esses dados.");
  if (error.code === "23503") throw new ApiError(422, "REFERENCIA_INVALIDA", "Um dos registros relacionados não existe.");
  if (error.code === "42501") throw new ApiError(403, "PROIBIDO", "Seu papel ou vínculo não permite esta ação.");
  console.error("Erro de banco na API Rede Saber:", error.message);
  throw new ApiError(400, "OPERACAO_NAO_CONCLUIDA", "Não foi possível concluir a operação.");
}

async function authenticate(request: Request): Promise<Session> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw new ApiError(401, "NAO_AUTENTICADO", "Envie Authorization: Bearer <access_token>.");
  const token = authorization.slice(7).trim();
  if (token.split(".").length !== 3) throw new ApiError(401, "TOKEN_INVALIDO", "O token de acesso é inválido.");

  const client = createApiClient(token);
  const { data: claimsData, error: claimsError } = await client.auth.getClaims(token);
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) throw new ApiError(401, "TOKEN_INVALIDO", "O token de acesso é inválido ou expirou.");

  const [{ data: roleRows, error: rolesError }, { data: profile, error: profileError }] = await Promise.all([
    client.from("user_roles").select("role").eq("user_id", userId),
    client.from("profiles").select("id, nome, telefone").eq("id", userId).maybeSingle(),
  ]);
  if (rolesError) databaseError(rolesError);
  if (profileError) databaseError(profileError);
  return { client, userId, roles: (roleRows ?? []).map((row) => row.role), profile };
}

function hasRole(session: Session, role: Role): boolean {
  return session.roles.includes("admin") || session.roles.includes(role);
}

function requireRole(session: Session, ...roles: Role[]): void {
  if (session.roles.includes("admin") || roles.some((role) => session.roles.includes(role))) return;
  throw new ApiError(403, "PROIBIDO", "Seu papel não permite esta ação.");
}

function requireManager(session: Session): void {
  requireRole(session, "coordenacao");
}

async function audit(session: Session, acao: string, entidade: string, entidadeId: string | null, detalhes: Record<string, string | number | boolean> = {}) {
  const { error } = await session.client.from("auditoria").insert({
    actor_id: session.userId,
    acao,
    entidade,
    entidade_id: entidadeId,
    detalhes,
  });
  if (error) console.error("Falha ao registrar auditoria:", error.message);
}

async function findIdoso(session: Session, id: string) {
  const { data, error } = await session.client.from("idosos").select("*").eq("id", id).maybeSingle();
  if (error) databaseError(error);
  if (!data) throw new ApiError(404, "NAO_ENCONTRADO", "Idoso não encontrado ou sem permissão de acesso.");
  return data;
}

function assertMunicipio(codigo: string): void {
  if (!municipiosData.some((municipio) => municipio.codigo_municipio === codigo)) {
    throw new ApiError(422, "MUNICIPIO_INVALIDO", "Informe um código IBGE de município da Região Norte.");
  }
}

function assertEscola(coEntidade: string): void {
  if (!getEscolas().some((escola) => escola.co_entidade === coEntidade)) {
    throw new ApiError(422, "ESCOLA_INVALIDA", "Informe um código INEP existente na base do Observatório.");
  }
}

function addDays(date: Date, days: number): string {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

function consentFhir(row: {
  id: string;
  idoso_id: string;
  status: string;
  provision_type: string;
  inicio: string;
  fim: string | null;
}) {
  return {
    resourceType: "Consent",
    id: row.id,
    status: row.status,
    patient: { reference: `Patient/${row.idoso_id}` },
    provision: {
      type: row.provision_type,
      period: { start: row.inicio, ...(row.fim ? { end: row.fim } : {}) },
      purpose: [{ display: "Participação nos encontros da Rede Saber 60+" }],
    },
  };
}

async function register(request: Request): Promise<Response> {
  const input = await readValidatedJson(request, registerSchema);
  if (input.papel === "escola") {
    if (!input.co_entidade) throw new ApiError(422, "ESCOLA_OBRIGATORIA", "Usuários da escola precisam informar co_entidade.");
    assertEscola(input.co_entidade);
  }

  const client = createApiClient();
  const { data, error } = await client.auth.signUp({
    email: input.email,
    password: input.senha,
    options: {
      data: { nome: input.nome },
      ...(input.redirect_to ? { emailRedirectTo: input.redirect_to } : {}),
    },
  });
  if (error) throw new ApiError(400, "CADASTRO_NAO_CONCLUIDO", error.message);
  if (!data.user) throw new ApiError(400, "CADASTRO_NAO_CONCLUIDO", "Não foi possível criar a conta.");

  // Supabase returns a user with empty identities for an already registered email.
  // Do not attach roles to that existing account from an anonymous request.
  if (Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return portalJson({ mensagem: "Se o cadastro for novo, confirme o e-mail antes de entrar.", confirmacao_pendente: true }, 202);
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  try {
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: data.user.id,
      nome: input.nome,
      telefone: input.telefone ?? null,
    });
    if (profileError) throw profileError;
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({ user_id: data.user.id, role: input.papel });
    if (roleError) throw roleError;
    if (input.papel === "escola" && input.co_entidade) {
      const { error: schoolError } = await supabaseAdmin.from("escola_usuarios").insert({ user_id: data.user.id, co_entidade: input.co_entidade });
      if (schoolError) throw schoolError;
    }
  } catch (setupError) {
    await supabaseAdmin.auth.admin.deleteUser(data.user.id);
    console.error("Cadastro revertido por falha na configuração inicial.");
    throw setupError;
  }

  return portalJson(
    {
      user_id: data.user.id,
      papel: input.papel,
      confirmacao_pendente: !data.session,
      mensagem: data.session ? "Conta criada." : "Confirme o e-mail antes de fazer login.",
    },
    201,
  );
}

async function login(request: Request): Promise<Response> {
  const input = await readValidatedJson(request, loginSchema);
  const client = createApiClient();
  const { data, error } = await client.auth.signInWithPassword({ email: input.email, password: input.senha });
  if (error || !data.session) throw new ApiError(401, "LOGIN_INVALIDO", "E-mail ou senha inválidos, ou e-mail ainda não confirmado.");

  const authenticated = createApiClient(data.session.access_token);
  const { data: roles, error: rolesError } = await authenticated.from("user_roles").select("role").eq("user_id", data.user.id);
  if (rolesError) databaseError(rolesError);
  return portalJson({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    token_type: "bearer",
    expires_in: data.session.expires_in,
    user: { id: data.user.id, email: data.user.email },
    papeis: (roles ?? []).map((row) => row.role),
  });
}

async function refresh(request: Request): Promise<Response> {
  const input = await readValidatedJson(request, refreshSchema);
  const client = createApiClient();
  const { data, error } = await client.auth.refreshSession({ refresh_token: input.refresh_token });
  if (error || !data.session) throw new ApiError(401, "REFRESH_INVALIDO", "Não foi possível renovar a sessão; faça login novamente.");
  return portalJson({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    token_type: "bearer",
    expires_in: data.session.expires_in,
  });
}

async function createIdoso(session: Session, request: Request): Promise<Response> {
  requireRole(session, "idoso", "profissional_cras");
  const input = await readValidatedJson(request, createIdosoSchema);
  if (!isValidCpf(input.cpf)) throw new ApiError(422, "CPF_INVALIDO", "CPF inválido pelos dígitos verificadores.");
  if (!is60Plus(input.data_nascimento)) throw new ApiError(422, "IDADE_MINIMA", "O cadastro é destinado a pessoas com 60 anos ou mais.");
  assertMunicipio(input.municipio_codigo);
  if (input.user_id && input.user_id !== session.userId) requireRole(session, "profissional_cras");

  const secret = process.env["CPF_HASH_SECRET"];
  if (!secret) throw new ApiError(503, "PROTECAO_NAO_CONFIGURADA", "A proteção do CPF não está configurada.");
  const cpfHash = createHmac("sha256", secret).update(normalizeCpf(input.cpf)).digest("hex");
  const isSelf = session.roles.includes("idoso") && !session.roles.includes("profissional_cras") && !session.roles.includes("admin");
  const userId = isSelf ? session.userId : (input.user_id ?? null);

  const { data, error } = await session.client
    .from("idosos")
    .insert({
      user_id: userId,
      cpf_hash: cpfHash,
      nome: input.nome,
      data_nascimento: input.data_nascimento,
      municipio_codigo: input.municipio_codigo,
      saberes: input.saberes,
      horarios: input.horarios,
      distancia_max_km: input.distancia_max_km,
      cadastrado_por: session.userId,
    })
    .select("id, user_id, nome, data_nascimento, municipio_codigo, saberes, horarios, distancia_max_km, ativo, cadastrado_por, created_at")
    .single();
  if (error) databaseError(error);
  await audit(session, "criar", "idoso", data.id, { municipio_codigo: input.municipio_codigo });
  return portalJson({ ...data, status: "novo" }, 201);
}

async function updatePerfilIdoso(session: Session, idosoId: string, request: Request): Promise<Response> {
  const input = await readValidatedJson(request, perfilIdosoSchema);
  assertMunicipio(input.municipio_codigo);
  await findIdoso(session, idosoId);
  const { data, error } = await session.client
    .from("idosos")
    .update({
      municipio_codigo: input.municipio_codigo,
      saberes: input.saberes,
      horarios: input.horarios,
      distancia_max_km: input.distancia_max_km,
      updated_at: new Date().toISOString(),
    })
    .eq("id", idosoId)
    .select("id, municipio_codigo, saberes, horarios, distancia_max_km, updated_at")
    .single();
  if (error) databaseError(error);
  await audit(session, "atualizar_perfil", "idoso", idosoId);
  return portalJson(data);
}

async function createVinculo(session: Session, request: Request): Promise<Response> {
  const input = await readValidatedJson(request, vinculoSchema);
  const idoso = await findIdoso(session, input.idoso_id);
  const isOwner = idoso.user_id === session.userId;
  if (!isOwner && !session.roles.includes("admin") && !session.roles.includes("profissional_cras")) {
    throw new ApiError(403, "PROIBIDO", "Somente o idoso, um profissional do CRAS ou o administrador podem criar vínculos.");
  }
  if (!input.responsavel_id) throw new ApiError(422, "RESPONSAVEL_OBRIGATORIO", "Informe responsavel_id.");
  const { data, error } = await session.client
    .from("vinculos")
    .insert({ idoso_id: input.idoso_id, responsavel_id: input.responsavel_id, tipo: input.tipo })
    .select("*")
    .single();
  if (error) databaseError(error);
  await audit(session, "criar", "vinculo", data.id, { tipo: input.tipo });
  return portalJson(data, 201);
}

async function revokeVinculo(session: Session, vinculoId: string): Promise<Response> {
  requiredUuid(vinculoId, "vinculo_id");
  const { data: current, error: findError } = await session.client.from("vinculos").select("id, idoso_id").eq("id", vinculoId).maybeSingle();
  if (findError) databaseError(findError);
  if (!current) throw new ApiError(404, "NAO_ENCONTRADO", "Vínculo não encontrado.");
  const idoso = await findIdoso(session, current.idoso_id);
  if (idoso.user_id !== session.userId && !session.roles.includes("admin")) {
    throw new ApiError(403, "PROIBIDO", "Somente o próprio idoso ou o administrador podem revogar o vínculo.");
  }
  const { data, error } = await session.client
    .from("vinculos")
    .update({ ativo: false, revogado_em: new Date().toISOString() })
    .eq("id", vinculoId)
    .select("*")
    .single();
  if (error) databaseError(error);
  await audit(session, "revogar", "vinculo", vinculoId);
  return portalJson(data);
}

async function saveConsent(session: Session, idosoId: string, active: boolean): Promise<Response> {
  const idoso = await findIdoso(session, idosoId);
  if (idoso.user_id !== session.userId && !session.roles.includes("admin")) {
    throw new ApiError(403, "PROIBIDO", "Somente o próprio idoso pode conceder ou revogar o consentimento.");
  }
  const now = new Date().toISOString();
  const { data, error } = await session.client
    .from("consentimentos_saude")
    .upsert(
      {
        idoso_id: idosoId,
        status: active ? "active" : "inactive",
        provision_type: active ? "permit" : "deny",
        inicio: now,
        fim: null,
        updated_at: now,
      },
      { onConflict: "idoso_id" },
    )
    .select("*")
    .single();
  if (error) databaseError(error);
  await audit(session, active ? "conceder" : "revogar", "consentimento_saude", data.id);
  return portalJson(consentFhir(data), active ? 201 : 200);
}

async function requestCertificate(session: Session, idosoId: string): Promise<Response> {
  await findIdoso(session, idosoId);
  const { data: existing, error: findError } = await session.client.from("certidoes").select("*").eq("idoso_id", idosoId).maybeSingle();
  if (findError) databaseError(findError);
  if (existing) return portalJson({ ...existing, simulada: true });

  const now = new Date();
  const { data, error } = await session.client
    .from("certidoes")
    .insert({ idoso_id: idosoId, status: "aprovado", data_emissao: now.toISOString().slice(0, 10), validade: addDays(now, 180), solicitado_por: session.userId })
    .select("*")
    .single();
  if (error) databaseError(error);
  await audit(session, "emitir_simulada", "certidao", data.id);
  return portalJson({ ...data, simulada: true }, 201);
}

async function certificateEligibility(session: Session, idosoId: string): Promise<Response> {
  await findIdoso(session, idosoId);
  const { data, error } = await session.client.from("certidoes").select("*").eq("idoso_id", idosoId).maybeSingle();
  if (error) databaseError(error);
  if (!data) throw new ApiError(404, "NAO_ENCONTRADO", "Nenhuma certidão foi solicitada para este idoso.");
  const liberado = isCertificateValid(data);
  return portalJson({ liberado, motivo: liberado ? "Certidão aprovada e válida." : "Certidão ausente, reprovada ou vencida.", certidao: { ...data, simulada: true } });
}

async function createCrianca(session: Session, request: Request): Promise<Response> {
  requireManager(session);
  const input = await readValidatedJson(request, criancaSchema);
  assertEscola(input.co_entidade);
  const birth = new Date(`${input.data_nascimento}T00:00:00.000Z`);
  if (Number.isNaN(birth.getTime()) || birth >= new Date()) throw new ApiError(422, "DATA_INVALIDA", "A data de nascimento deve ser válida e estar no passado.");
  const { data, error } = await session.client.from("criancas").insert({ ...input, cadastrado_por: session.userId }).select("*").single();
  if (error) databaseError(error);
  await audit(session, "criar", "crianca", data.id, { co_entidade: input.co_entidade });
  return portalJson(data, 201);
}

async function authorizeCrianca(session: Session, criancaId: string, request: Request): Promise<Response> {
  requireManager(session);
  requiredUuid(criancaId, "crianca_id");
  const input = await readValidatedJson(request, autorizacaoSchema);
  const { data, error } = await session.client
    .from("autorizacoes_criancas")
    .insert({ crianca_id: criancaId, responsavel_id: input.responsavel_id })
    .select("*")
    .single();
  if (error) databaseError(error);
  await audit(session, "autorizar", "crianca", criancaId);
  return portalJson(data, 201);
}

async function createPedido(session: Session, request: Request): Promise<Response> {
  requireRole(session, "escola");
  const input = await readValidatedJson(request, pedidoSchema);
  assertEscola(input.co_entidade);
  const { data, error } = await session.client
    .from("pedidos_escola")
    .insert({
      co_entidade: input.co_entidade,
      tema: input.tema,
      turma: input.turma ?? null,
      periodo: input.periodo,
      criado_por: session.userId,
    })
    .select("*")
    .single();
  if (error) databaseError(error);
  await audit(session, "criar", "pedido_escola", data.id, { co_entidade: input.co_entidade });
  return portalJson(data, 201);
}

async function decidePedido(session: Session, pedidoId: string, request: Request): Promise<Response> {
  requireManager(session);
  requiredUuid(pedidoId, "pedido_id");
  const input = await readValidatedJson(request, decisaoSchema);
  const { data, error } = await session.client
    .from("pedidos_escola")
    .update({ status: input.decisao, motivo_decisao: input.motivo ?? null, decidido_por: session.userId, updated_at: new Date().toISOString() })
    .eq("id", pedidoId)
    .select("*")
    .single();
  if (error) databaseError(error);
  await audit(session, "decidir", "pedido_escola", pedidoId, { decisao: input.decisao });
  return portalJson(data);
}

async function suggestMatches(session: Session, request: Request): Promise<Response> {
  requireManager(session);
  const input = await readValidatedJson(request, pareamentoSchema);
  const { data: pedido, error: pedidoError } = await session.client.from("pedidos_escola").select("*").eq("id", input.pedido_id).maybeSingle();
  if (pedidoError) databaseError(pedidoError);
  if (!pedido) throw new ApiError(404, "NAO_ENCONTRADO", "Pedido não encontrado.");
  if (pedido.status !== "aprovado") throw new ApiError(422, "PEDIDO_NAO_APROVADO", "Aprove o pedido antes de buscar pareamentos.");

  const { data: idosos, error: idososError } = await session.client.from("idosos").select("*").eq("ativo", true).limit(500);
  if (idososError) databaseError(idososError);
  const ids = (idosos ?? []).map((idoso) => idoso.id);
  if (ids.length === 0) return portalJson([]);

  const [{ data: certidoes, error: certError }, { data: consentimentos, error: consentError }] = await Promise.all([
    session.client.from("certidoes").select("*").in("idoso_id", ids),
    session.client.from("consentimentos_saude").select("*").in("idoso_id", ids).eq("status", "active").eq("provision_type", "permit"),
  ]);
  if (certError) databaseError(certError);
  if (consentError) databaseError(consentError);
  const validCertificates = new Set((certidoes ?? []).filter((cert) => isCertificateValid(cert)).map((cert) => cert.idoso_id));
  const activeConsents = new Set((consentimentos ?? []).map((consent) => consent.idoso_id));
  const school = getEscolas().find((escola) => escola.co_entidade === pedido.co_entidade);

  const candidates = (idosos ?? [])
    .filter((idoso) => validCertificates.has(idoso.id) && activeConsents.has(idoso.id))
    .map((idoso) => ({
      idoso_id: idoso.id,
      chance_continuidade: calculateMatchScore({
        saberes: idoso.saberes,
        tema: pedido.tema,
        horarios: idoso.horarios,
        periodo: pedido.periodo,
        mesmoMunicipio: school?.codigo_municipio === idoso.municipio_codigo,
      }),
      distancia_km: null,
      elegivel: true,
    }))
    .sort((a, b) => b.chance_continuidade - a.chance_continuidade)
    .slice(0, input.limite);

  if (candidates.length > 0) {
    const { error: insertError } = await session.client.from("pareamentos").upsert(
      candidates.map((candidate) => ({ pedido_id: pedido.id, idoso_id: candidate.idoso_id, chance_continuidade: candidate.chance_continuidade, distancia_km: null })),
      { onConflict: "pedido_id,idoso_id", ignoreDuplicates: true },
    );
    if (insertError) databaseError(insertError);
  }
  const { data: saved, error: savedError } = await session.client.from("pareamentos").select("*").eq("pedido_id", pedido.id);
  if (savedError) databaseError(savedError);
  const byIdoso = new Map((saved ?? []).map((row) => [row.idoso_id, row]));
  await audit(session, "sugerir", "pareamento", pedido.id, { quantidade: candidates.length });
  return portalJson(candidates.map((candidate) => ({ ...candidate, pareamento_id: byIdoso.get(candidate.idoso_id)?.id, status: byIdoso.get(candidate.idoso_id)?.status ?? "pendente" })));
}

async function decideMatch(session: Session, matchId: string, request: Request): Promise<Response> {
  requireManager(session);
  requiredUuid(matchId, "pareamento_id");
  const input = await readValidatedJson(request, decisaoSchema);
  const { data, error } = await session.client
    .from("pareamentos")
    .update({ status: input.decisao, motivo_decisao: input.motivo ?? null, updated_at: new Date().toISOString() })
    .eq("id", matchId)
    .select("*")
    .single();
  if (error) databaseError(error);
  await audit(session, "decidir", "pareamento", matchId, { decisao: input.decisao });
  return portalJson(data);
}

async function createMeeting(session: Session, request: Request): Promise<Response> {
  requireManager(session);
  const input = await readValidatedJson(request, encontroSchema);
  if (new Date(input.data) <= new Date()) throw new ApiError(422, "DATA_INVALIDA", "O encontro deve ser agendado para uma data futura.");
  const { data: match, error: matchError } = await session.client.from("pareamentos").select("*").eq("id", input.pareamento_id).maybeSingle();
  if (matchError) databaseError(matchError);
  if (!match) throw new ApiError(404, "NAO_ENCONTRADO", "Pareamento não encontrado.");

  const [{ data: certidao, error: certError }, { data: consentimento, error: consentError }, { data: autorizacao, error: authError }] = await Promise.all([
    session.client.from("certidoes").select("status, validade").eq("idoso_id", match.idoso_id).maybeSingle(),
    session.client.from("consentimentos_saude").select("status, provision_type").eq("idoso_id", match.idoso_id).maybeSingle(),
    session.client.from("autorizacoes_criancas").select("id").eq("crianca_id", input.crianca_id).eq("ativo", true).limit(1).maybeSingle(),
  ]);
  if (certError) databaseError(certError);
  if (consentError) databaseError(consentError);
  if (authError) databaseError(authError);
  const protection = checkMeetingProtection({
    pareamentoStatus: match.status,
    certidao,
    consentimentoStatus: consentimento?.status ?? null,
    provisionType: consentimento?.provision_type ?? null,
    autorizacaoAtiva: Boolean(autorizacao),
  });
  if (!protection.liberado) throw new ApiError(403, "PROTECAO_NAO_ATENDIDA", protection.motivo);

  const { data, error } = await session.client.from("encontros").insert({ ...input, criado_por: session.userId }).select("*").single();
  if (error) databaseError(error);
  await audit(session, "agendar", "encontro", data.id, { local: input.local });
  return portalJson(data, 201);
}

async function registerPresence(session: Session, encontroId: string, request: Request): Promise<Response> {
  requireManager(session);
  requiredUuid(encontroId, "encontro_id");
  const input = await readValidatedJson(request, presencaSchema);
  const { data: meeting, error: meetingError } = await session.client.from("encontros").select("id, pareamento_id, crianca_id").eq("id", encontroId).maybeSingle();
  if (meetingError) databaseError(meetingError);
  if (!meeting) throw new ApiError(404, "NAO_ENCONTRADO", "Encontro não encontrado.");
  const { data: match, error: matchError } = await session.client.from("pareamentos").select("idoso_id").eq("id", meeting.pareamento_id).single();
  if (matchError) databaseError(matchError);
  const idoso = await findIdoso(session, match.idoso_id);
  const validParticipants = new Set([meeting.crianca_id, idoso.id, ...(idoso.user_id ? [idoso.user_id] : [])]);
  if (!validParticipants.has(input.pessoa_id)) throw new ApiError(422, "PESSOA_NAO_VINCULADA", "A pessoa não participa deste encontro.");

  const { data, error } = await session.client
    .from("presencas")
    .insert({ encontro_id: encontroId, pessoa_id: input.pessoa_id, presente: input.presente, registrado_por: session.userId })
    .select("*")
    .single();
  if (error) databaseError(error);
  await audit(session, "registrar", "presenca", data.id, { presente: input.presente });
  return portalJson(data, 201);
}

async function listRows(session: Session, table: "idosos" | "vinculos" | "pedidos_escola" | "pareamentos" | "encontros", request: Request): Promise<Response> {
  const url = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const pedidoId = url.searchParams.get("pedido_id");
  if (table === "pareamentos" && pedidoId) {
    const { data, error } = await session.client
      .from("pareamentos")
      .select("*")
      .eq("pedido_id", requiredUuid(pedidoId, "pedido_id"))
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) databaseError(error);
    return portalJson(data ?? []);
  }
  const { data, error } = await session.client.from(table).select("*").order("created_at", { ascending: false }).range(offset, offset + limit - 1);
  if (error) databaseError(error);
  return portalJson(data ?? []);
}

async function assignRole(session: Session, userId: string, request: Request): Promise<Response> {
  requireRole(session, "admin");
  requiredUuid(userId, "user_id");
  const input = await readValidatedJson(request, roleAssignmentSchema);
  if ((input.papel === "escola" || input.papel === "coordenacao") && !input.co_entidade) {
    throw new ApiError(422, "ESCOLA_OBRIGATORIA", "Informe co_entidade para vincular o usuário à escola.");
  }
  if (input.co_entidade) assertEscola(input.co_entidade);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error: roleError } = await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role: input.papel }, { onConflict: "user_id,role" });
  if (roleError) databaseError(roleError);
  if (input.co_entidade) {
    const { error: schoolError } = await supabaseAdmin.from("escola_usuarios").upsert({ user_id: userId, co_entidade: input.co_entidade, ativo: true }, { onConflict: "user_id,co_entidade" });
    if (schoolError) databaseError(schoolError);
  }
  await audit(session, "atribuir_papel", "usuario", userId, { papel: input.papel });
  return portalJson({ user_id: userId, papel: input.papel, co_entidade: input.co_entidade ?? null }, 201);
}

export async function handleRedeSaberRequest(request: Request, splat: string): Promise<Response> {
  try {
    const method = request.method;
    const parts = splat.split("/").filter(Boolean);
    if (method === "GET" && parts.length === 1 && parts[0] === "health") return portalJson({ status: "ok", servico: "Rede Saber 60+ API", versao: "1.0.0" });
    if (method === "POST" && splat === "auth/registrar") return await register(request);
    if (method === "POST" && splat === "auth/login") return await login(request);
    if (method === "POST" && splat === "auth/refresh") return await refresh(request);

    const session = await authenticate(request);
    if (method === "GET" && splat === "auth/eu") return portalJson({ user_id: session.userId, papeis: session.roles, perfil: session.profile });
    if (method === "POST" && splat === "cadastros/idosos") return await createIdoso(session, request);
    if (method === "GET" && splat === "idosos") return await listRows(session, "idosos", request);
    if (parts.length === 3 && parts[0] === "idosos" && parts[2] === "perfil") {
      const idosoId = requiredUuid(parts[1] ?? "", "idoso_id");
      if (method === "GET") return portalJson(await findIdoso(session, idosoId));
      if (method === "PUT") return await updatePerfilIdoso(session, idosoId, request);
    }
    if (method === "POST" && splat === "vinculos") return await createVinculo(session, request);
    if (method === "GET" && splat === "vinculos") return await listRows(session, "vinculos", request);
    if (method === "DELETE" && parts.length === 2 && parts[0] === "vinculos") return await revokeVinculo(session, parts[1] ?? "");

    if (parts.length === 3 && parts[0] === "idosos" && parts[2] === "consentimento-saude") {
      const idosoId = requiredUuid(parts[1] ?? "", "idoso_id");
      if (method === "POST") return await saveConsent(session, idosoId, true);
      if (method === "DELETE") return await saveConsent(session, idosoId, false);
      if (method === "GET") {
        await findIdoso(session, idosoId);
        const { data, error } = await session.client.from("consentimentos_saude").select("*").eq("idoso_id", idosoId).maybeSingle();
        if (error) databaseError(error);
        if (!data) throw new ApiError(404, "NAO_ENCONTRADO", "Consentimento não encontrado.");
        return portalJson(consentFhir(data));
      }
    }
    if (parts.length === 3 && parts[0] === "idosos" && parts[2] === "certidao") {
      const idosoId = requiredUuid(parts[1] ?? "", "idoso_id");
      if (method === "POST") return await requestCertificate(session, idosoId);
      if (method === "GET") return await certificateEligibility(session, idosoId);
    }

    if (method === "POST" && splat === "criancas") return await createCrianca(session, request);
    if (method === "POST" && parts.length === 3 && parts[0] === "criancas" && parts[2] === "autorizacoes") return await authorizeCrianca(session, parts[1] ?? "", request);
    if (method === "POST" && splat === "pedidos-escola") return await createPedido(session, request);
    if (method === "GET" && splat === "pedidos-escola") return await listRows(session, "pedidos_escola", request);
    if (method === "POST" && parts.length === 3 && parts[0] === "pedidos-escola" && parts[2] === "aprovacao") return await decidePedido(session, parts[1] ?? "", request);
    if (method === "POST" && splat === "pareamentos") return await suggestMatches(session, request);
    if (method === "GET" && splat === "pareamentos") return await listRows(session, "pareamentos", request);
    if (method === "POST" && parts.length === 3 && parts[0] === "pareamentos" && parts[2] === "aprovacao") return await decideMatch(session, parts[1] ?? "", request);
    if (method === "POST" && splat === "encontros") return await createMeeting(session, request);
    if (method === "GET" && splat === "encontros") return await listRows(session, "encontros", request);
    if (method === "POST" && parts.length === 3 && parts[0] === "encontros" && parts[2] === "presencas") return await registerPresence(session, parts[1] ?? "", request);
    if (method === "GET" && parts.length === 3 && parts[0] === "encontros" && parts[2] === "presencas") {
      const encontroId = requiredUuid(parts[1] ?? "", "encontro_id");
      const { data, error } = await session.client.from("presencas").select("*").eq("encontro_id", encontroId);
      if (error) databaseError(error);
      return portalJson(data ?? []);
    }
    if (method === "POST" && parts.length === 4 && parts[0] === "admin" && parts[1] === "usuarios" && parts[3] === "papeis") return await assignRole(session, parts[2] ?? "", request);
    if (method === "GET" && splat === "auditoria") {
      requireRole(session, "admin");
      const { data, error } = await session.client.from("auditoria").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) databaseError(error);
      return portalJson(data ?? []);
    }
    throw new ApiError(404, "ROTA_NAO_ENCONTRADA", "A rota ou o método solicitado não existe.");
  } catch (error) {
    if (error instanceof ApiError) return portalError(error.codigo, error.message, error.status);
    if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
      console.error("Erro inesperado na API Rede Saber:", error.message);
    }
    return portalError("ERRO_INTERNO", "Não foi possível processar a requisição.", 500);
  }
}
