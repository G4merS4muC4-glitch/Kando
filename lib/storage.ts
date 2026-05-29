import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { Board } from "./types";
import { boardInicial } from "./seed";
import { criarClienteNavegador, supabaseConfigurado } from "./supabase/client";

/**
 * Camada de dados isolada.
 *
 * Toda leitura e escrita do quadro passa por aqui. Funciona em dois modos:
 * - localStorage (padrao, sem login): dados ficam no navegador.
 * - Supabase (quando configurado): banco compartilhado pela equipe, com
 *   sincronizacao em tempo real entre quem estiver com o app aberto.
 *
 * O quadro inteiro e guardado como um documento JSON (modelo simples, ideal
 * para um time pequeno). Para escalar para muitos editores simultaneos, daria
 * para migrar para tabelas relacionais sem mexer na interface.
 */

const CHAVE_STORAGE = "conteudo-brusoft:board:v2";
const ID_BOARD = "principal"; // id da linha unica do quadro compartilhado

// ----- localStorage -----

function temLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function lerLocal(): Board {
  if (!temLocalStorage()) return boardInicial();
  try {
    const bruto = window.localStorage.getItem(CHAVE_STORAGE);
    if (!bruto) return boardInicial();
    const dados = JSON.parse(bruto) as Board;
    if (!dados || !Array.isArray(dados.cards) || !Array.isArray(dados.campanhas)) {
      return boardInicial();
    }
    return dados;
  } catch {
    return boardInicial();
  }
}

function salvarLocal(board: Board): void {
  if (!temLocalStorage()) return;
  try {
    window.localStorage.setItem(CHAVE_STORAGE, JSON.stringify(board));
  } catch {
    // Sem espaco ou bloqueado: ignora.
  }
}

function boardValido(dados: unknown): dados is Board {
  const b = dados as Board | null;
  return Boolean(b && Array.isArray(b.cards) && Array.isArray(b.campanhas));
}

// ----- API publica (usada pelo store) -----

/** Carrega o quadro. No Supabase, cria o quadro inicial no primeiro acesso. */
export async function carregarBoard(): Promise<Board> {
  if (!supabaseConfigurado()) return lerLocal();

  const sb = criarClienteNavegador();
  const { data, error } = await sb.from("boards").select("dados").eq("id", ID_BOARD).maybeSingle();

  // Importante: NAO mascarar erro de leitura. Se a leitura falhar (rede ou RLS),
  // o erro e propagado para o store nao habilitar o salvamento automatico e,
  // assim, evitar que o quadro de exemplo sobrescreva os dados reais do time.
  if (error) throw error;

  if (!data) {
    // Linha ainda nao existe (primeiro acesso de verdade): semeia o quadro inicial.
    const inicial = boardInicial();
    await sb.from("boards").upsert({
      id: ID_BOARD,
      dados: inicial,
      cliente_id: "seed",
      atualizado_em: new Date().toISOString(),
    });
    return inicial;
  }
  return boardValido(data.dados) ? (data.dados as Board) : boardInicial();
}

/** Persiste o quadro inteiro. Chamada (com debounce) a cada alteracao. */
export async function salvarBoard(board: Board, clienteId: string): Promise<void> {
  if (!supabaseConfigurado()) {
    salvarLocal(board);
    return;
  }
  try {
    const sb = criarClienteNavegador();
    await sb.from("boards").upsert({
      id: ID_BOARD,
      dados: board,
      cliente_id: clienteId,
      atualizado_em: new Date().toISOString(),
    });
  } catch {
    // Falha de rede: ignora silenciosamente (a proxima alteracao tenta de novo).
  }
}

/**
 * Assina mudancas do quadro em tempo real (somente no modo Supabase).
 * Chama `aoMudar` quando OUTRO cliente salva (ignora a propria escrita).
 * Devolve uma funcao para cancelar a assinatura.
 */
export function assinarBoard(
  aoMudar: (dados: Board, clienteId: string) => void
): (() => void) | undefined {
  if (!supabaseConfigurado()) return undefined;

  const sb = criarClienteNavegador();
  const canal = sb
    .channel(`boards-${ID_BOARD}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "boards", filter: `id=eq.${ID_BOARD}` },
      (payload: RealtimePostgresChangesPayload<{ dados: unknown; cliente_id: string }>) => {
        const nova = payload.new as { dados?: unknown; cliente_id?: string };
        if (nova && boardValido(nova.dados)) {
          aoMudar(nova.dados as Board, nova.cliente_id ?? "");
        }
      }
    )
    .subscribe();

  return () => {
    void sb.removeChannel(canal);
  };
}
