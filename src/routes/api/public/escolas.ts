import { createFileRoute } from "@tanstack/react-router";
import {
  NORTE_UFS,
  getEscolas,
  jsonWithCors,
  optionsCors,
  type NorteUf,
} from "@/lib/observatorio-data";

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export const Route = createFileRoute("/api/public/escolas")({
  server: {
    handlers: {
      OPTIONS: async () => optionsCors(),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const codigoMunicipio = url.searchParams.get("codigo_municipio")?.trim();
        const ufParam = url.searchParams.get("uf")?.trim().toUpperCase();
        const q = url.searchParams.get("q")?.trim();
        const limitParam = url.searchParams.get("limit");
        const offsetParam = url.searchParams.get("offset");

        if (codigoMunicipio && !/^[0-9]{7}$/.test(codigoMunicipio)) {
          return jsonWithCors(
            {
              codigo: "CODIGO_INVALIDO",
              motivo: "codigo_municipio deve conter 7 dígitos numéricos (IBGE).",
            },
            422,
          );
        }

        if (ufParam && !NORTE_UFS.includes(ufParam as NorteUf)) {
          return jsonWithCors(
            {
              codigo: "UF_INVALIDA",
              motivo: `UF inválida. Use: ${NORTE_UFS.join(", ")}.`,
            },
            422,
          );
        }

        let lista = getEscolas();
        if (codigoMunicipio) {
          lista = lista.filter((e) => e.codigo_municipio === codigoMunicipio);
        }
        if (ufParam) {
          lista = lista.filter((e) => e.uf === ufParam);
        }
        if (q) {
          const termo = normalize(q);
          lista = lista.filter(
            (e) =>
              normalize(e.nome).includes(termo) ||
              normalize(e.municipio).includes(termo),
          );
        }

        const offset = Math.max(0, Number.parseInt(offsetParam ?? "0", 10) || 0);
        const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : 0;
        if (parsedLimit > 0) {
          lista = lista.slice(offset, offset + Math.min(parsedLimit, 5000));
        } else if (offset > 0) {
          lista = lista.slice(offset);
        }

        return jsonWithCors(lista);
      },
    },
  },
});