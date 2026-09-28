/**
 * Sugestao de cards pelo que se digita no timer, sem IA: regras simples e
 * previsiveis sobre os dados que ja existem no quadro e nas horas.
 *
 * - Compara palavra a palavra, sem acento nem maiuscula ("reuniao" acha "Reunião").
 * - Aceita palavra pela metade (ainda digitando), plural ("reels" x "Reel"), mesma
 *   raiz ("gravando" x "Gravação") e um erro de digitacao ("natl" x "Natal").
 * - Ignora palavras de ligacao ("de", "do", "para"...): da para escrever uma frase
 *   ("gravando o reel do natal") e ainda achar o card "Reel Natal".
 * - Alem do titulo, olha tema, tarefas do projeto, o que ja foi anotado nos pontos
 *   daquele card (aprende com o historico da equipe), campanha e tipo.
 * - Desempata pelo SEU uso: o card em que voce apontou hoje/na semana sobe.
 *
 * Tudo puro (sem React nem config de interface), para testar e reaproveitar.
 */

import type { CardConteudo, RegistroTempo, TipoConteudo } from "./types";

const DIA_MS = 86_400_000;

// Palavras de ligacao: nao identificam card nenhum (so atrapalhariam a busca).
const LIGACAO = new Set([
  "a", "o", "as", "os", "ao", "aos", "um", "uma", "uns", "umas",
  "de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas",
  "para", "pra", "pro", "pras", "pros", "com", "por", "pelo", "pela", "pelos", "pelas",
  "que", "se", "ou", "sobre", "ate", "meu", "minha",
]);

/** Uma palavra ja normalizada. `ini` = posicao no titulo (-1 fora do titulo). */
interface Palavra {
  txt: string;
  ini: number;
}

/** Um lugar do card onde procurar, com o quanto um acerto ali vale. */
interface Campo {
  palavras: Palavra[];
  peso: number; // titulo = 1; os demais valem menos
  titulo?: boolean; // acertos aqui viram destaque no nome
  motivo?: string; // explica a sugestao quando o nome em si nao casou
}

export interface CardIndexado {
  card: CardConteudo;
  titulo: string; // titulo para exibir (as posicoes dos destaques se referem a ele)
  campos: Campo[];
  palavrasTitulo: number; // palavras "de conteudo" do titulo (sem as de ligacao)
  ultimoUsoMs: number; // meu ultimo apontamento neste card (0 = nunca)
  usos: number; // quantos apontamentos meus
  postado: boolean;
}

export interface SugestaoCard {
  card: CardConteudo;
  titulo: string;
  destaques: [number, number][]; // trechos do titulo que casaram: [inicio, fim)
  motivo?: string; // por que apareceu, quando nao foi pelo nome
  sobra: boolean; // o texto tem palavras alem do nome do card (vale guardar como nota)
  pontos: number;
}

interface Casamento {
  nota: number; // 0 a 1
  ini: number; // trecho da palavra que casou (para destacar)
  fim: number;
}

const NADA: Casamento = { nota: 0, ini: 0, fim: 0 };

/**
 * Tira acento e caixa letra a letra, sem mudar o tamanho do texto (assim a
 * posicao de cada palavra continua valendo no texto original, para destacar).
 */
export function normalizar(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    const base = c.normalize("NFD")[0] ?? c;
    out += base.toLowerCase()[0] ?? base;
  }
  return out;
}

function palavras(s: string): Palavra[] {
  const n = normalizar(s);
  const out: Palavra[] = [];
  const re = /[a-z0-9]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(n))) out.push({ txt: m[0], ini: m.index });
  return out;
}

/** Palavras que contam numa busca: sem as de ligacao e sem letra solta (numero vale). */
export function termosDaBusca(texto: string): string[] {
  const vistos = new Set<string>();
  for (const p of palavras(texto.normalize("NFC"))) {
    if (LIGACAO.has(p.txt)) continue;
    if (p.txt.length < 2 && !/^\d+$/.test(p.txt)) continue;
    vistos.add(p.txt);
  }
  return [...vistos];
}

function prefixoComum(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/** Distancia de edicao com troca de letras vizinhas; para cedo acima de `max`. */
function distancia(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let menorDaLinha = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + custo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, d[i - 2][j - 2] + 1);
      }
      d[i][j] = v;
      if (v < menorDaLinha) menorDaLinha = v;
    }
    if (menorDaLinha > max) return max + 1;
  }
  return d[a.length][b.length];
}

/** O quanto o termo digitado `q` casa com a palavra `w` do card. */
function comparar(q: string, w: string): Casamento {
  if (w === q) return { nota: 1, ini: 0, fim: w.length };
  // Ainda digitando: "gra" -> "gravacao".
  if (w.startsWith(q)) return { nota: q.length >= 3 ? 0.9 : 0.75, ini: 0, fim: q.length };
  // Numero so casa exato ou pelo comeco (2026 nao e "quase" 2025).
  if (/^\d+$/.test(q)) return NADA;
  // Plural/sufixo: "reels" -> "reel".
  if (w.length >= 3 && q.startsWith(w)) return { nota: 0.75, ini: 0, fim: w.length };
  // Mesma raiz: "gravando" -> "gravacao", "reuniao" -> "reunioes".
  const pre = prefixoComum(q, w);
  if (pre >= 4 && pre >= Math.min(q.length, w.length) * 0.6) return { nota: 0.7, ini: 0, fim: pre };
  if (q.length >= 4) {
    // Um erro de digitacao (dois nas palavras longas), no comeco ou na palavra toda.
    const max = q.length >= 8 ? 2 : 1;
    const comeco = w.slice(0, q.length);
    if (distancia(q, comeco, max) <= max) return { nota: 0.6, ini: 0, fim: comeco.length };
    if (comeco !== w && distancia(q, w, max) <= max) return { nota: 0.6, ini: 0, fim: w.length };
    // No meio da palavra: "natal" em "prenatal".
    const pos = w.indexOf(q);
    if (pos > 0) return { nota: 0.5, ini: pos, fim: pos + q.length };
  }
  return NADA;
}

export interface DadosIndice {
  cards: CardConteudo[];
  campanhas: { id: string; nome: string; arquivada: boolean }[];
  registros: RegistroTempo[];
  autorId: string; // quem esta digitando (o uso dele pesa na ordem)
  postadoId: string; // etapa de Publicado
  rotuloTipo: (tipo: TipoConteudo) => string;
}

/**
 * Prepara os cards para a busca (uma vez por mudanca no quadro ou nas horas, nao
 * a cada tecla). Cards de campanha arquivada ficam de fora.
 */
export function indexarCards(d: DadosIndice): CardIndexado[] {
  const campanhas = new Map(d.campanhas.map((c) => [c.id, c]));

  // Historico: o que ja foi anotado em cada card (nota e pontos, menos os
  // automaticos genericos de pausa/etapa) e o MEU uso de cada card.
  const textos = new Map<string, string[]>();
  const uso = new Map<string, { ultimo: number; vezes: number }>();
  for (const r of d.registros) {
    if (!r.cardId) continue;
    const lista = textos.get(r.cardId) ?? [];
    if (r.nota) lista.push(r.nota);
    for (const cp of r.checkpoints ?? []) {
      if (cp.pausaMs || cp.tipo === "pausa" || cp.tipo === "etapa") continue;
      lista.push(cp.texto);
    }
    textos.set(r.cardId, lista);
    if (r.autorId === d.autorId) {
      const u = uso.get(r.cardId) ?? { ultimo: 0, vezes: 0 };
      const fim = new Date(r.fim).getTime();
      if (Number.isFinite(fim) && fim > u.ultimo) u.ultimo = fim;
      u.vezes += 1;
      uso.set(r.cardId, u);
    }
  }

  // Palavra do historico que aparece em muitos cards ("ajuste", "revisao") nao
  // ajuda a escolher um: so contam as que marcam poucos cards.
  const historico = new Map<string, string[]>();
  const emQuantos = new Map<string, number>();
  for (const [id, lista] of textos) {
    const unicas = [...new Set(lista.flatMap(termosDaBusca))].filter((w) => w.length >= 3);
    historico.set(id, unicas);
    for (const w of unicas) emQuantos.set(w, (emQuantos.get(w) ?? 0) + 1);
  }
  const limiteRepeticao = Math.max(3, Math.ceil(historico.size * 0.25));

  const out: CardIndexado[] = [];
  for (const card of d.cards) {
    const camp = campanhas.get(card.campanhaId);
    if (!camp || camp.arquivada) continue;
    const titulo = (card.titulo || "").normalize("NFC");
    const doTitulo = palavras(titulo).filter((p) => !LIGACAO.has(p.txt));
    const jaNoTitulo = new Set(doTitulo.map((p) => p.txt));
    const fora = (lista: string[]): Palavra[] =>
      [...new Set(lista)].filter((w) => !jaNoTitulo.has(w)).map((txt) => ({ txt, ini: -1 }));

    const tarefas = (card.projeto?.fases ?? []).flatMap((f) => [f.nome, ...f.tarefas.map((t) => t.texto)]);
    const hist = (historico.get(card.id) ?? []).filter((w) => (emQuantos.get(w) ?? 0) <= limiteRepeticao);

    const campos: Campo[] = [
      { palavras: doTitulo, peso: 1, titulo: true },
      { palavras: fora(termosDaBusca(card.tema ?? "")), peso: 0.75, motivo: "pelo tema" },
      { palavras: fora(tarefas.flatMap(termosDaBusca)), peso: 0.6, motivo: "tarefa do projeto" },
      { palavras: fora(hist), peso: 0.6, motivo: "já anotado neste card" },
      { palavras: fora(termosDaBusca(camp.nome)), peso: 0.45 },
      { palavras: fora(termosDaBusca(d.rotuloTipo(card.tipo))), peso: 0.4 },
    ];

    const u = uso.get(card.id);
    out.push({
      card,
      titulo: titulo || "Sem título",
      campos: campos.filter((c) => c.palavras.length > 0),
      palavrasTitulo: doTitulo.length,
      ultimoUsoMs: u?.ultimo ?? 0,
      usos: u?.vezes ?? 0,
      postado: card.etapa === d.postadoId,
    });
  }
  return out;
}

/** Quanto o meu uso recente e frequente empurra o card para cima. */
function bonusUso(ci: CardIndexado, agoraMs: number): number {
  if (!ci.ultimoUsoMs) return 0;
  const dias = (agoraMs - ci.ultimoUsoMs) / DIA_MS;
  const recencia = dias < 1 ? 0.2 : dias < 7 ? 0.12 : dias < 30 ? 0.05 : 0;
  return recencia + Math.min(0.08, Math.log2(1 + ci.usos) * 0.02);
}

/** Junta trechos sobrepostos e ordena (para destacar sem repetir letra). */
function juntar(trechos: [number, number][]): [number, number][] {
  const ord = [...trechos].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const t of ord) {
    const ult = out[out.length - 1];
    if (ult && t[0] <= ult[1]) ult[1] = Math.max(ult[1], t[1]);
    else out.push([t[0], t[1]]);
  }
  return out;
}

/** O melhor acerto de um termo digitado dentro de um card. */
interface AcertoTermo {
  nota: number;
  campo: Campo | null;
  idx: number; // palavra do campo que casou
  cas: Casamento;
}

function melhorAcerto(q: string, ci: CardIndexado): AcertoTermo {
  let melhor: AcertoTermo = { nota: 0, campo: null, idx: -1, cas: NADA };
  for (const campo of ci.campos) {
    for (let i = 0; i < campo.palavras.length; i++) {
      const cas = comparar(q, campo.palavras[i].txt);
      const nota = cas.nota * campo.peso;
      if (nota > melhor.nota) melhor = { nota, campo, idx: i, cas };
    }
  }
  return melhor;
}

/**
 * Cards que combinam com o texto digitado, do mais provavel ao menos. Precisa
 * que ao menos uma palavra case bem e que o texto, no geral, tenha a ver com o
 * card (uma frase longa acha o card por duas ou tres palavras dela).
 *
 * Palavra rara pesa mais que palavra comum: se "reels" esta em metade dos cards
 * e "phishing" em um so, "gravando o reels do phishing" aponta para aquele um.
 */
export function sugerirCards(
  texto: string,
  indice: CardIndexado[],
  opcoes: { excluirId?: string; agoraMs: number; limite?: number }
): SugestaoCard[] {
  const termos = termosDaBusca(texto);
  if (termos.length === 0) return [];

  const candidatos = indice.filter((ci) => ci.card.id !== opcoes.excluirId);
  const acertos = candidatos.map((ci) => termos.map((q) => melhorAcerto(q, ci)));
  // Peso de cada termo pela raridade: em quantos cards ele casa (1 card = 1;
  // 3 cards = 0,39; 8 cards = 0,25). Termo que nao casa em nada mantem peso 1
  // (as palavras "a mais" da frase continuam contando contra).
  const pesos = termos.map((_, t) => {
    const emQuantos = acertos.reduce((n, a) => (a[t].nota >= 0.5 ? n + 1 : n), 0);
    return 1 / (1 + Math.log2(Math.max(1, emQuantos)));
  });
  const pesoTotal = pesos.reduce((s, p) => s + p, 0);

  const res: SugestaoCard[] = [];
  candidatos.forEach((ci, c) => {
    let soma = 0;
    let melhorDeTodos = 0;
    let sobra = false;
    let motivo: string | undefined;
    const destaques: [number, number][] = [];
    const casadasNoTitulo = new Set<number>();

    termos.forEach((_, t) => {
      const { nota, campo, idx, cas } = acertos[c][t];
      soma += nota * pesos[t];
      if (nota > melhorDeTodos) melhorDeTodos = nota;
      if (campo?.titulo && nota >= 0.6) {
        casadasNoTitulo.add(idx);
        const p = campo.palavras[idx];
        if (cas.fim > cas.ini) destaques.push([p.ini + cas.ini, p.ini + cas.fim]);
      } else {
        sobra = true;
        if (!motivo && campo?.motivo && nota >= 0.5) motivo = campo.motivo;
      }
    });

    const cobertura = soma / pesoTotal;
    if (melhorDeTodos < 0.5 || cobertura < 0.3) return;
    // Titulo curto todo coberto ("Natal") ganha de titulo longo com a mesma palavra.
    const especificidade = ci.palavrasTitulo > 0 ? casadasNoTitulo.size / ci.palavrasTitulo : 0;
    const pontos =
      cobertura + 0.15 * especificidade + bonusUso(ci, opcoes.agoraMs) - (ci.postado ? 0.1 : 0);
    res.push({
      card: ci.card,
      titulo: ci.titulo,
      destaques: juntar(destaques),
      motivo: casadasNoTitulo.size === 0 ? motivo : undefined,
      sobra,
      pontos,
    });
  });

  return res
    .sort((a, b) => b.pontos - a.pontos || a.titulo.localeCompare(b.titulo, "pt-BR"))
    .slice(0, opcoes.limite ?? 5);
}

/** Os cards em que eu apontei por ultimo (para escolher sem digitar nada). */
export function cardsRecentes(
  indice: CardIndexado[],
  opcoes: { excluirId?: string; limite?: number }
): SugestaoCard[] {
  return indice
    .filter((ci) => ci.ultimoUsoMs > 0 && ci.card.id !== opcoes.excluirId)
    .sort((a, b) => b.ultimoUsoMs - a.ultimoUsoMs)
    .slice(0, opcoes.limite ?? 4)
    .map((ci) => ({ card: ci.card, titulo: ci.titulo, destaques: [], sobra: false, pontos: 0 }));
}

/** Quebra o titulo em pedacos normais e destacados, para exibir. */
export function trechosDestacados(
  titulo: string,
  destaques: [number, number][]
): { txt: string; destaque: boolean }[] {
  const out: { txt: string; destaque: boolean }[] = [];
  let pos = 0;
  for (const [ini, fim] of destaques) {
    if (ini > pos) out.push({ txt: titulo.slice(pos, ini), destaque: false });
    out.push({ txt: titulo.slice(ini, fim), destaque: true });
    pos = fim;
  }
  if (pos < titulo.length) out.push({ txt: titulo.slice(pos), destaque: false });
  return out;
}
