/**
 * Camada de dados das metricas, isolada (mesmo padrao de lib/storage.ts).
 * Cada perfil/marca guarda o seu ultimo JSON separadamente, por organizacao.
 *
 * - Sem Supabase: localStorage, uma chave por perfil.
 * - Com Supabase: uma linha propria na tabela boards, id
 *   "metricas:<org>:<perfil>" (reaproveita a tabela e o RLS por organizacao;
 *   nao mexe no quadro principal).
 */

import type { MetricasInstagram, PerfilMetrica } from "./metricas";
import { criarClienteNavegador, supabaseConfigurado } from "./supabase/client";

const PREFIXO_LOCAL = "kando:metricas:";
const idLinha = (orgId: string, perfil: PerfilMetrica) => `metricas:${orgId}:${perfil}`;

function temLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function lerLocal(perfil: PerfilMetrica): MetricasInstagram | null {
  if (!temLocalStorage()) return null;
  try {
    const bruto = window.localStorage.getItem(PREFIXO_LOCAL + perfil);
    return bruto ? (JSON.parse(bruto) as MetricasInstagram) : null;
  } catch {
    return null;
  }
}

function salvarLocal(perfil: PerfilMetrica, dados: MetricasInstagram): void {
  if (!temLocalStorage()) return;
  try {
    window.localStorage.setItem(PREFIXO_LOCAL + perfil, JSON.stringify(dados));
  } catch {
    // Sem espaco ou bloqueado: ignora.
  }
}

/** Le as metricas salvas do perfil/marca da organizacao (ou null se nao houver). */
export async function getMetricas(
  orgId: string,
  perfil: PerfilMetrica
): Promise<MetricasInstagram | null> {
  if (!supabaseConfigurado()) return lerLocal(perfil);
  try {
    const sb = criarClienteNavegador();
    const { data, error } = await sb
      .from("boards")
      .select("dados")
      .eq("id", idLinha(orgId, perfil))
      .maybeSingle();
    if (error) throw error;
    return (data?.dados as MetricasInstagram | undefined) ?? null;
  } catch {
    // Falha de rede/RLS: tenta o que houver localmente.
    return lerLocal(perfil);
  }
}

/** Salva as metricas do perfil/marca da organizacao (banco ou localStorage). */
export async function saveMetricas(
  orgId: string,
  perfil: PerfilMetrica,
  dados: MetricasInstagram
): Promise<void> {
  if (!supabaseConfigurado()) {
    salvarLocal(perfil, dados);
    return;
  }
  try {
    const sb = criarClienteNavegador();
    await sb.from("boards").upsert({
      id: idLinha(orgId, perfil),
      dados,
      cliente_id: "metricas",
      org_id: orgId,
      atualizado_em: new Date().toISOString(),
    });
  } catch {
    salvarLocal(perfil, dados);
  }
}
