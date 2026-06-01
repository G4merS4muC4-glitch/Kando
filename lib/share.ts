/**
 * Tipos e funcoes puras (isomorficas: navegador e servidor) do compartilhamento
 * publico de cards. Nada aqui depende de React, do cliente do navegador ou de
 * APIs so-do-servidor, entao pode ser importado dos dois lados.
 */

import type { Canal, CardConteudo, ProjetoDados, TipoConteudo } from "./types";

/** Quais blocos do card ficam visiveis no link publico. */
export interface VisibilidadeShare {
  visaoGeral: boolean;
  briefing: boolean;
  roteiro: boolean;
  teleprompter: boolean;
  legenda: boolean;
  projeto: boolean;
}

export const BLOCOS: { chave: keyof VisibilidadeShare; rotulo: string }[] = [
  { chave: "visaoGeral", rotulo: "Visao geral (tipo, canais, tema, data)" },
  { chave: "briefing", rotulo: "Briefing" },
  { chave: "roteiro", rotulo: "Roteiro completo" },
  { chave: "teleprompter", rotulo: "Teleprompter (as falas)" },
  { chave: "legenda", rotulo: "Legenda" },
  { chave: "projeto", rotulo: "Projeto (fases e tarefas)" },
];

/** Padrao pensado para enviar ao ator/gravacao. */
export const VISIBILIDADE_PADRAO: VisibilidadeShare = {
  visaoGeral: true,
  briefing: false,
  roteiro: true,
  teleprompter: true,
  legenda: false,
  projeto: false,
};

/** Linha da tabela compartilhamentos (como vem do Supabase). */
export interface Compartilhamento {
  token: string;
  card_id: string;
  campanha_id: string | null;
  visibilidade: VisibilidadeShare;
  edicao_teleprompter: boolean;
  pin_hash: string | null;
  expira_em: string | null;
  revogado: boolean;
  criado_em: string;
}

/** Linha completa (inclui os campos de controle de taxa), usada no servidor. */
export interface CompartilhamentoCompleto extends Compartilhamento {
  pin_erros: number;
  bloqueado_ate: string | null;
  escritas_janela: number;
  janela_inicio: string | null;
  ultima_escrita: string | null;
}

/** Card filtrado para exibicao publica (so os blocos liberados). */
export interface CardPublico {
  titulo: string;
  tipo: TipoConteudo;
  visaoGeral?: { canais: Canal[]; tema?: string; dataPublicacao?: string; responsavel?: string };
  briefing?: string;
  roteiro?: string;
  teleprompter?: string;
  legenda?: string;
  projeto?: ProjetoDados;
}

export const MAX_TELEPROMPTER = 20000;

/** Gera um token aleatorio e dificil de adivinhar para a URL do link. */
export function gerarToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// PIN guardado com PBKDF2-SHA256 (KDF lento) no formato "salt:iteracoes:hash".
// Lento de proposito: se o hash vazar, forca bruta de um PIN curto fica cara.
const PBKDF2_ITER = 100000;

function emHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function derivar(pin: string, salt: string, iteracoes: number): Promise<string> {
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: iteracoes, hash: "SHA-256" },
    chave,
    256
  );
  return emHex(bits);
}

/** Comparacao em tempo constante (hashes tem tamanho fixo). */
function igualConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Gera "salt:iteracoes:hash" para guardar um PIN com seguranca. */
export async function hashPin(pin: string): Promise<string> {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = emHex(saltBytes.buffer);
  const hash = await derivar(pin, salt, PBKDF2_ITER);
  return `${salt}:${PBKDF2_ITER}:${hash}`;
}

/** Confere um PIN contra um "salt:iteracoes:hash" salvo, em tempo constante. */
export async function pinConfere(pin: string, pinHash: string): Promise<boolean> {
  const partes = pinHash.split(":");
  if (partes.length !== 3) return false;
  const [salt, iterStr, hash] = partes;
  const iter = parseInt(iterStr, 10);
  if (!salt || !hash || !Number.isFinite(iter) || iter <= 0) return false;
  const calc = await derivar(pin, salt, iter);
  return igualConstante(calc, hash);
}

/** Indica se o link ja passou da validade. */
export function estaExpirado(expiraEm: string | null | undefined): boolean {
  if (!expiraEm) return false;
  const t = new Date(expiraEm).getTime();
  return !Number.isNaN(t) && t < Date.now();
}

/** Reduz o card aos blocos liberados (usado pelo endpoint publico). */
export function cardVisivel(card: CardConteudo, vis: VisibilidadeShare): CardPublico {
  const pub: CardPublico = { titulo: card.titulo, tipo: card.tipo };
  if (vis.visaoGeral) {
    pub.visaoGeral = {
      canais: card.canais,
      tema: card.tema || undefined,
      dataPublicacao: card.dataPublicacao,
      responsavel: card.responsavel || undefined,
    };
  }
  if (vis.briefing) pub.briefing = card.briefing;
  if (vis.roteiro) pub.roteiro = card.roteiro;
  if (vis.teleprompter) pub.teleprompter = card.teleprompter ?? "";
  if (vis.legenda) pub.legenda = card.legenda;
  if (vis.projeto) pub.projeto = card.projeto;
  return pub;
}

// Caracteres de controle proibidos (mantem tab \t, nova linha \n e retorno \r).
const CONTROLE = new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]", "g");

/**
 * Limpa o texto recebido do publico: remove caracteres de controle e corta no
 * tamanho maximo. A exibicao em React ja escapa HTML, entao nao ha injecao.
 */
export function higienizarTexto(texto: string): string {
  return texto.replace(CONTROLE, "").slice(0, MAX_TELEPROMPTER);
}
