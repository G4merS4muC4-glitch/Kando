import { type NextRequest, NextResponse } from "next/server";
import { criarClienteAdmin, segredoAssinatura } from "@/lib/supabase/admin";
import { pinCookieValido } from "@/lib/shareServer";
import { cardVisivel, estaExpirado, type CompartilhamentoCompleto } from "@/lib/share";
import type { Board } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Resolve o link publico: devolve o estado e, quando liberado, apenas os blocos
 * visiveis do card. Nao vaza nada quando o link pede PIN e ele ainda nao foi
 * validado nesta sessao.
 */
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const admin = criarClienteAdmin();
  if (!admin) return NextResponse.json({ estado: "indisponivel" }, { status: 503 });

  const token = params.token;
  const { data } = await admin
    .from("compartilhamentos")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (!data) return NextResponse.json({ estado: "inexistente" });

  const s = data as CompartilhamentoCompleto;
  if (s.revogado) return NextResponse.json({ estado: "revogado" });
  if (estaExpirado(s.expira_em)) return NextResponse.json({ estado: "expirado" });

  if (s.pin_hash) {
    const cookie = req.cookies.get(`sh_${token}`)?.value ?? "";
    if (!pinCookieValido(token, s.pin_hash, cookie, segredoAssinatura())) {
      return NextResponse.json({ estado: "pin" });
    }
  }

  const { data: row } = await admin
    .from("boards")
    .select("dados")
    .eq("id", "principal")
    .maybeSingle();
  const board = (row?.dados ?? null) as Board | null;
  const card = board?.cards.find((c) => c.id === s.card_id);
  if (!card) return NextResponse.json({ estado: "inexistente" });
  const campanha = board?.campanhas.find((c) => c.id === card.campanhaId);

  return NextResponse.json({
    estado: "ok",
    edicaoTeleprompter: s.edicao_teleprompter,
    marca: campanha?.marca ?? "brusoft",
    card: cardVisivel(card, s.visibilidade),
  });
}
