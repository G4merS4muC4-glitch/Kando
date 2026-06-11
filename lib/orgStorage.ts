/**
 * Camada de dados das organizacoes (multiempresa), isolada como as demais.
 *
 * So faz sentido no modo Supabase (com login). No modo local (localStorage, sem
 * login) o app usa uma organizacao sintetica "local" e nao chama nada daqui.
 *
 * Toda a criacao de organizacao e a aplicacao de convites passa por RPCs
 * SECURITY DEFINER no banco (ver supabase/organizacoes.sql), para criar a
 * organizacao e a propria associacao numa transacao so, sem esbarrar no RLS.
 */

import type { Organizacao } from "./types";
import { criarClienteNavegador, supabaseConfigurado } from "./supabase/client";

export interface UsuarioAtual {
  id: string;
  email: string;
}

/** Usuario logado (id + e-mail) ou null. */
export async function usuarioAtual(): Promise<UsuarioAtual | null> {
  if (!supabaseConfigurado()) return null;
  try {
    const sb = criarClienteNavegador();
    const { data } = await sb.auth.getUser();
    const u = data.user;
    if (!u) return null;
    return { id: u.id, email: u.email ?? "" };
  } catch {
    return null;
  }
}

/** Lista as organizacoes das quais o usuario logado e membro (com o seu papel). */
export async function listarMinhasOrgs(): Promise<Organizacao[]> {
  if (!supabaseConfigurado()) return [];
  const sb = criarClienteNavegador();
  const { data: userData } = await sb.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return [];

  const { data, error } = await sb
    .from("org_members")
    .select("papel, organizations(id, nome)")
    .eq("user_id", uid);
  if (error) throw error;

  type Linha = { papel: string; organizations: { id: string; nome: string } | null };
  return ((data ?? []) as unknown as Linha[])
    .filter((l) => l.organizations)
    .map((l) => ({
      id: l.organizations!.id,
      nome: l.organizations!.nome,
      papel: l.papel === "dono" ? "dono" : "membro",
    }));
}

/** Cria uma organizacao (com o quadro vazio) e devolve o seu id. */
export async function criarOrg(nome: string): Promise<string> {
  const sb = criarClienteNavegador();
  const { data, error } = await sb.rpc("criar_organizacao", { p_nome: nome });
  if (error) throw error;
  return data as string;
}

/** Aplica convites pendentes do usuario logado (casados pelo e-mail). */
export async function aplicarConvites(): Promise<number> {
  if (!supabaseConfigurado()) return 0;
  try {
    const sb = criarClienteNavegador();
    const { data, error } = await sb.rpc("aplicar_convites");
    if (error) return 0;
    return (data as number) ?? 0;
  } catch {
    return 0;
  }
}
