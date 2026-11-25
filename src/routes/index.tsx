import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { MapaNorte } from "@/components/MapaNorte";
import {
  NORTE_UFS,
  type EscolaPublica,
  type MunicipioIndicadores,
} from "@/lib/observatorio-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Observatório Rede Saber 60+ — Região Norte" },
      {
        name: "description",
        content: "Indicadores municipais 60+ e escolas da Região Norte alimentados por API REST real.",
      },
      { property: "og:title", content: "Observatório Rede Saber 60+ — Região Norte" },
      {
        property: "og:description",
        content: "Indicadores municipais 60+ e escolas da Região Norte alimentados por API REST real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ObservatorioPage,
});

const fmt = (n: number) => n.toLocaleString("pt-BR");
const fmtPct = (n: number) =>
  `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

function ObservatorioPage() {
  const [uf, setUf] = useState("");
  const [top, setTop] = useState(0);
  const [busca, setBusca] = useState("");
  const [municipios, setMunicipios] = useState<MunicipioIndicadores[]>([]);
  const [escolas, setEscolas] = useState<EscolaPublica[]>([]);
  const [estados, setEstados] = useState<Array<{ geometry?: { type: string; coordinates: unknown }; properties?: Record<string, unknown> }>>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/public/observatorio/estados")
      .then((r) => r.json())
      .then((d: { features?: typeof estados }) => setEstados(d.features ?? []))
      .catch(() => setErro("Falha ao carregar malha de estados da API."));
  }, []);

  useEffect(() => {
    setCarregando(true);
    setErro(null);
    const qsUf = uf ? `?uf=${encodeURIComponent(uf)}` : "";
    Promise.all([
      fetch(`/api/public/observatorio/municipios${qsUf}`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<MunicipioIndicadores[]>;
      }),
      fetch(`/api/public/escolas${qsUf}`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<EscolaPublica[]>;
      }),
    ])
      .then(([muns, escs]) => {
        setMunicipios(muns);
        setEscolas(escs);
      })
      .catch((e: Error) => setErro(`Erro ao consultar a API: ${e.message}`))
      .finally(() => setCarregando(false));
  }, [uf]);

  const munRecorte = useMemo(() => {
    if (!uf || !top) return municipios;
    return [...municipios].sort((a, b) => b.populacao_total - a.populacao_total).slice(0, top);
  }, [municipios, uf, top]);

  const escRecorte = useMemo(() => {
    let lista = escolas;
    if (uf && top) {
      const cods = new Set(munRecorte.map((m) => m.codigo_municipio));
      lista = lista.filter((e) => cods.has(e.codigo_municipio));
    }
    if (busca.trim()) {
      const t = busca.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      lista = lista.filter(
        (e) =>
          e.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(t) ||
          e.municipio.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(t),
      );
    }
    return lista;
  }, [escolas, munRecorte, uf, top, busca]);

  const totais = useMemo(() => {
    const pop = munRecorte.reduce((s, m) => s + m.populacao_total, 0);
    const pop60 = munRecorte.reduce((s, m) => s + m.populacao_60_mais, 0);
    const escTot = munRecorte.reduce((s, m) => s + m.escolas_total, 0);
    const escPub = munRecorte.reduce((s, m) => s + m.escolas_publicas, 0);
    return { pop, pop60, pct60: pop > 0 ? (pop60 / pop) * 100 : 0, escTot, escPub };
  }, [munRecorte]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card px-6 py-5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-primary">
              Observatório Rede Saber 60+ (Região Norte)
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Painel público alimentado em tempo real pela API REST — dados agregados por município e escolas (INEP).
            </p>
          </div>
          <div className="rounded-md border border-border bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">
            API ativa: <code className="font-mono text-foreground">/api/public/observatorio/municipios</code>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-6 py-6">
        {erro && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {erro}
          </div>
        )}

        <section className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            UF
            <select
              value={uf}
              onChange={(e) => {
                setUf(e.target.value);
                if (!e.target.value) setTop(0);
              }}
              className="rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground"
            >
              <option value="">Todas (Norte)</option>
              {NORTE_UFS.map((sigla) => (
                <option key={sigla} value={sigla}>{sigla}</option>
              ))}
            </select>
          </label>

          {uf && (
            <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
              Municípios mais populosos
              <select
                value={top}
                onChange={(e) => setTop(Number(e.target.value))}
                className="rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground"
              >
                <option value={0}>Todos do estado</option>
                <option value={5}>Top 5</option>
                <option value={10}>Top 10</option>
                <option value={20}>Top 20</option>
              </select>
            </label>
          )}

          <div className="ml-auto flex flex-wrap gap-2 text-xs">
            <a href="/api/public/observatorio/municipios" target="_blank" rel="noreferrer" className="rounded-md border border-border bg-card px-3 py-2 font-mono text-primary hover:bg-secondary">
              GET /municipios
            </a>
            <a href="/api/public/escolas?limit=20" target="_blank" rel="noreferrer" className="rounded-md border border-border bg-card px-3 py-2 font-mono text-primary hover:bg-secondary">
              GET /escolas
            </a>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { rot: "Municípios", num: fmt(munRecorte.length) },
            { rot: "População total", num: fmt(totais.pop) },
            { rot: "População 60+", num: fmt(totais.pop60) },
            { rot: "% 60+", num: fmtPct(totais.pct60) },
            { rot: "Escolas totais", num: fmt(totais.escTot) },
            { rot: "Escolas públicas", num: fmt(totais.escPub) },
          ].map((c) => (
            <div key={c.rot} className="rounded-lg border border-border bg-card p-3.5">
              <div className="text-xl font-bold text-primary">{carregando ? "…" : c.num}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{c.rot}</div>
            </div>
          ))}
        </section>

        <MapaNorte estados={estados} escolas={escRecorte} ufSelecionada={uf} />

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-primary">
                Indicadores por município ({fmt(munRecorte.length)})
              </h2>
            </div>
            <div className="max-h-96 overflow-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-muted/90 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Município</th>
                    <th className="px-3 py-2 text-right">Pop. total</th>
                    <th className="px-3 py-2 text-right">60+</th>
                    <th className="px-3 py-2 text-right">% 60+</th>
                    <th className="px-3 py-2 text-right">Escolas</th>
                  </tr>
                </thead>
                <tbody>
                  {munRecorte.map((m) => (
                    <tr key={m.codigo_municipio} className="border-t border-border hover:bg-muted/40">
                      <td className="px-3 py-2 font-medium">{m.municipio}</td>
                      <td className="px-3 py-2 text-right">{fmt(m.populacao_total)}</td>
                      <td className="px-3 py-2 text-right">{fmt(m.populacao_60_mais)}</td>
                      <td className="px-3 py-2 text-right">{fmtPct(m.pct_60_mais)}</td>
                      <td className="px-3 py-2 text-right">{fmt(m.escolas_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
              <h2 className="text-sm font-semibold text-primary">
                Escolas ({fmt(escRecorte.length)})
              </h2>
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar escola ou município…"
                className="w-56 rounded-md border border-input bg-background px-2.5 py-1 text-xs"
              />
            </div>
            <div className="max-h-96 overflow-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-muted/90 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Escola</th>
                    <th className="px-3 py-2">Município</th>
                    <th className="px-3 py-2">Rede</th>
                  </tr>
                </thead>
                <tbody>
                  {escRecorte.slice(0, 200).map((e) => (
                    <tr key={e.co_entidade} className="border-t border-border hover:bg-muted/40">
                      <td className="px-3 py-2 font-medium">{e.nome}</td>
                      <td className="px-3 py-2 text-muted-foreground">{e.municipio} ({e.uf})</td>
                      <td className="px-3 py-2">{e.eh_publica ? "Pública" : "Privada"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {escRecorte.length > 200 && (
                <div className="border-t border-border px-3 py-2 text-center text-xs text-muted-foreground">
                  Exibindo 200 de {fmt(escRecorte.length)} escolas. Use a busca ou filtre por UF.
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
