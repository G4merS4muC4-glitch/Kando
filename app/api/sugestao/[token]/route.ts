import { type NextRequest, NextResponse } from "next/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import type { Board, CardConteudo } from "@/lib/types";

export const dynamic = "force-dynamic";

const MAX_TITULO = 200;
const MAX_DESC = 4000;
const MAX_NOME = 80;
const MAX_URL = 600;
const INTERVALO_MS = 4000; // limite simples: 1 envio a cada 4s por link

interface DestinoLink {
  campanhaId: string;
  nome: string;
}
interface LinkSugestao {
  org_id: string | null;
  campanha_id: string;
  destinos: DestinoLink[] | null;
  revogado: boolean;
  ultima_em: string | null;
}

// Caracteres de controle proibidos (mantem tab, nova linha e retorno).
const CONTROLE = new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]", "g");
function limpar(t: string, max: number): string {
  return t.replace(CONTROLE, "").trim().slice(0, max);
}

/**
 * Destinos "efetivos" do link: os cadastrados em `destinos`; se estiver vazio
 * (link antigo, de uma campanha so), cai no `campanha_id`.
 */
function destinosEfetivos(link: Pick<LinkSugestao, "campanha_id" | "destinos">): DestinoLink[] {
  const ds = Array.isArray(link.destinos) ? link.destinos : [];
  const validos = ds.filter((d) => d && typeof d.campanhaId === "string" && d.campanhaId);
  if (validos.length > 0) return validos;
  return link.campanha_id ? [{ campanhaId: link.campanha_id, nome: "" }] : [];
}

/** Resolve o link: devolve os destinos (nome + marca) para a pagina publica. */
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const admin = criarClienteAdmin();
  if (!admin) return NextResponse.json({ estado: "indisponivel" }, { status: 503 });

  const { data } = await admin
    .from("sugestao_links")
    .select("org_id, campanha_id, destinos, revogado")
    .eq("token", params.token)
    .maybeSingle();
  if (!data) return NextResponse.json({ estado: "inexistente" });
  const link = data as Pick<LinkSugestao, "org_id" | "campanha_id" | "destinos" | "revogado">;
  if (link.revogado) return NextResponse.json({ estado: "revogado" });
  if (!link.org_id) return NextResponse.json({ estado: "inexistente" });

  const { data: row } = await admin
    .from("boards")
    .select("dados")
    .eq("id", `principal:${link.org_id}`)
    .maybeSingle();
  const board = (row?.dados ?? null) as Board | null;
  if (!board) return NextResponse.json({ estado: "indisponivel" });

  const destinos = destinosEfetivos(link)
    .map((d) => {
      const camp = board.campanhas.find((c) => c.id === d.campanhaId);
      if (!camp) return null;
      const marca = (board.marcas ?? []).find((m) => m.id === camp.marca);
      return {
        campanhaId: d.campanhaId,
        nome: (d.nome && d.nome.trim()) || marca?.nome || camp.nome,
        marcaNome: marca?.nome ?? null,
        marcaCor: marca?.cor ?? null,
      };
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);

  if (destinos.length === 0) return NextResponse.json({ estado: "indisponivel" });
  return NextResponse.json({ estado: "ok", destinos });
}

/** Recebe a sugestao e cria um card (externo) na coluna inicial da campanha escolhida. */
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const admin = criarClienteAdmin();
  if (!admin) return NextResponse.json({ ok: false, erro: "indisponivel" }, { status: 503 });

  const bruto = await req.text();
  if (bruto.length > MAX_DESC + 2000) {
    return NextResponse.json({ ok: false, erro: "Conteudo muito grande." }, { status: 413 });
  }
  let corpo: {
    titulo?: unknown;
    descricao?: unknown;
    nome?: unknown;
    referenciaUrl?: unknown;
    campanhaId?: unknown;
  };
  try {
    corpo = bruto ? JSON.parse(bruto) : {};
  } catch {
    corpo = {};
  }
  const titulo = limpar(typeof corpo.titulo === "string" ? corpo.titulo : "", MAX_TITULO);
  if (!titulo) {
    return NextResponse.json({ ok: false, erro: "Escreva o titulo da ideia." }, { status: 400 });
  }
  const descricao = limpar(typeof corpo.descricao === "string" ? corpo.descricao : "", MAX_DESC);
  const nome = limpar(typeof corpo.nome === "string" ? corpo.nome : "", MAX_NOME) || "Visitante";
  let referenciaUrl = limpar(typeof corpo.referenciaUrl === "string" ? corpo.referenciaUrl : "", MAX_URL);
  if (referenciaUrl && !/^https?:\/\//i.test(referenciaUrl)) referenciaUrl = `https://${referenciaUrl}`;

  // Resolve o link e aplica o limite anti-spam.
  const { data } = await admin
    .from("sugestao_links")
    .select("org_id, campanha_id, destinos, revogado, ultima_em")
    .eq("token", params.token)
    .maybeSingle();
  if (!data) return NextResponse.json({ ok: false, erro: "Link inexistente." }, { status: 404 });
  const link = data as LinkSugestao;
  if (link.revogado || !link.org_id) {
    return NextResponse.json({ ok: false, erro: "Link indisponivel." }, { status: 410 });
  }
  if (link.ultima_em && Date.now() - new Date(link.ultima_em).getTime() < INTERVALO_MS) {
    return NextResponse.json({ ok: false, erro: "Aguarde um instante e envie de novo." }, { status: 429 });
  }

  // A campanha escolhida precisa ser um dos destinos do link (nao aceita destino
  // arbitrario vindo do cliente).
  const ids = destinosEfetivos(link).map((d) => d.campanhaId);
  const escolhida = typeof corpo.campanhaId === "string" ? corpo.campanhaId : "";
  const alvo = ids.includes(escolhida) ? escolhida : ids.length === 1 ? ids[0] : "";
  if (!alvo) {
    return NextResponse.json({ ok: false, erro: "Escolha para onde enviar a ideia." }, { status: 400 });
  }

  // Confere a campanha e descobre a coluna inicial do quadro da organizacao.
  const { data: row } = await admin
    .from("boards")
    .select("dados")
    .eq("id", `principal:${link.org_id}`)
    .maybeSingle();
  const board = (row?.dados ?? null) as Board | null;
  const campanha = board?.campanhas.find((c) => c.id === alvo);
  if (!campanha) return NextResponse.json({ ok: false, erro: "Campanha indisponivel." }, { status: 410 });
  const etapas = board?.etapas;
  const etapaInicial = etapas?.find((e) => e.inicial)?.id ?? etapas?.[0]?.id ?? "ideias";

  const ts = new Date().toISOString();
  const card: CardConteudo = {
    id: crypto.randomUUID(),
    campanhaId: alvo,
    titulo,
    tipo: "reels",
    canais: ["instagram"],
    etapa: etapaInicial,
    tema: "",
    briefing: descricao,
    roteiro: "",
    teleprompter: "",
    legenda: "",
    externo: true,
    sugeridoPor: nome,
    referenciaUrl: referenciaUrl || undefined,
    criadoEm: ts,
    atualizadoEm: ts,
  };

  const { data: n, error } = await admin.rpc("anexar_card", { p_org: link.org_id, p_card: card });
  if (error || !n) {
    return NextResponse.json({ ok: false, erro: "Nao foi possivel enviar." }, { status: 500 });
  }
  await admin.from("sugestao_links").update({ ultima_em: ts }).eq("token", params.token);

  return NextResponse.json({ ok: true });
}
