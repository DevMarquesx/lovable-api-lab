import { createFileRoute } from "@tanstack/react-router";
import {
  municipiosData,
  jsonWithCors,
  optionsCors,
} from "@/lib/observatorio-data";

export const Route = createFileRoute(
  "/api/public/observatorio/municipios/$codigo_municipio",
)({
  server: {
    handlers: {
      OPTIONS: async () => optionsCors(),
      GET: async ({ params }) => {
        const codigo = params.codigo_municipio.trim();
        if (!/^[0-9]{7}$/.test(codigo)) {
          return jsonWithCors(
            {
              codigo: "CODIGO_INVALIDO",
              motivo: "codigo_municipio deve conter exatamente 7 dígitos numéricos (IBGE).",
            },
            422,
          );
        }

        const encontrado = municipiosData.find(
          (m) => m.codigo_municipio === codigo,
        );
        if (!encontrado) {
          return jsonWithCors(
            {
              codigo: "NAO_ENCONTRADO",
              motivo: `Município ${codigo} não encontrado na base da Região Norte.`,
            },
            404,
          );
        }

        return jsonWithCors(encontrado);
      },
    },
  },
});