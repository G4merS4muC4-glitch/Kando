/**
 * Calculos puros do apontamento de horas (sem estado, faceis de reaproveitar).
 *
 * A duracao de um registro e SEMPRE a diferenca entre fim e inicio. O dia de um
 * registro e o dia local do seu inicio (intervalos que viram a noite contam no
 * dia de inicio; o caso raro de timer esquecido e mitigado pelo aviso ao parar).
 */

import type { Checkpoint, RegistroTempo } from "./types";
import { chaveData } from "./util";

const UMA_HORA_MS = 3_600_000;

/** Duracao trabalhada do registro em ms (intervalo menos as pausas, nunca negativa). */
export function duracaoMs(reg: { inicio: string; fim: string; pausaMs?: number }): number {
  const ms = new Date(reg.fim).getTime() - new Date(reg.inicio).getTime() - (reg.pausaMs ?? 0);
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

/** Duracao corrida de um timer (inicio ate agora), em milissegundos. */
export function corridoMs(inicioISO: string, agoraMs: number): number {
  const ms = agoraMs - new Date(inicioISO).getTime();
  return Number.isFinite(ms) && ms > 0 ? ms : 0;
}

/**
 * Tempo efetivamente trabalhado de um timer em andamento: o corrido menos as
 * pausas ja concluidas e a pausa em aberto (quando pausado, o numero congela).
 */
export function tempoTrabalhadoMs(
  timer: { inicio: string; pausaMs?: number; pausadoEm?: string },
  agoraMs: number
): number {
  const emPausa = timer.pausadoEm ? Math.max(0, agoraMs - new Date(timer.pausadoEm).getTime()) : 0;
  const liquido = corridoMs(timer.inicio, agoraMs) - (timer.pausaMs ?? 0) - emPausa;
  return liquido > 0 ? liquido : 0;
}

/** Em horas (numero), util para somar e plotar nos graficos. */
export function emHoras(ms: number): number {
  return ms / UMA_HORA_MS;
}

/** Texto curto e amigavel: "1h 23min", "45min", "12s". */
export function formatarDuracao(ms: number): string {
  if (ms < 1000) return "0min";
  const totalSeg = Math.round(ms / 1000);
  const h = Math.floor(totalSeg / 3600);
  const min = Math.floor((totalSeg % 3600) / 60);
  if (h > 0) return min > 0 ? `${h}h ${min}min` : `${h}h`;
  if (min > 0) return `${min}min`;
  return `${totalSeg}s`;
}

/** Relogio do timer rodando: "1:23:45" (com horas) ou "12:30" (so min:seg). */
export function formatarRelogio(ms: number): string {
  const totalSeg = Math.floor(ms / 1000);
  const h = Math.floor(totalSeg / 3600);
  const m = Math.floor((totalSeg % 3600) / 60);
  const s = totalSeg % 60;
  const dois = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${dois(m)}:${dois(s)}` : `${m}:${dois(s)}`;
}

/** Horas com no maximo 1 casa (ex.: "2,5 h"), para rotulos e tooltips. */
export function horasLabel(ms: number): string {
  const h = emHoras(ms);
  const txt = h >= 10 ? h.toFixed(0) : h.toFixed(1);
  return `${txt.replace(".", ",")} h`;
}

/** Dia local (yyyy-mm-dd) a que o registro pertence (pelo inicio). */
export function diaDoRegistro(reg: { inicio: string }): string {
  return chaveData(new Date(reg.inicio));
}

/** Hora local no formato HH:MM. */
export function horaLocal(iso: string): string {
  const d = new Date(iso);
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

/**
 * Ordena os checkpoints e calcula quanto durou cada etapa (do marcador ate o
 * proximo, ou ate o fim do intervalo para o ultimo). Usado na linha do tempo.
 */
export function checkpointsComDuracao(
  checkpoints: Checkpoint[] | undefined,
  fimISO: string
): { id: string; em: string; texto: string; ateMs: number; ehPausa: boolean }[] {
  if (!checkpoints || checkpoints.length === 0) return [];
  const ordenados = [...checkpoints].sort(
    (a, b) => new Date(a.em).getTime() - new Date(b.em).getTime()
  );
  const fimMs = new Date(fimISO).getTime();
  // Janelas pausadas (inicio do marcador de pausa ate inicio + duracao), para
  // descontar de cada trecho de trabalho e nao inflar o marcador que as contem.
  const pausas = ordenados
    .filter((c) => c.pausaMs && c.pausaMs > 0)
    .map((c) => {
      const s = new Date(c.em).getTime();
      return [s, s + (c.pausaMs as number)] as const;
    });
  const sobreposicao = (ini: number, fim: number) => {
    let t = 0;
    for (const [pIni, pFim] of pausas) {
      const lo = Math.max(ini, pIni);
      const hi = Math.min(fim, pFim);
      if (hi > lo) t += hi - lo;
    }
    return t;
  };
  return ordenados.map((cp, i) => {
    const ini = new Date(cp.em).getTime();
    const prox = i + 1 < ordenados.length ? new Date(ordenados[i + 1].em).getTime() : fimMs;
    // Marcador de pausa: a duracao e a propria pausa (nao e trabalho).
    if (cp.pausaMs && cp.pausaMs > 0) {
      return { id: cp.id, em: cp.em, texto: cp.texto, ateMs: cp.pausaMs, ehPausa: true };
    }
    const bruto = Number.isFinite(prox) && prox > ini ? prox - ini : 0;
    const ateMs = Math.max(0, bruto - sobreposicao(ini, prox));
    return { id: cp.id, em: cp.em, texto: cp.texto, ateMs, ehPausa: false };
  });
}

/** ISO -> valor de <input type="datetime-local"> (horario local). */
export function paraInputLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

/** Valor de <input type="datetime-local"> -> ISO (ou "" se invalido). */
export function deInputLocal(valor: string): string {
  if (!valor) return "";
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

/** Soma de milissegundos por dia (yyyy-mm-dd -> ms). */
export function totalPorDia(registros: RegistroTempo[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const r of registros) {
    const dia = diaDoRegistro(r);
    mapa.set(dia, (mapa.get(dia) ?? 0) + duracaoMs(r));
  }
  return mapa;
}

/** Soma de milissegundos por card (cardId -> ms). */
export function totalPorCard(registros: RegistroTempo[]): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const r of registros) {
    mapa.set(r.cardId, (mapa.get(r.cardId) ?? 0) + duracaoMs(r));
  }
  return mapa;
}

/** Soma de milissegundos por pessoa (autorId -> nome e total). */
export function totalPorAutor(
  registros: RegistroTempo[]
): { autorId: string; nome: string; ms: number }[] {
  const mapa = new Map<string, { nome: string; ms: number }>();
  for (const r of registros) {
    const atual = mapa.get(r.autorId) ?? { nome: r.autorNome || "Sem nome", ms: 0 };
    atual.ms += duracaoMs(r);
    atual.nome = r.autorNome || atual.nome;
    mapa.set(r.autorId, atual);
  }
  return Array.from(mapa.entries())
    .map(([autorId, v]) => ({ autorId, nome: v.nome, ms: v.ms }))
    .sort((a, b) => b.ms - a.ms);
}

/** Soma de milissegundos cujos dias caem no intervalo [deISO, ateISO] (inclusive). */
export function msNoIntervalo(registros: RegistroTempo[], deISO: string, ateISO: string): number {
  let total = 0;
  for (const r of registros) {
    const dia = diaDoRegistro(r);
    if (dia >= deISO && dia <= ateISO) total += duracaoMs(r);
  }
  return total;
}

/** Domingo da semana de uma data (a grade do calendario tambem comeca no domingo). */
export function inicioDaSemana(d: Date): Date {
  const ini = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  ini.setDate(ini.getDate() - ini.getDay());
  return ini;
}

/** KPIs do periodo (referencia = hoje), em milissegundos. */
export interface KpisHoras {
  hojeMs: number;
  semanaMs: number;
  mesMs: number;
  mesAnteriorMs: number;
  variacaoMesPct: number | null; // mes atual vs anterior
}

export function calcularKpis(registros: RegistroTempo[], referencia: Date): KpisHoras {
  const hoje = chaveData(referencia);

  const ini = inicioDaSemana(referencia);
  const fimSemana = new Date(ini);
  fimSemana.setDate(ini.getDate() + 6);
  const semanaMs = msNoIntervalo(registros, chaveData(ini), chaveData(fimSemana));

  const ano = referencia.getFullYear();
  const mes = referencia.getMonth();
  const mesDe = chaveData(new Date(ano, mes, 1));
  const mesAte = chaveData(new Date(ano, mes + 1, 0));
  const mesMs = msNoIntervalo(registros, mesDe, mesAte);

  const antDe = chaveData(new Date(ano, mes - 1, 1));
  const antAte = chaveData(new Date(ano, mes, 0));
  const mesAnteriorMs = msNoIntervalo(registros, antDe, antAte);

  const variacaoMesPct =
    mesAnteriorMs > 0 ? ((mesMs - mesAnteriorMs) / mesAnteriorMs) * 100 : null;

  return {
    hojeMs: msNoIntervalo(registros, hoje, hoje),
    semanaMs,
    mesMs,
    mesAnteriorMs,
    variacaoMesPct,
  };
}

/** Filtra os registros de um mes (ano, mes 0-11). */
export function registrosDoMes(
  registros: RegistroTempo[],
  ano: number,
  mes: number
): RegistroTempo[] {
  const de = chaveData(new Date(ano, mes, 1));
  const ate = chaveData(new Date(ano, mes + 1, 0));
  return registros.filter((r) => {
    const dia = diaDoRegistro(r);
    return dia >= de && dia <= ate;
  });
}
