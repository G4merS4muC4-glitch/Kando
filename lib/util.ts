/** Utilidades pequenas e sem dependencias usadas em toda a aplicacao. */

/** Gera um identificador unico para um novo card ou campanha. */
export function gerarId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback simples caso randomUUID nao esteja disponivel.
  return `id_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/** Momento atual em formato ISO (datetime). */
export function agora(): string {
  return new Date().toISOString();
}

/** Versao bem clara de uma cor hex (mistura com branco), para fundos suaves de marca. */
export function corClara(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return "#F4F5FA";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * 0.88);
  const h = (c: number) => c.toString(16).padStart(2, "0");
  return `#${h(mix(r))}${h(mix(g))}${h(mix(b))}`;
}

/** Converte uma data para o formato yyyy-mm-dd (horario local). */
export function chaveData(d: Date): string {
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

/** Data de hoje no formato yyyy-mm-dd (sem fuso, para comparar com dataPublicacao). */
export function hojeISO(): string {
  return chaveData(new Date());
}

/** Converte uma string yyyy-mm-dd para um Date local (sem deslocamento de fuso). */
export function dataDeISO(iso: string): Date {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return new Date(ano, (mes ?? 1) - 1, dia ?? 1);
}

/**
 * Indica se um card esta com o prazo vencido: tem data de publicacao no passado
 * e ainda nao foi publicado.
 */
export function prazoVencido(
  dataPublicacao: string | undefined,
  etapa: string,
  etapaPostadoId = "publicado"
): boolean {
  if (!dataPublicacao) return false;
  if (etapa === etapaPostadoId) return false; // ja publicado nunca esta vencido
  return dataPublicacao < hojeISO();
}

/** Formata uma data ISO (yyyy-mm-dd) para o padrao brasileiro dd/mm/aaaa. */
export function formatarData(dataISO: string | undefined): string {
  if (!dataISO) return "";
  const partes = dataISO.split("-");
  if (partes.length !== 3) return dataISO;
  const [ano, mes, dia] = partes;
  return `${dia}/${mes}/${ano}`;
}

/** Nomes dos meses em portugues. */
export const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/** Abreviacoes dos dias da semana (domingo a sabado). */
export const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * Gera a grade de um mes para o calendario: sempre 6 semanas (42 dias),
 * comecando no domingo da semana do dia 1. Cada item traz a data e se pertence
 * ao mes em foco.
 */
export interface DiaGrade {
  data: Date;
  chave: string; // yyyy-mm-dd
  noMes: boolean; // pertence ao mes em foco
  hoje: boolean;
}

export function gerarGradeMes(ano: number, mes: number): DiaGrade[] {
  const primeiro = new Date(ano, mes, 1);
  const inicio = new Date(primeiro);
  inicio.setDate(1 - primeiro.getDay()); // recua ate o domingo

  const hoje = hojeISO();
  const dias: DiaGrade[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    const chave = chaveData(d);
    dias.push({
      data: d,
      chave,
      noMes: d.getMonth() === mes,
      hoje: chave === hoje,
    });
  }
  return dias;
}
