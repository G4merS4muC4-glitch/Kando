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

/** Id da linha do quadro de uma organizacao no Supabase. */
function idBoard(orgId: string): string {
  return `principal:${orgId}`;
}

/** Quadro vazio (org nova): nunca usa o seed de exemplo no modo Supabase. */
const BOARD_VAZIO: Board = { marcas: [], campanhas: [], cards: [] };

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

/**
 * Carrega o quadro da organizacao. No modo Supabase, NAO semeia o quadro de
 * exemplo: a linha de cada organizacao e criada (vazia) pela RPC criar_organizacao.
 * Org sem linha (caso raro) volta vazia. O seed de exemplo fica so no modo local.
 */
export async function carregarBoard(orgId: string): Promise<Board> {
  if (!supabaseConfigurado()) return lerLocal();

  const sb = criarClienteNavegador();
  const { data, error } = await sb
    .from("boards")
    .select("dados")
    .eq("id", idBoard(orgId))
    .maybeSingle();

  // Importante: NAO mascarar erro de leitura. Se a leitura falhar (rede ou RLS),
  // o erro e propagado para o store nao habilitar o salvamento automatico e,
  // assim, evitar que o quadro vazio sobrescreva os dados reais da organizacao.
  if (error) throw error;

  if (!data) return BOARD_VAZIO;
  return boardValido(data.dados) ? (data.dados as Board) : BOARD_VAZIO;
}

/** Persiste o quadro inteiro da organizacao. Chamada (com debounce) a cada alteracao. */
export async function salvarBoard(board: Board, clienteId: string, orgId: string): Promise<void> {
  if (!supabaseConfigurado()) {
    salvarLocal(board);
    return;
  }
  try {
    const sb = criarClienteNavegador();
    await sb.from("boards").upsert({
      id: idBoard(orgId),
      dados: board,
      cliente_id: clienteId,
      org_id: orgId,
      atualizado_em: new Date().toISOString(),
    });
  } catch {
    // Falha de rede: ignora silenciosamente (a proxima alteracao tenta de novo).
  }
}

/**
 * Assina mudancas do quadro da organizacao em tempo real (somente no Supabase).
 * O canal e o filtro sao por organizacao para nao receber (nem reagir a) o
 * quadro de outra organizacao. Chama `aoMudar` quando OUTRO cliente salva.
 * Devolve uma funcao para cancelar a assinatura.
 */
export function assinarBoard(
  orgId: string,
  aoMudar: (dados: Board, clienteId: string) => void
): (() => void) | undefined {
  if (!supabaseConfigurado()) return undefined;

  const sb = criarClienteNavegador();
  const id = idBoard(orgId);
  const canal = sb
    .channel(`boards-${id}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "boards", filter: `id=eq.${id}` },
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
