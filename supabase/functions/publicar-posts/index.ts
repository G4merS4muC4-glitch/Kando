// Robo publicador: publica no Facebook e no Instagram os cards agendados cujo
// horario ja chegou. Roda no Supabase (Deno) e e chamado pelo pg_cron a cada
// poucos minutos (ver supabase/cron.sql).
//
// Seguranca: os tokens das paginas ficam SO aqui, nos secrets das Edge
// Functions (ver META_SETUP.md). Nunca no app nem no banco que o time acessa.
//
// Fluxo seguro contra perda de dados: le o quadro, publica, RE-LE o quadro
// fresco e aplica so as mudancas de status dos cards publicados, para nao
// sobrescrever edicoes que o time tenha feito durante a publicacao.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ID_BOARD = "principal";
const API_VERSION = Deno.env.get("META_API_VERSION") ?? "v21.0";
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;
const MAX_POR_EXECUCAO = 10; // limite por rodada, para nao estourar o tempo
const FUSO = "-03:00"; // Brasil (sem horario de verao desde 2019)

type Marca = "brusoft" | "evotalks";

interface Tarefa {
  statusPub?: "agendado" | "publicado" | "erro";
}

interface Card {
  id: string;
  campanhaId: string;
  titulo: string;
  canais: string[];
  etapa: string;
  legenda: string;
  midiaUrl?: string;
  dataPublicacao?: string; // yyyy-mm-dd
  horaPublicacao?: string; // HH:MM
  statusPub?: "agendado" | "publicado" | "erro";
  erroPub?: string;
  postadoEm?: string;
}

interface Campanha {
  id: string;
  marca: Marca;
}

interface Board {
  campanhas: Campanha[];
  cards: Card[];
}

interface Credenciais {
  fbPageId: string;
  fbToken: string;
  igUserId: string;
}

/** Le as credenciais da marca a partir dos secrets do ambiente. */
function credenciais(marca: Marca): Credenciais {
  const p = marca.toUpperCase(); // BRUSOFT | EVOTALKS
  const fbPageId = Deno.env.get(`${p}_FB_PAGE_ID`) ?? "";
  const fbToken = Deno.env.get(`${p}_FB_TOKEN`) ?? "";
  const igUserId = Deno.env.get(`${p}_IG_USER_ID`) ?? "";
  return { fbPageId, fbToken, igUserId };
}

function ehVideo(url: string): boolean {
  return /\.(mp4|mov|m4v|webm)(\?|#|$)/i.test(url);
}

function dorme(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Momento agendado do card (em ms), interpretando data+hora no fuso do Brasil. */
function instanteAgendado(card: Card): number | null {
  if (!card.dataPublicacao || !card.horaPublicacao) return null;
  const t = new Date(`${card.dataPublicacao}T${card.horaPublicacao}:00${FUSO}`).getTime();
  return Number.isNaN(t) ? null : t;
}

async function graphPost(
  caminho: string,
  params: Record<string, string>
): Promise<Record<string, unknown>> {
  const res = await fetch(`${GRAPH}/${caminho}`, {
    method: "POST",
    body: new URLSearchParams(params),
  });
  const json = (await res.json()) as Record<string, unknown> & { error?: { message?: string } };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Erro HTTP ${res.status}`);
  }
  return json;
}

async function graphGet(
  caminho: string,
  params: Record<string, string>
): Promise<Record<string, unknown>> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${GRAPH}/${caminho}?${qs}`);
  const json = (await res.json()) as Record<string, unknown> & { error?: { message?: string } };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Erro HTTP ${res.status}`);
  }
  return json;
}

/** Publica no Facebook (foto do feed, ou video do feed quando for video). */
async function publicarFacebook(cr: Credenciais, card: Card): Promise<void> {
  if (!cr.fbPageId || !cr.fbToken) throw new Error("Facebook nao configurado para a marca");
  const midia = card.midiaUrl ?? "";
  if (ehVideo(midia)) {
    await graphPost(`${cr.fbPageId}/videos`, {
      file_url: midia,
      description: card.legenda ?? "",
      access_token: cr.fbToken,
    });
  } else {
    await graphPost(`${cr.fbPageId}/photos`, {
      url: midia,
      caption: card.legenda ?? "",
      access_token: cr.fbToken,
    });
  }
}

/** Publica no Instagram (imagem no feed, ou Reels quando for video). */
async function publicarInstagram(cr: Credenciais, card: Card): Promise<void> {
  if (!cr.igUserId || !cr.fbToken) throw new Error("Instagram nao configurado para a marca");
  const midia = card.midiaUrl ?? "";
  const video = ehVideo(midia);

  // 1) Cria o container da midia.
  const criacao = await graphPost(`${cr.igUserId}/media`, {
    ...(video ? { media_type: "REELS", video_url: midia } : { image_url: midia }),
    caption: card.legenda ?? "",
    access_token: cr.fbToken,
  });
  const creationId = String(criacao.id ?? "");
  if (!creationId) throw new Error("Instagram nao retornou o id do container");

  // 2) Espera o processamento (video pode demorar). Ate ~10 tentativas.
  for (let i = 0; i < 10; i++) {
    const status = await graphGet(creationId, {
      fields: "status_code",
      access_token: cr.fbToken,
    });
    const code = String(status.status_code ?? "");
    if (code === "FINISHED") break;
    if (code === "ERROR" || code === "EXPIRED") {
      throw new Error(`Instagram nao processou a midia (status ${code})`);
    }
    if (i === 9) throw new Error("Instagram demorou para processar a midia, tente de novo");
    await dorme(video ? 5000 : 2000);
  }

  // 3) Publica o container.
  await graphPost(`${cr.igUserId}/media_publish`, {
    creation_id: creationId,
    access_token: cr.fbToken,
  });
}

interface Patch {
  statusPub: "publicado" | "erro";
  erroPub?: string;
  postadoEm?: string;
  publicar?: boolean; // mover etapa para publicado quando deu certo
}

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const servico = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !servico) {
    return new Response(JSON.stringify({ erro: "ambiente sem SUPABASE_URL/SERVICE_ROLE" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
  const sb = createClient(url, servico);

  // Le o quadro.
  const { data, error } = await sb.from("boards").select("dados").eq("id", ID_BOARD).maybeSingle();
  if (error) {
    return new Response(JSON.stringify({ erro: error.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
  const board = (data?.dados ?? { campanhas: [], cards: [] }) as Board;
  const marcaPorCampanha = new Map(board.campanhas.map((c) => [c.id, c.marca]));

  const agora = Date.now();
  const pendentes = board.cards
    .filter((c) => c.statusPub === "agendado")
    .filter((c) => (c.midiaUrl ?? "").trim() !== "")
    .filter((c) => c.canais.some((ca) => ca === "facebook" || ca === "instagram"))
    .filter((c) => {
      const t = instanteAgendado(c);
      return t !== null && t <= agora;
    })
    .slice(0, MAX_POR_EXECUCAO);

  const patches = new Map<string, Patch>();

  for (const card of pendentes) {
    const marca = marcaPorCampanha.get(card.campanhaId);
    if (!marca) {
      patches.set(card.id, { statusPub: "erro", erroPub: "Campanha sem marca definida" });
      continue;
    }
    const cr = credenciais(marca);
    const feitos: string[] = [];
    try {
      if (card.canais.includes("facebook")) {
        await publicarFacebook(cr, card);
        feitos.push("Facebook");
      }
      if (card.canais.includes("instagram")) {
        await publicarInstagram(cr, card);
        feitos.push("Instagram");
      }
      patches.set(card.id, {
        statusPub: "publicado",
        postadoEm: new Date().toISOString(),
        publicar: true,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const jaFoi = feitos.length ? ` Ja publicado em: ${feitos.join(", ")}.` : "";
      patches.set(card.id, {
        statusPub: "erro",
        erroPub: `${msg}.${jaFoi}`,
      });
    }
  }

  if (patches.size === 0) {
    return new Response(JSON.stringify({ verificados: pendentes.length, publicados: 0 }), {
      headers: { "content-type": "application/json" },
    });
  }

  // RE-LE o quadro fresco e aplica so os patches (nao sobrescreve edicoes do time).
  const { data: data2 } = await sb.from("boards").select("dados").eq("id", ID_BOARD).maybeSingle();
  const atual = (data2?.dados ?? board) as Board;
  const cardsAtualizados = atual.cards.map((c) => {
    const p = patches.get(c.id);
    if (!p) return c;
    return {
      ...c,
      statusPub: p.statusPub,
      erroPub: p.statusPub === "erro" ? p.erroPub : undefined,
      ...(p.publicar
        ? { etapa: "publicado", postadoEm: p.postadoEm ?? new Date().toISOString() }
        : {}),
    };
  });

  const novo: Board = { ...atual, cards: cardsAtualizados };
  const { error: erroSalvar } = await sb.from("boards").upsert({
    id: ID_BOARD,
    dados: novo,
    cliente_id: "robo-publicador",
    atualizado_em: new Date().toISOString(),
  });
  if (erroSalvar) {
    return new Response(JSON.stringify({ erro: erroSalvar.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const publicados = [...patches.values()].filter((p) => p.statusPub === "publicado").length;
  const erros = [...patches.values()].filter((p) => p.statusPub === "erro").length;
  return new Response(JSON.stringify({ verificados: pendentes.length, publicados, erros }), {
    headers: { "content-type": "application/json" },
  });
});
