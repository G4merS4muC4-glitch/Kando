import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";

/**
 * Gerenciamento de logins da organizacao (so o dono). Usa a service role (server
 * only) para criar contas no Supabase Auth sem precisar do painel do Supabase.
 *
 * Seguranca: toda chamada exige o access token do usuario logado (Authorization:
 * Bearer). O token e validado no servidor e so segue se o chamador for DONO da
 * organizacao informada. A service role nunca vai para o navegador.
 *
 * - GET  ?org=<id>            -> lista os membros (e-mail, papel, se ainda tem
 *                               senha temporaria pendente).
 * - POST { orgId,email,nome } -> cria (ou reaproveita) o login e adiciona a org;
 *                               para conta nova, gera uma senha temporaria unica.
 * - DELETE { orgId, userId }  -> remove o membro da organizacao (nao apaga a conta).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Admin = NonNullable<ReturnType<typeof criarClienteAdmin>>;

function erro(status: number, msg: string) {
  return NextResponse.json({ erro: msg }, { status });
}

/** Senha temporaria legivel (sem caracteres ambiguos). */
function gerarSenhaTemporaria(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(14);
  let s = "";
  for (const b of bytes) s += alfabeto[b % alfabeto.length];
  return s;
}

/**
 * Valida o token e confirma que o chamador e dono da organizacao. Devolve o
 * cliente admin e o id do chamador, ou uma resposta de erro pronta.
 */
async function autorizarDono(
  req: Request,
  orgId: string
): Promise<{ admin: Admin; callerId: string } | { resp: NextResponse }> {
  const admin = criarClienteAdmin();
  if (!admin) return { resp: erro(503, "Gerenciamento de logins indisponível (service role não configurada).") };
  if (!orgId) return { resp: erro(400, "Organização não informada.") };

  const cabecalho = req.headers.get("authorization") ?? "";
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : "";
  if (!token) return { resp: erro(401, "Não autenticado.") };

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return { resp: erro(401, "Sessão inválida. Entre novamente.") };

  const { data: membro, error: e2 } = await admin
    .from("org_members")
    .select("papel")
    .eq("org_id", orgId)
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (e2) return { resp: erro(500, "Não foi possível verificar a permissão.") };
  if (!membro || membro.papel !== "dono") {
    return { resp: erro(403, "Apenas o dono da organização pode gerenciar logins.") };
  }
  return { admin, callerId: data.user.id };
}

/**
 * Mapa uid -> usuario (e-mail + se ainda tem senha temporaria), montado numa
 * listagem. Falha fechado: se a listagem der erro, lanca (o handler responde 500)
 * em vez de tratar como "sem usuarios". A marca de senha vive em app_metadata (so
 * a service role escreve/limpa), nao em user_metadata (que o proprio usuario edita).
 */
async function mapaUsuarios(admin: Admin): Promise<Map<string, { email: string; senhaTemp: boolean }>> {
  const mapa = new Map<string, { email: string; senhaTemp: boolean }>();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  for (const u of data?.users ?? []) {
    mapa.set(u.id, {
      email: u.email ?? "",
      senhaTemp: (u.app_metadata as { senha_temporaria?: boolean } | null)?.senha_temporaria === true,
    });
  }
  return mapa;
}

export async function GET(req: Request) {
  const orgId = new URL(req.url).searchParams.get("org") ?? "";
  const auth = await autorizarDono(req, orgId);
  if ("resp" in auth) return auth.resp;
  const { admin } = auth;

  const { data: membros, error } = await admin
    .from("org_members")
    .select("user_id, papel")
    .eq("org_id", orgId);
  if (error) return erro(500, "Não foi possível listar a equipe.");

  let mapa: Map<string, { email: string; senhaTemp: boolean }>;
  try {
    mapa = await mapaUsuarios(admin);
  } catch {
    return erro(500, "Não foi possível carregar os dados das contas.");
  }
  const lista = (membros ?? []).map((m: { user_id: string; papel: string }) => {
    const u = mapa.get(m.user_id);
    return {
      userId: m.user_id,
      email: u?.email ?? "(conta removida)",
      papel: m.papel === "dono" ? "dono" : "membro",
      senhaTemporaria: u?.senhaTemp ?? false,
    };
  });
  // Dono(s) primeiro, depois por e-mail.
  lista.sort((a, b) => (a.papel === b.papel ? a.email.localeCompare(b.email) : a.papel === "dono" ? -1 : 1));
  return NextResponse.json({ membros: lista });
}

export async function POST(req: Request) {
  const corpo = (await req.json().catch(() => ({}))) as { orgId?: string; email?: string; nome?: string };
  const orgId = corpo.orgId ?? "";
  const email = (corpo.email ?? "").trim().toLowerCase();
  const nome = (corpo.nome ?? "").trim();

  const auth = await autorizarDono(req, orgId);
  if ("resp" in auth) return auth.resp;
  const { admin } = auth;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return erro(400, "E-mail inválido.");

  // Ja existe uma conta com esse e-mail? Reaproveita (so adiciona a organizacao).
  let mapa: Map<string, { email: string; senhaTemp: boolean }>;
  try {
    mapa = await mapaUsuarios(admin);
  } catch {
    return erro(500, "Não foi possível verificar as contas. Tente novamente.");
  }
  let userId = "";
  for (const [id, u] of mapa) {
    if (u.email.toLowerCase() === email) {
      userId = id;
      break;
    }
  }

  let senhaTemporaria: string | undefined;
  let criado = false;
  if (!userId) {
    senhaTemporaria = gerarSenhaTemporaria();
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: senhaTemporaria,
      email_confirm: true, // acesso imediato (ferramenta interna); troca a senha no 1o acesso
      user_metadata: { nome: nome || undefined },
      // Marca de senha temporaria em app_metadata: so a service role escreve/limpa,
      // entao a troca obrigatoria no 1o acesso nao e burlavel pelo proprio usuario.
      app_metadata: { senha_temporaria: true },
    });
    if (error || !data.user) return erro(400, "Não foi possível criar a conta. Confira o e-mail.");
    userId = data.user.id;
    criado = true;
  }

  // Ja e membro desta organizacao?
  const { data: jaMembro } = await admin
    .from("org_members")
    .select("user_id")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (jaMembro) {
    return NextResponse.json({ email, criado, jaMembro: true, senhaTemporaria });
  }

  const { error: eInsert } = await admin
    .from("org_members")
    .insert({ org_id: orgId, user_id: userId, papel: "membro" });
  if (eInsert) {
    // Se a conta foi criada agora, desfaz para nao deixar conta orfa (sem org e
    // com a senha temporaria ja perdida).
    if (criado) {
      try {
        await admin.auth.admin.deleteUser(userId);
      } catch {
        // sem rollback possivel: segue com o erro
      }
    }
    return erro(500, "Não foi possível adicionar à organização. Tente novamente.");
  }

  return NextResponse.json({ email, criado, senhaTemporaria });
}

export async function DELETE(req: Request) {
  const corpo = (await req.json().catch(() => ({}))) as { orgId?: string; userId?: string };
  const orgId = corpo.orgId ?? "";
  const userId = corpo.userId ?? "";

  const auth = await autorizarDono(req, orgId);
  if ("resp" in auth) return auth.resp;
  const { admin, callerId } = auth;

  if (!userId) return erro(400, "Usuário não informado.");
  if (userId === callerId) return erro(400, "Você não pode remover o seu próprio acesso.");

  // So remove membros comuns (nunca um dono). Falha fechado se nao conseguir ler.
  const { data: alvo, error: eLer } = await admin
    .from("org_members")
    .select("papel")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (eLer) return erro(500, "Não foi possível verificar o acesso.");
  if (alvo?.papel === "dono") return erro(400, "Não é possível remover um dono.");

  const { error } = await admin.from("org_members").delete().eq("org_id", orgId).eq("user_id", userId);
  if (error) return erro(500, "Não foi possível remover o acesso.");
  return NextResponse.json({ ok: true });
}
