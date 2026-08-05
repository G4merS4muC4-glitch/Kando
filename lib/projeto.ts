/**
 * Funcoes puras (sem React) para os cards do tipo "projeto".
 * Lidam com o fluxo de producao: fases (etapas) e tarefas marcaveis dentro
 * de cada fase. A ordem e sempre posicional (indice no array), igual ao padrao
 * do quadro, para combinar com o arrayMove do dnd-kit.
 */

import { arrayMove } from "@dnd-kit/sortable";
import type { ProjetoDados, ProjetoFase } from "./types";
import { gerarId } from "./util";

/**
 * Interpreta um roteiro em texto (tipico do "Colar do Claude") como as FASES e
 * as TAREFAS de um projeto. Linhas que comecam com "FASE" viram fases; as demais
 * viram tarefas da fase corrente. Uma tarefa que comeca com "!" e marcada como
 * critica. Retorna null quando nao ha nada aproveitavel (o chamador cai no
 * projeto vazio padrao).
 */
export function projetoDeRoteiro(roteiro: string): ProjetoDados | null {
  if (!roteiro || !roteiro.trim()) return null;

  const ehCabecalhoFase = (l: string) => /^\s*(?:#+\s*)?fase\b/i.test(l);
  const nomeDaFase = (l: string) => l.replace(/^\s*#+\s*/, "").trim();
  const limparTarefa = (l: string): { texto: string; critico: boolean } => {
    let t = l.trim();
    t = t.replace(/^[-*•]\s+/, ""); // marcador de lista antes do texto
    let critico = false;
    if (t.startsWith("!")) {
      critico = true;
      t = t.replace(/^!+\s*/, "");
    }
    return { texto: t.trim(), critico };
  };

  const fases: ProjetoFase[] = [];
  let atual: ProjetoFase | null = null;
  for (const linha of roteiro.split(/\r?\n/)) {
    if (!linha.trim()) continue;
    if (ehCabecalhoFase(linha)) {
      atual = { id: gerarId(), nome: nomeDaFase(linha), tarefas: [] };
      fases.push(atual);
      continue;
    }
    const { texto, critico } = limparTarefa(linha);
    if (!texto) continue;
    if (!atual) {
      // Tarefas antes de qualquer "FASE": caem numa fase implicita.
      atual = { id: gerarId(), nome: "Tarefas", tarefas: [] };
      fases.push(atual);
    }
    atual.tarefas.push({ id: gerarId(), texto, feita: false, ...(critico ? { critico: true } : {}) });
  }

  if (fases.length === 0 || fases.every((f) => f.tarefas.length === 0)) return null;
  return { fases };
}

/** Calcula o percentual a partir de feitas/total, sempre seguro (nunca NaN). */
function percentual(feitas: number, total: number): number {
  return total === 0 ? 0 : Math.round((feitas / total) * 100);
}

/**
 * Projeto inicial sugerido: tres fases de producao vazias, em portugues.
 * Usado como rascunho local ao abrir a aba pela primeira vez; so e persistido
 * quando o usuario faz a primeira alteracao (ver AbaProjeto).
 */
export function criarProjetoVazio(): ProjetoDados {
  return {
    fases: [
      { id: gerarId(), nome: "Pesquisa", tarefas: [] },
      { id: gerarId(), nome: "Produção", tarefas: [] },
      { id: gerarId(), nome: "Revisão", tarefas: [] },
    ],
  };
}

/** Progresso de uma fase: total de tarefas, quantas estao feitas e o percentual. */
export function faseProgresso(fase: ProjetoFase): {
  total: number;
  feitas: number;
  pct: number;
} {
  const total = fase.tarefas.length;
  const feitas = fase.tarefas.filter((t) => t.feita).length;
  return { total, feitas, pct: percentual(feitas, total) };
}

/**
 * Progresso geral do projeto, somando todas as fases. Tolera projeto indefinido
 * (card recem-criado, antes de qualquer edicao) retornando tudo zerado.
 */
export function contarProgresso(projeto: ProjetoDados | undefined): {
  total: number;
  feitas: number;
  pct: number;
  fases: number;
} {
  const fases = projeto?.fases ?? [];
  let total = 0;
  let feitas = 0;
  for (const fase of fases) {
    total += fase.tarefas.length;
    feitas += fase.tarefas.filter((t) => t.feita).length;
  }
  return { total, feitas, pct: percentual(feitas, total), fases: fases.length };
}

/**
 * Move uma tarefa apos um arraste, reordenando dentro da mesma fase ou movendo
 * para outra fase. overId pode ser o id de outra tarefa (cai naquela posicao)
 * ou o id de uma fase (cai no fim daquela fase, util para fase vazia).
 * Espelha a logica de moverCardNoBoard do quadro principal.
 */
export function moverTarefa(
  projeto: ProjetoDados,
  activeId: string,
  overId: string
): ProjetoDados {
  if (activeId === overId) return projeto;
  const { fases } = projeto;

  // Localiza a fase de origem e a posicao da tarefa arrastada.
  let origemIdx = -1;
  let tarefaIdx = -1;
  for (let i = 0; i < fases.length; i++) {
    const j = fases[i].tarefas.findIndex((t) => t.id === activeId);
    if (j !== -1) {
      origemIdx = i;
      tarefaIdx = j;
      break;
    }
  }
  if (origemIdx === -1) return projeto;
  const tarefa = fases[origemIdx].tarefas[tarefaIdx];

  // Localiza a fase de destino e o indice de insercao.
  let destinoIdx = -1;
  let insercao = -1;
  let sobreTarefa = false; // soltou exatamente sobre outra tarefa?
  for (let i = 0; i < fases.length; i++) {
    const j = fases[i].tarefas.findIndex((t) => t.id === overId);
    if (j !== -1) {
      destinoIdx = i;
      insercao = j;
      sobreTarefa = true;
      break;
    }
  }
  if (destinoIdx === -1) {
    // overId pode ser o id de uma fase (soltou na lane, possivelmente vazia).
    const fi = fases.findIndex((f) => f.id === overId);
    if (fi === -1) return projeto;
    destinoIdx = fi;
    insercao = fases[fi].tarefas.length;
  }

  // Caso 1: reordenar dentro da mesma fase, apenas quando soltou sobre outra
  // tarefa. Soltar no espaco vazio da propria lane nao deve jogar a tarefa para
  // o fim (mantem a posicao, igual ao comportamento do quadro principal).
  if (origemIdx === destinoIdx) {
    if (!sobreTarefa) return projeto;
    const reordenada = arrayMove(fases[origemIdx].tarefas, tarefaIdx, insercao);
    return {
      ...projeto,
      fases: fases.map((f, i) => (i === origemIdx ? { ...f, tarefas: reordenada } : f)),
    };
  }

  // Caso 2: mover para outra fase.
  const tarefasOrigem = fases[origemIdx].tarefas.filter((t) => t.id !== activeId);
  const tarefasDestino = [...fases[destinoIdx].tarefas];
  tarefasDestino.splice(insercao, 0, tarefa);
  return {
    ...projeto,
    fases: fases.map((f, i) => {
      if (i === origemIdx) return { ...f, tarefas: tarefasOrigem };
      if (i === destinoIdx) return { ...f, tarefas: tarefasDestino };
      return f;
    }),
  };
}

/** Reordena as fases (lanes) apos um arraste do cabecalho da fase. */
export function moverFase(projeto: ProjetoDados, ativaId: string, sobreId: string): ProjetoDados {
  if (ativaId === sobreId) return projeto;
  const de = projeto.fases.findIndex((f) => f.id === ativaId);
  const para = projeto.fases.findIndex((f) => f.id === sobreId);
  if (de === -1 || para === -1) return projeto;
  return { ...projeto, fases: arrayMove(projeto.fases, de, para) };
}
