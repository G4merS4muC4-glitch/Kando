/**
 * Operacoes dos links de sugestao feitas pelo TIME (autenticado), no navegador.
 * Criar, listar e revogar. O envio publico (visitante) e por outro caminho:
 * o endpoint /api/sugestao/[token] com service role.
 */

import { criarClienteNavegador, supabaseConfigurado } from "./supabase/client";
import { gerarToken } from "./share";

export { supabaseConfigurado };

/** Uma campanha de destino do link, com o nome que aparece para quem o recebe. */
export interface DestinoSugestao {
  campanhaId: string;
  nome: string;
}

export interface LinkSugestao {
  token: string;
  org_id: string;
  campanha_id: string; // campanha de origem (para listar o link sob ela)
  destinos: DestinoSugestao[]; // um ou varios destinos, cada um com seu nome
  revogado: boolean;
  criado_em: string;
}

/**
 * Cria um link de sugestao. `origemCampanhaId` e a campanha de onde o link foi
 * criado (para lista-lo sob ela); `destinos` sao as campanhas que a pessoa podera
 * escolher, cada uma com o nome que aparece no link.
 */
export async function criarLinkSugestao(
  orgId: string,
  origemCampanhaId: string,
  destinos: DestinoSugestao[]
): Promise<LinkSugestao> {
  const sb = criarClienteNavegador();
  const linha = {
    token: gerarToken(),
    org_id: orgId,
    campanha_id: origemCampanhaId,
    destinos,
    revogado: false,
  };
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
  return ((data ?? []) as LinkSugestao[]).map((l) => ({
    ...l,
    destinos: Array.isArray(l.destinos) ? l.destinos : [],
  }));
}

export async function revogarLinkSugestao(token: string): Promise<void> {
  const sb = criarClienteNavegador();
  const { error } = await sb.from("sugestao_links").update({ revogado: true }).eq("token", token);
  if (error) throw error;
}
