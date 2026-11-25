import { createFileRoute } from "@tanstack/react-router";
import {
  NORTE_UFS,
  municipiosData,
  jsonWithCors,
  optionsCors,
  type NorteUf,
} from "@/lib/observatorio-data";

export const Route = createFileRoute("/api/public/observatorio/municipios")({
  server: {
    handlers: {
      OPTIONS: async () => optionsCors(),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const ufParam = url.searchParams.get("uf")?.trim().toUpperCase();

        if (ufParam && !NORTE_UFS.includes(ufParam as NorteUf)) {
          return jsonWithCors(
            {
              codigo: "UF_INVALIDA",
              motivo: `UF inválida. Use uma das siglas do Norte: ${NORTE_UFS.join(", ")}.`,
            },
            422,
          );
        }

        const lista = ufParam
          ? municipiosData.filter((m) => m.uf === ufParam)
          : municipiosData;

        return jsonWithCors(lista);
      },
    },
  },
});