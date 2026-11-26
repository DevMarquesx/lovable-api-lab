import { z } from "zod";

export const PORTAL_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
};

export function portalJson(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: PORTAL_CORS_HEADERS });
}

export function portalError(codigo: string, motivo: string, status: number): Response {
  return portalJson({ codigo, motivo }, status);
}

export function portalOptions(): Response {
  return new Response(null, { status: 204, headers: PORTAL_CORS_HEADERS });
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    message: string,
  ) {
    super(message);
  }
}

export async function readValidatedJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, "JSON_INVALIDO", "Envie um corpo JSON válido.");
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join(".");
    throw new ApiError(422, "DADOS_INVALIDOS", `${path ? `${path}: ` : ""}${issue?.message ?? "Dados inválidos."}`);
  }
  return result.data;
}

export function requiredUuid(value: string, field = "id"): string {
  const result = z.string().uuid().safeParse(value);
  if (!result.success) throw new ApiError(422, "ID_INVALIDO", `${field} deve ser um UUID válido.`);
  return result.data;
}
