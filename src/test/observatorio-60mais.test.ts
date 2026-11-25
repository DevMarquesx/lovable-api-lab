import { describe, expect, it } from "vitest";

import { municipiosData } from "@/lib/observatorio-data";

// O recorte etário do Observatório é 60 anos ou mais (Censo 2022: 60 a 69 + 70 ou mais).
describe("Recorte etário 60+", () => {
  it("traz a contagem de 60+ e nenhuma contagem de 65+", () => {
    const primeira = municipiosData[0];

    expect(primeira).toHaveProperty("populacao_60_mais");
    expect(primeira).toHaveProperty("pct_60_mais");
    expect(primeira).not.toHaveProperty("populacao_65_mais");
    expect(primeira).not.toHaveProperty("pct_65_mais");
  });

  it("usa a população de 60+ de Porto Velho medida no Censo 2022", () => {
    const portoVelho = municipiosData.find((m) => m.codigo_municipio === "1100205");

    expect(portoVelho?.populacao_60_mais).toBe(48769);
    expect(portoVelho?.pct_60_mais).toBe(10.59);
  });

  it("soma 1.797.755 pessoas com 60+ na Região Norte", () => {
    const total = municipiosData.reduce((s, m) => s + m.populacao_60_mais, 0);

    expect(total).toBe(1797755);
  });

  it("mantém o percentual coerente com a população total de cada município", () => {
    for (const m of municipiosData) {
      const esperado = (m.populacao_60_mais / m.populacao_total) * 100;

      expect(Math.abs(m.pct_60_mais - esperado)).toBeLessThanOrEqual(0.01);
    }
  });
});
