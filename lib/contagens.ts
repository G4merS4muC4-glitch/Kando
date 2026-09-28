/**
 * Calculos puros da contagem regressiva (sem estado, faceis de reaproveitar).
 *
 * O quanto falta e SEMPRE a diferenca entre o alvo e o agora (fonte unica de
 * verdade): nada de contador acumulado na aba. Fechar o app, suspender o
 * computador, bloquear o celular ou abrir em outro aparelho nao muda a conta.
 */

import { chaveData } from "./util";

const UMA_HORA_MS = 3_600_000;
const UM_DIA_MS = 86_400_000;

/** Quanto falta, em ms. Negativo quando o prazo ja passou. */
export function restanteMs(alvoISO: string, agoraMs: number): number {
  const alvo = new Date(alvoISO).getTime();
  return Number.isFinite(alvo) ? alvo - agoraMs : 0;
}

export interface PartesTempo {
  dias: number;
  horas: number;
  min: number;
  seg: number;
}

/** Quebra uma duracao em dias, horas, minutos e segundos (o sinal e ignorado). */
export function partesTempo(ms: number): PartesTempo {
  const total = Math.floor(Math.abs(ms) / 1000);
  return {
    dias: Math.floor(total / 86_400),
    horas: Math.floor((total % 86_400) / 3_600),
    min: Math.floor((total % 3_600) / 60),
    seg: total % 60,
  };
}

/**
 * Texto curto: "2d 5h 30min", "5h 30min", "19h", "30min" ou "45s". Unidade
 * zerada nao aparece (nada de "19h 0min"), e sempre sobra ao menos uma.
 */
export function formatarRestante(ms: number): string {
  const { dias, horas, min, seg } = partesTempo(ms);
  if (dias > 0) {
    return [`${dias}d`, horas > 0 ? `${horas}h` : "", min > 0 ? `${min}min` : ""]
      .filter(Boolean)
      .join(" ");
  }
  if (horas > 0) return min > 0 ? `${horas}h ${min}min` : `${horas}h`;
  if (min > 0) return `${min}min`;
  return `${seg}s`;
}

/**
 * Texto por extenso: "2 dias, 5 horas e 30 minutos". Usado na previa do prazo e
 * nos rotulos de leitor de tela (onde o formato curto fica seco).
 */
export function formatarRestanteLongo(ms: number): string {
  const { dias, horas, min, seg } = partesTempo(ms);
  const partes: string[] = [];
  if (dias > 0) partes.push(`${dias} ${dias === 1 ? "dia" : "dias"}`);
  if (horas > 0) partes.push(`${horas} ${horas === 1 ? "hora" : "horas"}`);
  if (min > 0) partes.push(`${min} ${min === 1 ? "minuto" : "minutos"}`);
  if (partes.length === 0) return `${seg} ${seg === 1 ? "segundo" : "segundos"}`;
  if (partes.length === 1) return partes[0];
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

/**
 * Relogio da pilula flutuante: "2d 05:30" enquanto falta mais de um dia e
 * "05:30:12" na reta final (ai os segundos correm na tela). Vencido ganha "-".
 */
export function formatarContagem(ms: number): string {
  const { dias, horas, min, seg } = partesTempo(ms);
  const dois = (n: number) => String(n).padStart(2, "0");
  const sinal = ms < 0 ? "-" : "";
  if (dias > 0) return `${sinal}${dias}d ${dois(horas)}:${dois(min)}`;
  return `${sinal}${dois(horas)}:${dois(min)}:${dois(seg)}`;
}

/** Faixas de urgencia de um prazo (definem a cor e o aviso). */
export type Urgencia = "vencida" | "critica" | "urgente" | "atencao" | "tranquila";

export const URGENCIAS: Record<Urgencia, { rotulo: string; cor: string }> = {
  vencida: { rotulo: "Prazo vencido", cor: "#EC1313" },
  critica: { rotulo: "Menos de 1 hora", cor: "#EC1313" },
  urgente: { rotulo: "Menos de 1 dia", cor: "#FA611E" },
  atencao: { rotulo: "Menos de 3 dias", cor: "#044B8C" },
  tranquila: { rotulo: "No prazo", cor: "#8790AB" },
};

export function urgenciaDe(ms: number): Urgencia {
  if (ms < 0) return "vencida";
  if (ms < UMA_HORA_MS) return "critica";
  if (ms < UM_DIA_MS) return "urgente";
  if (ms < 3 * UM_DIA_MS) return "atencao";
  return "tranquila";
}

/**
 * Quanto do caminho ja passou (0 a 100), de quando a contagem foi criada ate o
 * alvo. E o que enche a barra de progresso conforme o prazo chega.
 */
export function progressoPct(criadoEmISO: string, alvoISO: string, agoraMs: number): number {
  const ini = new Date(criadoEmISO).getTime();
  const fim = new Date(alvoISO).getTime();
  if (!Number.isFinite(ini) || !Number.isFinite(fim) || fim <= ini) return 100;
  const pct = ((agoraMs - ini) / (fim - ini)) * 100;
  return Math.min(100, Math.max(0, pct));
}

/** Data (yyyy-mm-dd) + hora ("HH:MM") vira ISO datetime local. "" se invalido. */
export function combinarDataHora(dataISO: string, hhmm: string): string {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataISO.trim());
  const h = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!d || !h) return "";
  const hora = Number(h[1]);
  const min = Number(h[2]);
  if (hora > 23 || min > 59) return "";
  const alvo = new Date(Number(d[1]), Number(d[2]) - 1, Number(d[3]), hora, min, 0, 0);
  return Number.isNaN(alvo.getTime()) ? "" : alvo.toISOString();
}

/** ISO vira { data: "yyyy-mm-dd", hora: "HH:MM" } no horario local (para editar). */
export function separarDataHora(iso: string): { data: string; hora: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { data: "", hora: "" };
  const dois = (n: number) => String(n).padStart(2, "0");
  return {
    data: chaveData(d),
    hora: `${dois(d.getHours())}:${dois(d.getMinutes())}`,
  };
}

/** Alvo daqui a X horas (aceita fracao: 0,5 = 30min), a partir de uma base. */
export function alvoDaquiHoras(horas: number, baseMs: number): string {
  return new Date(baseMs + horas * UMA_HORA_MS).toISOString();
}

/**
 * Rotulo do prazo em linguagem do dia a dia: "hoje às 18:00", "amanhã às 09:00",
 * "ontem às 14:30" ou "12/09 às 18:00" (com o ano quando cai em outro ano).
 */
export function rotuloAlvo(alvoISO: string, agoraMs: number): string {
  const d = new Date(alvoISO);
  if (Number.isNaN(d.getTime())) return "";
  const dois = (n: number) => String(n).padStart(2, "0");
  const hora = `${dois(d.getHours())}:${dois(d.getMinutes())}`;
  const hoje = new Date(agoraMs);
  const dia = (delta: number) =>
    chaveData(new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + delta));
  const alvoDia = chaveData(d);
  if (alvoDia === dia(0)) return `hoje às ${hora}`;
  if (alvoDia === dia(1)) return `amanhã às ${hora}`;
  if (alvoDia === dia(-1)) return `ontem às ${hora}`;
  const ano = d.getFullYear() !== hoje.getFullYear() ? `/${d.getFullYear()}` : "";
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}${ano} às ${hora}`;
}

/** Ordena pelo prazo: o mais proximo primeiro (os vencidos vem no topo). */
export function ordenarContagens<T extends { alvo: string }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => new Date(a.alvo).getTime() - new Date(b.alvo).getTime());
}
