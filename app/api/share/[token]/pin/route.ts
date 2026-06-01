import { type NextRequest, NextResponse } from "next/server";
import { criarClienteAdmin, segredoAssinatura } from "@/lib/supabase/admin";
import { assinarPinCookie } from "@/lib/shareServer";
import { estaExpirado, pinConfere, type CompartilhamentoCompleto } from "@/lib/share";

export const dynamic = "force-dynamic";

const MAX_ERROS = 5; // erros antes de bloquear
const LOCK_MS = 5 * 60 * 1000; // 5 minutos de bloqueio
const MAX_BODY = 2 * 1024;

/** Valida o PIN do link. No acerto, seta um cookie assinado que libera a sessao. */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const admin = criarClienteAdmin();
  if (!admin) return NextResponse.json({ ok: false, erro: "indisponivel" }, { status: 503 });

  const token = params.token;
  const bruto = await req.text();
  if (bruto.length > MAX_BODY) {
    return NextResponse.json({ ok: false, erro: "Requisicao invalida." }, { status: 413 });
  }
  let corpo: { pin?: unknown };
  try {
    corpo = bruto ? JSON.parse(bruto) : {};
  } catch {
    corpo = {};
  }
  const pin = typeof corpo.pin === "string" ? corpo.pin : "";
  if (!pin) return NextResponse.json({ ok: false, erro: "Informe o codigo." }, { status: 400 });

  const { data } = await admin
    .from("compartilhamentos")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!data) return NextResponse.json({ ok: false, erro: "Link inexistente." }, { status: 404 });

  const s = data as CompartilhamentoCompleto;
  if (s.revogado || estaExpirado(s.expira_em)) {
    return NextResponse.json({ ok: false, erro: "Link indisponivel." }, { status: 410 });
  }
  if (!s.pin_hash) return NextResponse.json({ ok: true }); // sem PIN, nada a validar

  if (s.bloqueado_ate && new Date(s.bloqueado_ate).getTime() > Date.now()) {
    return NextResponse.json(
      { ok: false, erro: "Muitas tentativas. Tente novamente em alguns minutos." },
      { status: 429 }
    );
  }

  const confere = await pinConfere(pin, s.pin_hash);
  if (!confere) {
    // Incremento atomico do contador + bloqueio (nao perde contagem sob concorrencia).
    await admin.rpc("registrar_erro_pin", { p_token: token, p_max: MAX_ERROS, p_lock_ms: LOCK_MS });
    return NextResponse.json({ ok: false, erro: "Codigo incorreto." }, { status: 401 });
  }

  await admin
    .from("compartilhamentos")
    .update({ pin_erros: 0, bloqueado_ate: null })
    .eq("token", token);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(`sh_${token}`, assinarPinCookie(token, s.pin_hash, segredoAssinatura()), {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 horas
  });
  return res;
}
