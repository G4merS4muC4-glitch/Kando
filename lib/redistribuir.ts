/**
 * Planejador (puro) da redistribuicao automatica de conteudos pelo calendario.
 *
 * O usuario define REGRAS por semana (marca e/ou tipo + quantidade). O plano
 * espalha os cards candidatos pelas proximas semanas, respeitando as cotas de
 * cada regra e distribuindo dentro dos dias permitidos da semana. Nao decide
 * quais cards sao candidatos (isso vem de fora, ja filtrado): so monta o plano.
 */

import type { CardConteudo, Marca, Prioridade, TipoConteudo } from "./types";
import { chaveData, dataDeISO } from "./util";

/** Uma regra de cota semanal. marca/tipo ausentes = "qualquer". */
export interface RegraDistribuicao {
  id: string;
  marca?: Marca; // undefined = qualquer marca
  tipo?: TipoConteudo; // undefined = qualquer tipo
  porSemana: number; // quantos desta regra por semana
}

export interface PlanoItem {
  cardId: string;
  data: string; // ISO yyyy-mm-dd
}

function pesoPrioridade(p?: Prioridade): number {
  return p === "urgente" ? 4 : p === "alta" ? 3 : p === "media" ? 2 : p === "baixa" ? 1 : 0;
}

function somarDias(iso: string, dias: number): string {
  const d = dataDeISO(iso);
  d.setDate(d.getDate() + dias);
  return chaveData(d);
}

/**
 * Monta o plano de datas para os candidatos, segundo as regras.
 * - candidatos: cards que podem ser (re)agendados (ja filtrados: ativos, nao publicados).
 * - marcaDoCard: resolve a marca de um card.
 * - regras: cotas por semana (na ordem: a 1a regra escolhe primeiro).
 * - semanas: por quantas semanas espalhar, a partir de inicioISO.
 * - inicioISO: primeiro dia (normalmente hoje).
 * - soDiasUteis: quando true, pula sabado e domingo.
 * Retorna so os cards que entraram em alguma cota; os demais ficam como estao.
 */
export function planejarDistribuicao(
  candidatos: CardConteudo[],
  marcaDoCard: (c: CardConteudo) => Marca | undefined,
  regras: RegraDistribuicao[],
  semanas: number,
  inicioISO: string,
  soDiasUteis = false
): PlanoItem[] {
  // Ordem de preferencia: prioridade, depois sem data primeiro, depois data e criacao.
  const ordenados = [...candidatos].sort(
    (a, b) =>
      pesoPrioridade(b.prioridade) - pesoPrioridade(a.prioridade) ||
      Number(!!a.dataPublicacao) - Number(!!b.dataPublicacao) ||
      (a.dataPublicacao ?? "").localeCompare(b.dataPublicacao ?? "") ||
      (a.criadoEm ?? "").localeCompare(b.criadoEm ?? "")
  );

  const usados = new Set<string>();
  const plano: PlanoItem[] = [];

  for (let w = 0; w < semanas; w++) {
    // Dias permitidos desta semana (a partir do inicio), pulando fim de semana se pedido.
    const dias: string[] = [];
    for (let d = 0; d < 7; d++) {
      const data = somarDias(inicioISO, w * 7 + d);
      if (soDiasUteis) {
        const dow = dataDeISO(data).getDay(); // 0 = domingo, 6 = sabado
        if (dow === 0 || dow === 6) continue;
      }
      dias.push(data);
    }
    if (dias.length === 0) continue;

    // Seleciona os cards da semana conforme as cotas (respeitando a ordem das regras).
    const daSemana: CardConteudo[] = [];
    for (const r of regras) {
      if (r.porSemana <= 0) continue;
      let n = 0;
      for (const c of ordenados) {
        if (n >= r.porSemana) break;
        if (usados.has(c.id)) continue;
        if (r.marca && marcaDoCard(c) !== r.marca) continue;
        if (r.tipo && c.tipo !== r.tipo) continue;
        usados.add(c.id);
        daSemana.push(c);
        n += 1;
      }
    }

    // Espalha os selecionados pelos dias permitidos da semana.
    const k = daSemana.length;
    daSemana.forEach((c, i) => {
      const idx = k > 0 ? Math.min(Math.floor((i * dias.length) / k), dias.length - 1) : 0;
      plano.push({ cardId: c.id, data: dias[idx] });
    });
  }

  return plano;
}
