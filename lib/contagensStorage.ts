/**
 * Camada de dados das contagens regressivas, isolada (mesmo padrao de
 * lib/apontamentosStorage.ts).
 *
 * - Lista de contagens: documento compartilhado pela organizacao.
 *   - Sem Supabase: localStorage (chave unica).
 *   - Com Supabase: uma linha propria na tabela boards, id "contagens:<org>"
 *     (reaproveita a tabela e o RLS; nao mexe no quadro principal). Nao precisa
 *     de SQL novo.
 * - Contagem fixada na tela: localStorage por aparelho. O prazo e do time, mas
 *   qual deles fica no card flutuante e escolha de cada um.
 */

import type { Contagem, ContagensDoc } from "./types";
import { criarClienteNavegador, supabaseConfigurado } from "./supabase/client";

const idLinha = (orgId: string) => `contagens:${orgId}`; // linha por organizacao
const CHAVE_LOCAL = "kando:contagens"; // fallback localStorage
const chaveFixada = (orgId: string) => `kando:contagem-fixada:${orgId}`;

function temLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function docValido(dados: unknown): dados is ContagensDoc {
  const d = dados as ContagensDoc | null;
  return Boolean(d && Array.isArray(d.contagens));
}

function lerLocal(): Contagem[] {
  if (!temLocalStorage()) return [];
  try {
    const bruto = window.localStorage.getItem(CHAVE_LOCAL);
    if (!bruto) return [];
    const dados = JSON.parse(bruto) as ContagensDoc;
    return docValido(dados) ? dados.contagens : [];
  } catch {
    return [];
  }
}

function salvarLocal(contagens: Contagem[]): void {
  if (!temLocalStorage()) return;
  try {
    window.localStorage.setItem(CHAVE_LOCAL, JSON.stringify({ contagens }));
  } catch {
    // Sem espaco ou bloqueado: ignora.
  }
}

/** Le as contagens da organizacao (documento compartilhado ou localStorage). */
export async function getContagens(orgId: string): Promise<Contagem[]> {
  if (!supabaseConfigurado()) return lerLocal();
  try {
    const sb = criarClienteNavegador();
    const { data, error } = await sb
      .from("boards")
      .select("dados")
      .eq("id", idLinha(orgId))
      .maybeSingle();
    if (error) throw error;
    return docValido(data?.dados) ? (data!.dados as ContagensDoc).contagens : [];
  } catch {
    return lerLocal();
  }
}

/** Salva todas as contagens da organizacao (documento compartilhado ou local). */
export async function salvarContagens(orgId: string, contagens: Contagem[]): Promise<void> {
  if (!supabaseConfigurado()) {
    salvarLocal(contagens);
    return;
  }
  try {
    const sb = criarClienteNavegador();
    await sb.from("boards").upsert({
      id: idLinha(orgId),
      dados: { contagens } satisfies ContagensDoc,
      cliente_id: "contagens",
      org_id: orgId,
      atualizado_em: new Date().toISOString(),
    });
  } catch {
    salvarLocal(contagens);
  }
}

/**
 * Assina mudancas das contagens da organizacao em tempo real (so no Supabase).
 * No evento, RE-LE a lista do banco (nao confia no payload, que pode vir cortado)
 * e entrega para o assinante. Devolve uma funcao para cancelar.
 */
export function assinarContagens(
  orgId: string,
  aoMudar: (contagens: Contagem[]) => void
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
        void getContagens(orgId).then(aoMudar);
      }
    )
    .subscribe();
  return () => {
    void sb.removeChannel(canal);
  };
}

// ----- Contagem fixada na tela (por aparelho e por organizacao) -----

/** Id da contagem que este aparelho mostra no card flutuante (ou null). */
export function lerFixadaLocal(orgId: string): string | null {
  if (!temLocalStorage()) return null;
  try {
    const id = window.localStorage.getItem(chaveFixada(orgId));
    return id && id.trim() ? id : null;
  } catch {
    return null;
  }
}

/** Guarda (ou limpa, com null) a contagem fixada neste aparelho. */
export function salvarFixadaLocal(orgId: string, id: string | null): void {
  if (!temLocalStorage()) return;
  try {
    if (id) window.localStorage.setItem(chaveFixada(orgId), id);
    else window.localStorage.removeItem(chaveFixada(orgId));
  } catch {
    // sem localStorage: a escolha apenas nao persiste
  }
}
