import { useEffect, useRef, useState } from "react";
import type { EscolaPublica } from "@/lib/observatorio-data";

const UF_POR_CODIGO: Record<number, string> = {
  11: "RO", 12: "AC", 13: "AM", 14: "RR", 15: "PA", 16: "AP", 17: "TO",
  21: "MA", 22: "PI", 23: "CE", 24: "RN", 25: "PB", 26: "PE", 27: "AL",
  28: "SE", 29: "BA", 31: "MG", 32: "ES", 33: "RJ", 35: "SP", 41: "PR",
  42: "SC", 43: "RS", 50: "MS", 51: "MT", 52: "GO", 53: "DF",
};
const SIGLAS = new Set(Object.values(UF_POR_CODIGO));
const NORTE = new Set(["RO", "AC", "AM", "RR", "PA", "AP", "TO"]);

interface GeoFeature {
  geometry?: { type: string; coordinates: unknown };
  properties?: Record<string, unknown>;
}

interface MapaNorteProps {
  estados: GeoFeature[];
  escolas: EscolaPublica[];
  ufSelecionada: string;
}

function siglaDoEstado(f: GeoFeature): string | null {
  const p = f.properties ?? {};
  for (const v of Object.values(p)) {
    if (typeof v === "string" && SIGLAS.has(v.trim().toUpperCase())) {
      return v.trim().toUpperCase();
    }
  }
  for (const v of Object.values(p)) {
    const sigla = UF_POR_CODIGO[Number(v)];
    if (sigla) return sigla;
  }
  return null;
}

function extensaoGeo(lista: GeoFeature[]) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const varrer = (c: unknown) => {
    if (!Array.isArray(c) || c.length === 0) return;
    if (typeof c[0] === "number" && typeof c[1] === "number") {
      if (c[0] < minX) minX = c[0];
      if (c[0] > maxX) maxX = c[0];
      if (c[1] < minY) minY = c[1];
      if (c[1] > maxY) maxY = c[1];
    } else {
      for (const item of c) varrer(item);
    }
  };
  for (const f of lista) if (f.geometry) varrer(f.geometry.coordinates);
  return Number.isFinite(minX) ? { minX, maxX, minY, maxY } : null;
}

export function MapaNorte({ estados, escolas, ufSelecionada }: MapaNorteProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pontosRef = useRef<Array<{ x: number; y: number; escola: EscolaPublica }>>([]);
  const [dica, setDica] = useState<{ x: number; y: number; escola: EscolaPublica } | null>(null);

  useEffect(() => {
    const draw = () => {
      const wrap = wrapRef.current;
      const canvas = canvasRef.current;
      if (!wrap || !canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const W = wrap.clientWidth || 760;
      const H = 480;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const comSigla = estados
        .map((f) => ({ f, sigla: siglaDoEstado(f) }))
        .filter((x): x is { f: GeoFeature; sigla: string } => Boolean(x.sigla));

      const foco = ufSelecionada
        ? comSigla.filter((x) => x.sigla === ufSelecionada)
        : comSigla.filter((x) => NORTE.has(x.sigla));

      const ext = extensaoGeo(foco.map((x) => x.f));
      if (!ext) return;

      const pad = 24;
      const escala = Math.min(
        (W - pad * 2) / Math.max(ext.maxX - ext.minX, 0.1),
        (H - pad * 2) / Math.max(ext.maxY - ext.minY, 0.1),
      );
      const offX = (W - (ext.maxX - ext.minX) * escala) / 2;
      const offY = (H - (ext.maxY - ext.minY) * escala) / 2;
      const px = (lon: number) => offX + (lon - ext.minX) * escala;
      const py = (lat: number) => offY + (ext.maxY - lat) * escala;

      const desenharPoligonos = (geom: { type: string; coordinates: unknown }) => {
        const polys =
          geom.type === "Polygon"
            ? [geom.coordinates as number[][][]]
            : geom.type === "MultiPolygon"
              ? (geom.coordinates as number[][][][])
              : [];
        for (const anel of polys) {
          for (const ring of anel) {
            const first = ring[0];
            if (!first) continue;
            ctx.moveTo(px(first[0] ?? 0), py(first[1] ?? 0));
            for (let i = 1; i < ring.length; i++) {
              const pt = ring[i];
              if (pt) ctx.lineTo(px(pt[0] ?? 0), py(pt[1] ?? 0));
            }
            ctx.closePath();
          }
        }
      };

      for (const item of comSigla) {
        if (!item.f.geometry) continue;
        const destaque = ufSelecionada ? item.sigla === ufSelecionada : NORTE.has(item.sigla);
        ctx.beginPath();
        desenharPoligonos(item.f.geometry);
        ctx.fillStyle = destaque ? "#e8eff8" : "#f1f5f9";
        ctx.fill();
        ctx.strokeStyle = destaque ? "#2f5496" : "#cbd5e1";
        ctx.lineWidth = destaque ? 1.4 : 0.7;
        ctx.stroke();
      }

      const pontos: Array<{ x: number; y: number; escola: EscolaPublica }> = [];
      for (const esc of escolas) {
        if (esc.lat === null || esc.lon === null) continue;
        const x = px(esc.lon);
        const y = py(esc.lat);
        if (x < -10 || x > W + 10 || y < -10 || y > H + 10) continue;
        ctx.beginPath();
        ctx.arc(x, y, ufSelecionada ? 3.2 : 2.1, 0, Math.PI * 2);
        ctx.fillStyle = esc.eh_publica ? "rgba(47, 84, 150, 0.72)" : "rgba(217, 119, 6, 0.72)";
        ctx.fill();
        pontos.push({ x, y, escola: esc });
      }
      pontosRef.current = pontos;
    };

    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [estados, escolas, ufSelecionada]);

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let melhor: { x: number; y: number; escola: EscolaPublica } | null = null;
    let menorDist = 100;
    for (const p of pontosRef.current) {
      const d = (p.x - mx) ** 2 + (p.y - my) ** 2;
      if (d < menorDist) {
        menorDist = d;
        melhor = p;
      }
    }
    setDica(melhor);
  };

  return (
    <div ref={wrapRef} className="relative overflow-hidden rounded-lg border border-border bg-muted/50">
      <canvas ref={canvasRef} onMouseMove={handleMove} onMouseLeave={() => setDica(null)} className="block w-full" />
      <div className="flex flex-wrap items-center gap-4 border-t border-border bg-card px-4 py-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full bg-primary" /> Escolas públicas
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full bg-chart-1" /> Escolas privadas
        </span>
        <span className="ml-auto">{escolas.length.toLocaleString("pt-BR")} escolas no recorte</span>
      </div>
      {dica && (
        <div
          className="pointer-events-none absolute z-10 max-w-64 rounded-md bg-foreground px-2.5 py-1.5 text-xs text-background shadow-md"
          style={{ left: Math.min(dica.x + 12, 520), top: Math.max(dica.y - 12, 8) }}
        >
          <div className="font-semibold">{dica.escola.nome}</div>
          <div className="opacity-85">
            {dica.escola.municipio} ({dica.escola.uf}) • {dica.escola.eh_publica ? "Pública" : "Privada"}
          </div>
        </div>
      )}
    </div>
  );
}