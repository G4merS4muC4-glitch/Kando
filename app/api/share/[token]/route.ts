import { type NextRequest, NextResponse } from "next/server";
import { criarClienteAdmin, segredoAssinatura } from "@/lib/supabase/admin";
import { pinCookieValido } from "@/lib/shareServer";
import { cardVisivel, estaExpirado, idsDoShare, type CompartilhamentoCompleto } from "@/lib/share";
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

  // O quadro fica na linha da organizacao dona do link (principal:<org>).
  if (!s.org_id) return NextResponse.json({ estado: "inexistente" });
  const { data: row } = await admin
    .from("boards")
    .select("dados")
    .eq("id", `principal:${s.org_id}`)
    .maybeSingle();
  const board = (row?.dados ?? null) as Board | null;

  const ids = idsDoShare(s);
  // Mantem a ordem escolhida no link e descarta ids que nao existem mais.
  const cards = ids
    .map((id) => board?.cards.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .map((c) => cardVisivel(c, s.visibilidade));
  if (cards.length === 0) return NextResponse.json({ estado: "inexistente" });

  // Marca pela campanha do primeiro card encontrado. Resolve cor/nome a partir
  // das marcas da organizacao (o visitante nao tem contexto do board).
  const primeiro = board?.cards.find((c) => c.id === cards[0].id);
  const campanha = board?.campanhas.find((c) => c.id === primeiro?.campanhaId);
  const marcaId = campanha?.marca ?? "";
  const marcaOrg = (board?.marcas ?? []).find((mm) => mm.id === marcaId);

  return NextResponse.json({
    estado: "ok",
    edicaoTeleprompter: s.edicao_teleprompter,
    marca: marcaId || "brusoft",
    marcaCor: marcaOrg?.cor ?? null,
    marcaNome: marcaOrg?.nome ?? null,
    cards,
  });
}
