/**
 * Operacoes dos links de sugestao feitas pelo TIME (autenticado), no navegador.
 * Criar, listar e revogar. O envio publico (visitante) e por outro caminho:
 * o endpoint /api/sugestao/[token] com service role.
 */

import { criarClienteNavegador, supabaseConfigurado } from "./supabase/client";
import { gerarToken } from "./share";

export { supabaseConfigurado };

export interface LinkSugestao {
  token: string;
  org_id: string;
  campanha_id: string;
  revogado: boolean;
  criado_em: string;
}

export async function criarLinkSugestao(orgId: string, campanhaId: string): Promise<LinkSugestao> {
  const sb = criarClienteNavegador();
  const linha = { token: gerarToken(), org_id: orgId, campanha_id: campanhaId, revogado: false };
  const { data, error } = await sb.from("sugestao_links").insert(linha).select().single();
  if (error) throw error;
  return data as LinkSugestao;
}

export async function listarLinksSugestao(campanhaId: string): Promise<LinkSugestao[]> {
  const sb = criarClienteNavegador();
  const { data, error } = await sb
    .from("sugestao_links")
    .select("*")
    .eq("campanha_id", campanhaId)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LinkSugestao[];
}

export async function revogarLinkSugestao(token: string): Promise<void> {
  const sb = criarClienteNavegador();
  const { error } = await sb.from("sugestao_links").update({ revogado: true }).eq("token", token);
  if (error) throw error;
}
