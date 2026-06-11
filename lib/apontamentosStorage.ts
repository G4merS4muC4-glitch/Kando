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
