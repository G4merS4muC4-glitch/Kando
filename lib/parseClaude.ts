import type { Canal, TipoConteudo } from "./types";
import { CANAIS_ORDEM } from "./config";

/**
 * Interpreta um texto colado (tipicamente gerado pelo Claude) e transforma em
 * um ou mais conteudos prontos para virar cards. Reconhece cabecalhos como
 * "Titulo:", "Tipo:", "Roteiro:", "Legenda:" etc. Se o texto nao tiver
 * cabecalhos, joga tudo no roteiro e usa a primeira linha como titulo.
 */

export interface ConteudoColado {
  titulo: string;
  tipo?: TipoConteudo;
  canais: Canal[];
  tema?: string;
  dataPublicacao?: string;
  briefing: string;
  roteiro: string;
  teleprompter: string;
  legenda: string;
  responsavel?: string;
}

/** Texto de ajuda mostrado no modal: como pedir ao Claude um conteudo colavel. */
export const FORMATO_SUGERIDO = `Titulo: ...
Tipo: Reels | Post | Carrossel | Stories | Material Rico | E-book | Projeto
Canais: Instagram, Facebook, LinkedIn, YouTube
Tema: ...
Data: dd/mm/aaaa
Briefing: ...
Roteiro: ...
Teleprompter: (apenas as falas, sem indicacoes de cena)
Legenda: ...`;

type Campo =
  | "titulo"
  | "tipo"
  | "canais"
  | "tema"
  | "data"
  | "briefing"
  | "roteiro"
  | "teleprompter"
  | "legenda"
  | "responsavel";

/** Limite de caracteres do titulo, usado nos dois caminhos do parser. */
const MAX_TITULO = 120;

// Sinonimos aceitos para cada campo (sem acento, minusculo).
// O match e por igualdade exata da etiqueta (antes do ":"), por isso incluimos
// as variantes de multiplas palavras mais comuns. Assim, frases de prosa que
// apenas comecam com uma palavra-chave (ex: "Tipo de post ideal para isso: ...")
// NAO sao confundidas com cabecalho.
const MAPA_CAMPOS: { campo: Campo; chaves: string[] }[] = [
  { campo: "titulo", chaves: ["titulo", "title", "assunto", "assunto do post"] },
  { campo: "tipo", chaves: ["tipo", "type", "formato", "tipo de conteudo", "tipo de post"] },
  { campo: "canais", chaves: ["canais", "canal", "channels", "plataformas", "plataforma", "redes", "rede"] },
  { campo: "tema", chaves: ["tema", "campanha", "pilar"] },
  { campo: "data", chaves: ["data de publicacao", "data", "publicacao", "agendamento", "quando", "agendar"] },
  { campo: "briefing", chaves: ["briefing", "brief", "objetivo", "contexto", "resumo"] },
  { campo: "roteiro", chaves: ["roteiro", "script", "fala", "estrutura", "slides", "storyboard"] },
  { campo: "teleprompter", chaves: ["teleprompter", "tp", "texto do teleprompter", "texto do tp"] },
  { campo: "legenda", chaves: ["legenda", "caption", "copy", "descricao"] },
  { campo: "responsavel", chaves: ["responsavel", "autor", "owner"] },
];

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Detecta se a linha e um cabecalho de campo conhecido. */
function detectarCabecalho(linha: string): { campo: Campo; resto: string } | null {
  // Remove marcadores de lista/markdown do inicio.
  const limpa = linha.replace(/^[\s>*#\-\d.)]+/, "");
  const idx = limpa.indexOf(":");
  if (idx === -1 || idx > 40) return null;
  const rotulo = semAcento(limpa.slice(0, idx).replace(/\*/g, ""));
  if (!rotulo) return null;
  for (const { campo, chaves } of MAPA_CAMPOS) {
    // Match por igualdade exata da etiqueta (evita confundir prosa com cabecalho).
    if (chaves.some((k) => rotulo === k)) {
      return { campo, resto: limpa.slice(idx + 1).trim() };
    }
  }
  return null;
}

function detectarTipo(texto: string): TipoConteudo | undefined {
  const t = semAcento(texto);
  if (t.includes("carrossel") || t.includes("carousel")) return "carrossel";
  if (t.includes("reels") || t.includes("reel")) return "reels";
  if (t.includes("stories") || t.includes("story")) return "stories";
  if (t.includes("projeto") || t.includes("project")) return "projeto";
  if (t.includes("ebook") || t.includes("e-book")) return "ebook";
  if (t.includes("material")) return "materialRico";
  if (t.includes("post")) return "post";
  return undefined;
}

function detectarCanais(texto: string): Canal[] {
  const t = semAcento(texto);
  const achados: Canal[] = [];
  // Apelidos inequivocos apenas (evita falsos positivos com "in" e "face").
  if (/instagram|insta|\big\b/.test(t)) achados.push("instagram");
  if (/facebook|\bfb\b/.test(t)) achados.push("facebook");
  if (/linkedin/.test(t)) achados.push("linkedin");
  if (/youtube|\byt\b|shorts/.test(t)) achados.push("youtube");
  // Mantem a ordem padrao e remove duplicatas.
  return CANAIS_ORDEM.filter((c) => achados.includes(c));
}

function detectarData(texto: string): string | undefined {
  const iso = texto.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = texto.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (br) {
    const dia = br[1].padStart(2, "0");
    const mes = br[2].padStart(2, "0");
    let ano = br[3];
    if (ano.length === 2) ano = `20${ano}`;
    return `${ano}-${mes}-${dia}`;
  }
  return undefined;
}

/** Indica se um trecho contem ao menos um cabecalho conhecido. */
function temCabecalho(trecho: string): boolean {
  return trecho.split(/\r?\n/).some((l) => detectarCabecalho(l) !== null);
}

/**
 * Quebra o texto em blocos (varios cards) usando linhas separadoras.
 * Para nao criar cards espurios quando o "---" e interno (assinatura, regua
 * markdown, separador de legenda), trechos sem nenhum cabecalho conhecido sao
 * anexados ao bloco anterior em vez de virar um card proprio.
 */
function dividirBlocos(texto: string): string[] {
  const partes = texto
    .split(/^\s*(?:[-=*_]{3,})\s*$/m)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  if (partes.length <= 1) return [texto.trim()];

  const blocos: string[] = [];
  for (const parte of partes) {
    if (blocos.length > 0 && !temCabecalho(parte)) {
      // Continuacao do bloco anterior (ex: assinatura apos um "---").
      blocos[blocos.length - 1] += `\n\n${parte}`;
    } else {
      blocos.push(parte);
    }
  }
  return blocos;
}

function interpretarBloco(bloco: string): ConteudoColado | null {
  if (!bloco.trim()) return null;
  const linhas = bloco.split(/\r?\n/);
  const buffers: Partial<Record<Campo, string[]>> = {};
  const preambulo: string[] = [];
  let atual: Campo | null = null;
  let achouCabecalho = false;

  for (const linha of linhas) {
    const cab = detectarCabecalho(linha);
    if (cab) {
      achouCabecalho = true;
      atual = cab.campo;
      if (!buffers[atual]) buffers[atual] = [];
      if (cab.resto) buffers[atual]!.push(cab.resto);
    } else if (atual) {
      buffers[atual]!.push(linha);
    } else if (linha.trim()) {
      preambulo.push(linha.trim());
    }
  }

  const texto = (c: Campo) => (buffers[c] ?? []).join("\n").trim();

  // Sem nenhum cabecalho: trata como conteudo solto (vai para o roteiro).
  if (!achouCabecalho) {
    const primeira = preambulo[0] ?? "Conteudo colado";
    return {
      titulo: primeira.slice(0, MAX_TITULO),
      canais: [],
      briefing: "",
      roteiro: bloco.trim(),
      teleprompter: "",
      legenda: "",
    };
  }

  const titulo = texto("titulo") || preambulo[0] || "Conteudo colado";
  const briefing = texto("briefing");
  const roteiro = texto("roteiro");
  const teleprompter = texto("teleprompter");
  const legenda = texto("legenda");
  // Rede de seguranca: se nenhum campo de conteudo foi preenchido, preserva o
  // texto original do bloco no roteiro (evita perda silenciosa de conteudo).
  const semConteudo = !briefing && !roteiro && !teleprompter && !legenda;

  return {
    titulo: titulo.slice(0, MAX_TITULO),
    tipo: detectarTipo(texto("tipo")),
    canais: detectarCanais(texto("canais")),
    tema: texto("tema") || undefined,
    dataPublicacao: detectarData(texto("data")),
    briefing,
    roteiro: semConteudo ? bloco.trim() : roteiro,
    teleprompter,
    legenda,
    responsavel: texto("responsavel") || undefined,
  };
}

export function parseClaude(texto: string): ConteudoColado[] {
  return dividirBlocos(texto)
    .map(interpretarBloco)
    .filter((c): c is ConteudoColado => c !== null);
}
