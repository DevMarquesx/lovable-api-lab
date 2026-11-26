import { describe, expect, it } from "vitest";
import {
  calculateMatchScore,
  checkMeetingProtection,
  is60Plus,
  isCertificateValid,
  isValidCpf,
} from "@/lib/rede-saber/validation";

describe("Validações da Rede Saber 60+", () => {
  it("aceita CPF com dígitos verificadores válidos e rejeita sequências repetidas", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });

  it("permite o cadastro exatamente no aniversário de 60 anos", () => {
    const reference = new Date("2026-11-25T12:00:00Z");
    expect(is60Plus("1966-11-25", reference)).toBe(true);
    expect(is60Plus("1966-11-26", reference)).toBe(false);
  });

  it("aceita somente certidão aprovada e dentro da validade", () => {
    const reference = new Date("2026-11-25T12:00:00Z");
    expect(isCertificateValid({ status: "aprovado", validade: "2026-11-25" }, reference)).toBe(true);
    expect(isCertificateValid({ status: "aprovado", validade: "2026-11-24" }, reference)).toBe(false);
    expect(isCertificateValid({ status: "reprovado", validade: "2027-01-01" }, reference)).toBe(false);
  });

  it("bloqueia encontro sem pareamento aprovado", () => {
    const result = checkMeetingProtection({
      pareamentoStatus: "pendente",
      certidao: { status: "aprovado", validade: "2027-01-01" },
      consentimentoStatus: "active",
      provisionType: "permit",
      autorizacaoAtiva: true,
      referenceDate: new Date("2026-11-25T12:00:00Z"),
    });
    expect(result.liberado).toBe(false);
    expect(result.motivo).toContain("pareamento");
  });

  it("bloqueia encontro sem consentimento ativo", () => {
    const result = checkMeetingProtection({
      pareamentoStatus: "aprovado",
      certidao: { status: "aprovado", validade: "2027-01-01" },
      consentimentoStatus: "inactive",
      provisionType: "deny",
      autorizacaoAtiva: true,
      referenceDate: new Date("2026-11-25T12:00:00Z"),
    });
    expect(result.liberado).toBe(false);
    expect(result.motivo).toContain("consentimento");
  });

  it("bloqueia encontro sem autorização ativa da criança", () => {
    const result = checkMeetingProtection({
      pareamentoStatus: "aprovado",
      certidao: { status: "aprovado", validade: "2027-01-01" },
      consentimentoStatus: "active",
      provisionType: "permit",
      autorizacaoAtiva: false,
      referenceDate: new Date("2026-11-25T12:00:00Z"),
    });
    expect(result.liberado).toBe(false);
    expect(result.motivo).toContain("autorização");
  });

  it("libera encontro somente com todas as proteções válidas", () => {
    const result = checkMeetingProtection({
      pareamentoStatus: "aprovado",
      certidao: { status: "aprovado", validade: "2027-01-01" },
      consentimentoStatus: "active",
      provisionType: "permit",
      autorizacaoAtiva: true,
      referenceDate: new Date("2026-11-25T12:00:00Z"),
    });
    expect(result).toEqual({ liberado: true, motivo: "Todas as regras de proteção foram atendidas." });
  });

  it("pontua tema, período e município compatíveis sem ultrapassar 99", () => {
    expect(calculateMatchScore({ saberes: ["Culinária"], tema: "culinária", horarios: ["manha"], periodo: "manha", mesmoMunicipio: true })).toBe(99);
    expect(calculateMatchScore({ saberes: ["Artesanato"], tema: "Leitura", horarios: ["tarde"], periodo: "manha", mesmoMunicipio: false })).toBe(40);
  });
});
