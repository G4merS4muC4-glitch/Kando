/**
 * Camada de dados do apontamento de horas, isolada (mesmo padrao de
 * lib/metricasStorage.ts).
 *
 * - Registros (intervalos concluidos): documento compartilhado pelo time.
 *   - Sem Supabase: localStorage (chave unica).
 *   - Com Supabase: uma linha propria na tabela boards, id "apontamentos"
 *     (reaproveita a tabela e o RLS; nao mexe no quadro principal). Nao precisa
 *     de SQL novo.
 * - Timer ativo: localStorage por aparelho (fora da memoria da aba), para
 *   sobreviver a fechar a aba, suspender o PC ou bloquear o celular.
 */

import type { ApontamentosDoc, RegistroTempo, TimerAtivo } from "./types";
import { criarClienteNavegador, supabaseConfigurado } from "./supabase/client";

const idLinha = (orgId: string) => `apontamentos:${orgId}`; // linha por organizacao
const CHAVE_REGISTROS = "kando:apontamentos"; // fallback localStorage
const chaveTimer = (orgId: string) => `kando:timer-ativo:${orgId}`; // timer por aparelho e org

function temLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function registrosValidos(dados: unknown): dados is ApontamentosDoc {
  const d = dados as ApontamentosDoc | null;
  return Boolean(d && Array.isArray(d.registros));
}

// ----- Registros -----

function lerRegistrosLocal(): RegistroTempo[] {
  if (!temLocalStorage()) return [];
  try {
    const bruto = window.localStorage.getItem(CHAVE_REGISTROS);
    if (!bruto) return [];
    const dados = JSON.parse(bruto) as ApontamentosDoc;
    return registrosValidos(dados) ? dados.registros : [];
  } catch {
    return [];
  }
}

function salvarRegistrosLocal(registros: RegistroTempo[]): void {
  if (!temLocalStorage()) return;
  try {
    window.localStorage.setItem(CHAVE_REGISTROS, JSON.stringify({ registros }));
  } catch {
    // Sem espaco ou bloqueado: ignora.
  }
}

/** Le os registros salvos da organizacao (documento compartilhado ou localStorage). */
export async function getApontamentos(orgId: string): Promise<RegistroTempo[]> {
  if (!supabaseConfigurado()) return lerRegistrosLocal();
  try {
    const sb = criarClienteNavegador();
    const { data, error } = await sb
      .from("boards")
      .select("dados")
      .eq("id", idLinha(orgId))
      .maybeSingle();
    if (error) throw error;
    return registrosValidos(data?.dados) ? (data!.dados as ApontamentosDoc).registros : [];
  } catch {
    return lerRegistrosLocal();
  }
}

/** Salva todos os registros da organizacao (documento compartilhado ou localStorage). */
export async function salvarApontamentos(orgId: string, registros: RegistroTempo[]): Promise<void> {
  if (!supabaseConfigurado()) {
    salvarRegistrosLocal(registros);
    return;
  }
  try {
    const sb = criarClienteNavegador();
    await sb.from("boards").upsert({
      id: idLinha(orgId),
      dados: { registros } satisfies ApontamentosDoc,
      cliente_id: "apontamentos",
      org_id: orgId,
      atualizado_em: new Date().toISOString(),
    });
  } catch {
    salvarRegistrosLocal(registros);
  }
}

/**
 * Assina mudancas dos registros da organizacao em tempo real (so no Supabase).
 * Canal e filtro por organizacao. No evento, RE-LE a lista do banco (nao confia
 * no payload, que pode vir cortado se crescer muito) e entrega para o assinante.
 * Devolve uma funcao para cancelar.
 */
export function assinarApontamentos(
  orgId: string,
  aoMudar: (registros: RegistroTempo[]) => void
): (() => void) | undefined {
  if (!supabaseConfigurado()) return undefined;
  const sb = criarClienteNavegador();
  const id = idLinha(orgId);
  const canal = sb
    .channel(`boards-${id}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "boards", filter: `id=eq.${id}` },
      () => {
        void getApontamentos(orgId).then(aoMudar);
      }
    )
    .subscribe();
  return () => {
    void sb.removeChannel(canal);
  };
}

// ----- Timer ativo (por aparelho e por organizacao) -----

/** Le o timer em andamento guardado neste aparelho para a organizacao (ou null). */
export function lerTimerLocal(orgId: string): TimerAtivo | null {
  if (!temLocalStorage()) return null;
  try {
    const bruto = window.localStorage.getItem(chaveTimer(orgId));
    if (!bruto) return null;
    const t = JSON.parse(bruto) as TimerAtivo;
    return t && typeof t.cardId === "string" && typeof t.inicio === "string" ? t : null;
  } catch {
    return null;
  }
}

/** Guarda o timer em andamento neste aparelho para a organizacao. */
export function salvarTimerLocal(orgId: string, timer: TimerAtivo): void {
  if (!temLocalStorage()) return;
  try {
    window.localStorage.setItem(chaveTimer(orgId), JSON.stringify(timer));
  } catch {
    // ignora
  }
}

/** Remove o timer em andamento deste aparelho para a organizacao. */
export function limparTimerLocal(orgId: string): void {
  if (!temLocalStorage()) return;
  try {
    window.localStorage.removeItem(chaveTimer(orgId));
  } catch {
    // ignora
  }
}

// ----- Timers ativos COMPARTILHADOS (equipe, em tempo real) -----
// Espelham o timer em andamento numa tabela por organizacao (supabase/timers.sql),
// para os colegas acompanharem quem esta trabalhando em que, ao vivo. So no modo
// Supabase; no modo local nao ha equipe e estas funcoes viram no-op.

const TABELA_TIMERS = "timers_ativos";
// Sem batimento por este tempo, o timer e considerado "fantasma" (aparelho do dono
// fechou/caiu sem parar) e some da visao da equipe. O provider bate a cada 60s.
const TIMER_FANTASMA_MS = 3 * 60_000;

/** Um timer em andamento de alguem da equipe (para exibir ao vivo). */
export interface TimerEquipe {
  userId: string;
  nome: string;
  timer: TimerAtivo;
}

/** Publica/atualiza o meu timer em andamento na organizacao (compartilhado). */
export async function upsertTimerAtivo(orgId: string, userId: string, timer: TimerAtivo): Promise<void> {
  if (!supabaseConfigurado()) return;
  try {
    const sb = criarClienteNavegador();
    await sb.from(TABELA_TIMERS).upsert({
      org_id: orgId,
      user_id: userId,
      dados: timer,
      atualizado_em: new Date().toISOString(),
    });
  } catch {
    // sem servidor: o timer segue apenas local
  }
}

/** Remove o meu timer compartilhado (ao parar/descartar). */
export async function deleteTimerAtivo(orgId: string, userId: string): Promise<void> {
  if (!supabaseConfigurado()) return;
  try {
    const sb = criarClienteNavegador();
    await sb.from(TABELA_TIMERS).delete().eq("org_id", orgId).eq("user_id", userId);
  } catch {
    // ignora
  }
}

/** Le todos os timers em andamento da organizacao (a equipe inteira). */
export async function lerTimersAtivos(orgId: string): Promise<TimerEquipe[]> {
  if (!supabaseConfigurado()) return [];
  try {
    const sb = criarClienteNavegador();
    const { data, error } = await sb
      .from(TABELA_TIMERS)
      .select("user_id, dados, atualizado_em")
      .eq("org_id", orgId);
    if (error) throw error;
    const linhas = (data ?? []) as { user_id: string; dados: TimerAtivo; atualizado_em: string }[];
    const agora = Date.now();
    return linhas
      .map((r) => {
        const t = r.dados;
        if (!t || typeof t.cardId !== "string" || typeof t.inicio !== "string") return null;
        // Ignora timers "fantasma" (sem batimento recente: aparelho do dono saiu).
        const at = new Date(r.atualizado_em).getTime();
        if (Number.isFinite(at) && agora - at > TIMER_FANTASMA_MS) return null;
        return { userId: r.user_id, nome: t.autorNome || "Alguém", timer: t };
      })
      .filter((x): x is TimerEquipe => x !== null);
  } catch {
    return [];
  }
}

/**
 * Assina em tempo real os timers ativos da organizacao. No evento, RE-LE a lista
 * (nao confia no payload) e entrega ao assinante. Devolve uma funcao para cancelar.
 */
export function assinarTimersAtivos(
  orgId: string,
  aoMudar: (timers: TimerEquipe[]) => void
): (() => void) | undefined {
  if (!supabaseConfigurado()) return undefined;
  const sb = criarClienteNavegador();
  const canal = sb
    .channel(`timers-${orgId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABELA_TIMERS, filter: `org_id=eq.${orgId}` },
      () => {
        void lerTimersAtivos(orgId).then(aoMudar);
      }
    )
    .subscribe();
  return () => {
    void sb.removeChannel(canal);
  };
}
