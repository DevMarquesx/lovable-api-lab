import municipiosRaw from "@/data/municipios.json";
import escolasRaw from "@/data/escolas.json";
import estadosRaw from "@/data/estados.json";

export const NORTE_UFS = ["RO", "AC", "AM", "RR", "PA", "AP", "TO"] as const;
export type NorteUf = (typeof NORTE_UFS)[number];

export interface MunicipioIndicadores {
  codigo_municipio: string;
  municipio: string;
  uf: string;
  populacao_total: number;
  populacao_60_mais: number;
  pct_60_mais: number;
  escolas_total: number;
  escolas_publicas: number;
  escolas_privadas: number;
  escolas_coord_exata: number;
}

export interface EscolaPublica {
  co_entidade: string;
  nome: string;
  codigo_municipio: string;
  municipio: string;
  uf: string;
  eh_publica: boolean;
  lat: number | null;
  lon: number | null;
  precisao: "exata_osm" | "aproximada_municipio";
}

type EscolaTuple = [
  string,
  string,
  string,
  string,
  string,
  number,
  number | null,
  number | null,
  number,
];

export const municipiosData = municipiosRaw as MunicipioIndicadores[];
const escolasTuples = escolasRaw as EscolaTuple[];
export const estadosGeoJson = estadosRaw;

let decodedEscolas: EscolaPublica[] | null = null;

export function getEscolas(): EscolaPublica[] {
  if (!decodedEscolas) {
    decodedEscolas = escolasTuples.map((row) => ({
      co_entidade: row[0],
      nome: row[1],
      codigo_municipio: row[2],
      municipio: row[3],
      uf: row[4],
      eh_publica: row[5] === 1,
      lat: row[6],
      lon: row[7],
      precisao: row[8] === 1 ? "exata_osm" : "aproximada_municipio",
    }));
  }
  return decodedEscolas;
}

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export function jsonWithCors(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: CORS_HEADERS });
}

export function optionsCors(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}