import { NextResponse } from "next/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";

/**
 * Troca de senha do primeiro acesso. Feita no servidor (service role) para poder
 * limpar a marca app_metadata.senha_temporaria junto com a nova senha, numa acao
 * so: assim a troca obrigatoria nao e burlavel pelo proprio usuario (app_metadata
 * nao e gravavel pelo navegador). Exige o token do proprio usuario logado.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const admin = criarClienteAdmin();
  if (!admin) return NextResponse.json({ erro: "Recurso indisponível." }, { status: 503 });

  const cabecalho = req.headers.get("authorization") ?? "";
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : "";
  if (!token) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return NextResponse.json({ erro: "Sessão inválida. Entre novamente." }, { status: 401 });

  const corpo = (await req.json().catch(() => ({}))) as { novaSenha?: string };
  const novaSenha = corpo.novaSenha ?? "";
  if (novaSenha.length < 8) {
    return NextResponse.json({ erro: "A senha precisa ter pelo menos 8 caracteres." }, { status: 400 });
  }

  const app = (data.user.app_metadata ?? {}) as Record<string, unknown>;
  const { error: eUpd } = await admin.auth.admin.updateUserById(data.user.id, {
    password: novaSenha,
    app_metadata: { ...app, senha_temporaria: false },
  });
  if (eUpd) return NextResponse.json({ erro: "Não foi possível salvar a nova senha." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
