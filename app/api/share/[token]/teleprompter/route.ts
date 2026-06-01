import { type NextRequest, NextResponse } from "next/server";
import { criarClienteAdmin, segredoAssinatura } from "@/lib/supabase/admin";
import { pinCookieValido } from "@/lib/shareServer";
import { estaExpirado, higienizarTexto, MAX_TELEPROMPTER, type CompartilhamentoCompleto } from "@/lib/share";

export const dynamic = "force-dynamic";

const INTERVALO_MIN_MS = 500; // intervalo minimo entre duas escritas
const MAX_POR_JANELA = 40; // teto de escritas por janela
const JANELA_MS = 60 * 1000;
const MAX_BODY = 64 * 1024; // limite do corpo da requisicao (bytes aproximados)

/**
 * Unico caminho de escrita publico: ajusta SO o texto do teleprompter, SO do
 * card daquele token, SO quando a edicao esta ligada e o bloco e visivel. A
 * gravacao e atomica no banco (funcao ajustar_teleprompter), entao nao
 * sobrescreve o resto do quadro. Guarda a versao anterior para reverter.
 */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const admin = criarClienteAdmin();
  if (!admin) return NextResponse.json({ ok: false, erro: "indisponivel" }, { status: 503 });

  const token = params.token;

  // Limite de tamanho do corpo antes de qualquer processamento.
  const bruto = await req.text();
  if (bruto.length > MAX_BODY) {
    return NextResponse.json({ ok: false, erro: "Texto muito grande." }, { status: 413 });
  }
  let corpo: { texto?: unknown };
  try {
    corpo = bruto ? JSON.parse(bruto) : {};
  } catch {
    corpo = {};
  }
  if (typeof corpo.texto !== "string") {
    return NextResponse.json({ ok: false, erro: "Texto invalido." }, { status: 400 });
  }

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
  // Escrita exige edicao ligada E o bloco do teleprompter visivel.
  if (!s.edicao_teleprompter || !s.visibilidade?.teleprompter) {
    return NextResponse.json({ ok: false, erro: "Edicao desativada." }, { status: 403 });
  }
  if (s.pin_hash) {
    const cookie = req.cookies.get(`sh_${token}`)?.value ?? "";
    if (!pinCookieValido(token, s.pin_hash, cookie, segredoAssinatura())) {
      return NextResponse.json({ ok: false, erro: "pin" }, { status: 401 });
    }
  }

  // Limite de taxa atomico (so consome a cota DEPOIS de autorizar).
  const { data: permitido, error: erroLim } = await admin.rpc("consumir_escrita", {
    p_token: token,
    p_intervalo_ms: INTERVALO_MIN_MS,
    p_max: MAX_POR_JANELA,
    p_janela_ms: JANELA_MS,
  });
  if (erroLim) return NextResponse.json({ ok: false, erro: "Falha ao salvar." }, { status: 500 });
  if (!permitido) {
    return NextResponse.json({ ok: false, erro: "Aguarde um instante." }, { status: 429 });
  }

  // Gravacao atomica: altera so o teleprompter daquele card.
  const limpo = higienizarTexto(corpo.texto.slice(0, MAX_TELEPROMPTER + 1));
  const nowIso = new Date().toISOString();
  const { data: n, error } = await admin.rpc("ajustar_teleprompter", {
    p_card_id: s.card_id,
    p_texto: limpo,
    p_em: nowIso,
  });
  if (error) return NextResponse.json({ ok: false, erro: "Falha ao salvar." }, { status: 500 });
  if (!n) return NextResponse.json({ ok: false, erro: "Card inexistente." }, { status: 404 });

  return NextResponse.json({ ok: true, em: nowIso });
}
