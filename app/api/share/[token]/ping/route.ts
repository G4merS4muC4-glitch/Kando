import { type NextRequest, NextResponse } from "next/server";
import { criarClienteAdmin, segredoAssinatura } from "@/lib/supabase/admin";
import { pinCookieValido } from "@/lib/shareServer";
import { estaExpirado, type CompartilhamentoCompleto } from "@/lib/share";

export const dynamic = "force-dynamic";

/**
 * Sinal leve de "mudou algo" para o painel do visitante sincronizar sem puxar o
 * quadro inteiro a cada verificacao. Devolve so o estado do link e uma versao (o
 * atualizado_em do quadro). O visitante so busca o conteudo completo quando a
 * versao muda, mantendo o trafego do Supabase baixo enquanto ninguem edita.
 */
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const admin = criarClienteAdmin();
  if (!admin) return NextResponse.json({ estado: "indisponivel" }, { status: 503 });

  const token = params.token;
  const { data } = await admin
    .from("compartilhamentos")
    .select("revogado, expira_em, pin_hash, org_id")
    .eq("token", token)
    .maybeSingle();
  if (!data) return NextResponse.json({ estado: "inexistente" });

  const s = data as Pick<
    CompartilhamentoCompleto,
    "revogado" | "expira_em" | "pin_hash" | "org_id"
  >;
  if (s.revogado) return NextResponse.json({ estado: "revogado" });
  if (estaExpirado(s.expira_em)) return NextResponse.json({ estado: "expirado" });
  if (s.pin_hash) {
    const cookie = req.cookies.get(`sh_${token}`)?.value ?? "";
    if (!pinCookieValido(token, s.pin_hash, cookie, segredoAssinatura())) {
      return NextResponse.json({ estado: "pin" });
    }
  }

  // Le so o carimbo de atualizacao do quadro da organizacao (campo minusculo).
  if (!s.org_id) return NextResponse.json({ estado: "ok", v: "" });
  const { data: row } = await admin
    .from("boards")
    .select("atualizado_em")
    .eq("id", `principal:${s.org_id}`)
    .maybeSingle();

  return NextResponse.json({ estado: "ok", v: (row?.atualizado_em as string | null) ?? "" });
}
