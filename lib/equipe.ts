/**
 * Chamadas do navegador para a rota de gerenciamento de logins (/api/equipe).
 * Cada chamada envia o access token do usuario logado no cabecalho Authorization;
 * o servidor valida e so responde se o chamador for dono da organizacao.
 */

import { criarClienteNavegador } from "./supabase/client";

export interface MembroEquipe {
  userId: string;
  email: string;
  papel: "dono" | "membro";
  senhaTemporaria: boolean; // ainda nao trocou a senha do primeiro acesso
}

export interface ResultadoCriarLogin {
  email: string;
  criado: boolean; // conta nova (true) ou ja existia (false)
  jaMembro?: boolean; // ja fazia parte desta organizacao
  senhaTemporaria?: string; // so quando a conta e nova
}

async function accessToken(): Promise<string> {
  const sb = criarClienteNavegador();
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? "";
}

async function comErro(r: Response): Promise<never> {
  const d = (await r.json().catch(() => ({}))) as { erro?: string };
  throw new Error(d.erro || "Não foi possível concluir a operação.");
}

export async function listarEquipe(orgId: string): Promise<MembroEquipe[]> {
  const t = await accessToken();
  const r = await fetch(`/api/equipe?org=${encodeURIComponent(orgId)}`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  if (!r.ok) return comErro(r);
  return ((await r.json()) as { membros: MembroEquipe[] }).membros;
}

export async function criarLogin(orgId: string, email: string, nome: string): Promise<ResultadoCriarLogin> {
  const t = await accessToken();
  const r = await fetch(`/api/equipe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
    body: JSON.stringify({ orgId, email, nome }),
  });
  if (!r.ok) return comErro(r);
  return (await r.json()) as ResultadoCriarLogin;
}

export async function removerLogin(orgId: string, userId: string): Promise<void> {
  const t = await accessToken();
  const r = await fetch(`/api/equipe`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
    body: JSON.stringify({ orgId, userId }),
  });
  if (!r.ok) await comErro(r);
}
