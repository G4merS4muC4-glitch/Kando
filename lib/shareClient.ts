/**
 * Operacoes de compartilhamento feitas pelo TIME (autenticado), no navegador.
 * Criar, listar e revogar links. O acesso publico ao link e por outro caminho
 * (endpoints com service role).
 */

import { criarClienteNavegador, supabaseConfigurado } from "./supabase/client";
import {
  gerarToken,
  hashPin,
  type Compartilhamento,
  type VisibilidadeShare,
} from "./share";

export { supabaseConfigurado };

export interface NovoShare {
  cardIds: string[]; // o primeiro e o card de origem
  campanhaId?: string;
  visibilidade: VisibilidadeShare;
  edicaoTeleprompter: boolean;
  pin?: string; // vazio = sem PIN
  expiraEm?: string; // ISO ou undefined
}

export async function criarCompartilhamento(p: NovoShare): Promise<Compartilhamento> {
  const sb = criarClienteNavegador();
  const pinHash = p.pin && p.pin.trim() ? await hashPin(p.pin.trim()) : null;
  const linha = {
    token: gerarToken(),
    card_id: p.cardIds[0],
    card_ids: p.cardIds,
    campanha_id: p.campanhaId ?? null,
    visibilidade: p.visibilidade,
    edicao_teleprompter: p.edicaoTeleprompter,
    pin_hash: pinHash,
    expira_em: p.expiraEm ?? null,
    revogado: false,
  };
  const { data, error } = await sb.from("compartilhamentos").insert(linha).select().single();
  if (error) throw error;
  return data as Compartilhamento;
}

export async function listarCompartilhamentosDoCard(cardId: string): Promise<Compartilhamento[]> {
  const sb = criarClienteNavegador();
  const { data, error } = await sb
    .from("compartilhamentos")
    .select("*")
    .eq("card_id", cardId)
    .order("criado_em", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Compartilhamento[];
}

export async function revogarCompartilhamento(token: string): Promise<void> {
  const sb = criarClienteNavegador();
  const { error } = await sb.from("compartilhamentos").update({ revogado: true }).eq("token", token);
  if (error) throw error;
}
