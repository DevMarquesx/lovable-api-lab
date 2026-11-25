import { createFileRoute } from "@tanstack/react-router";
import {
  estadosGeoJson,
  jsonWithCors,
  optionsCors,
} from "@/lib/observatorio-data";

export const Route = createFileRoute("/api/public/observatorio/estados")({
  server: {
    handlers: {
      OPTIONS: async () => optionsCors(),
      GET: async () => jsonWithCors(estadosGeoJson),
    },
  },
});