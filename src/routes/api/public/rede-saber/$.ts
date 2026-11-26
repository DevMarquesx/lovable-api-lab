import { createFileRoute } from "@tanstack/react-router";
import { handleRedeSaberRequest } from "@/lib/rede-saber/api.server";
import { portalOptions } from "@/lib/rede-saber/http";

export const Route = createFileRoute("/api/public/rede-saber/$")({
  server: {
    handlers: {
      OPTIONS: async () => portalOptions(),
      GET: async ({ request, params }) => handleRedeSaberRequest(request, params._splat ?? ""),
      POST: async ({ request, params }) => handleRedeSaberRequest(request, params._splat ?? ""),
      PUT: async ({ request, params }) => handleRedeSaberRequest(request, params._splat ?? ""),
      DELETE: async ({ request, params }) => handleRedeSaberRequest(request, params._splat ?? ""),
    },
  },
});
