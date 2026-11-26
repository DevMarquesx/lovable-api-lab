export function normalizeCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

export function isValidCpf(cpf: string): boolean {
  const digits = normalizeCpf(cpf);
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;

  const calculateDigit = (length: number) => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return calculateDigit(9) === Number(digits[9]) && calculateDigit(10) === Number(digits[10]);
}

export function is60Plus(birthDate: string, referenceDate = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return false;
  const birth = new Date(`${birthDate}T00:00:00.000Z`);
  if (Number.isNaN(birth.getTime()) || birth.toISOString().slice(0, 10) !== birthDate) return false;

  let age = referenceDate.getUTCFullYear() - birth.getUTCFullYear();
  const monthDelta = referenceDate.getUTCMonth() - birth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && referenceDate.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age >= 60;
}

export interface CertidaoElegibilidade {
  status: string;
  validade: string | null;
}

export function isCertificateValid(certidao: CertidaoElegibilidade | null, referenceDate = new Date()): boolean {
  if (!certidao || certidao.status !== "aprovado" || !certidao.validade) return false;
  return certidao.validade >= referenceDate.toISOString().slice(0, 10);
}

export interface MeetingProtectionInput {
  pareamentoStatus: string;
  certidao: CertidaoElegibilidade | null;
  consentimentoStatus: string | null;
  provisionType: string | null;
  autorizacaoAtiva: boolean;
  referenceDate?: Date;
}

export function checkMeetingProtection(input: MeetingProtectionInput): { liberado: boolean; motivo: string } {
  if (input.pareamentoStatus !== "aprovado") {
    return { liberado: false, motivo: "O pareamento precisa estar aprovado." };
  }
  if (!isCertificateValid(input.certidao, input.referenceDate)) {
    return { liberado: false, motivo: "A certidão precisa estar aprovada e dentro da validade." };
  }
  if (input.consentimentoStatus !== "active" || input.provisionType !== "permit") {
    return { liberado: false, motivo: "O consentimento de saúde precisa estar ativo." };
  }
  if (!input.autorizacaoAtiva) {
    return { liberado: false, motivo: "A criança precisa de autorização ativa do responsável legal." };
  }
  return { liberado: true, motivo: "Todas as regras de proteção foram atendidas." };
}

export function calculateMatchScore(input: {
  saberes: string[];
  tema: string;
  horarios: string[];
  periodo: string;
  mesmoMunicipio: boolean;
}): number {
  const normalize = (value: string) =>
    value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const tema = normalize(input.tema);
  const temaCombina = input.saberes.some((saber) => {
    const normalizado = normalize(saber);
    return tema.includes(normalizado) || normalizado.includes(tema);
  });
  const periodoCombina = input.horarios.includes(input.periodo);
  return Math.min(99, 40 + (temaCombina ? 30 : 0) + (periodoCombina ? 20 : 0) + (input.mesmoMunicipio ? 10 : 0));
}
