"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { arrayMove } from "@dnd-kit/sortable";
import type {
  Board,
  Campanha,
  CardConteudo,
  Etapa,
  Marca,
  StatusCampanha,
  TipoCampanha,
  TipoConteudo,
} from "./types";
import { ETAPAS } from "./config";
import { criarProjetoVazio } from "./projeto";
import { assinarBoard, carregarBoard, salvarBoard } from "./storage";
import { agora, gerarId } from "./util";

/**
 * Estado central da aplicacao.
 *
 * Usa useReducer + Context e persiste automaticamente no localStorage a cada
 * alteracao (atraves da camada isolada em storage.ts). Para trocar a
 * persistencia por um banco no futuro, basta mudar storage.ts.
 */

type Acao =
  | { tipo: "INICIALIZAR"; board: Board }
  | { tipo: "ADD_CAMPANHA"; campanha: Campanha }
  | { tipo: "UPD_CAMPANHA"; campanha: Campanha }
  | { tipo: "STATUS_CAMPANHA"; id: string; status: StatusCampanha }
  | { tipo: "DEL_CAMPANHA"; id: string }
  | { tipo: "ADD_CARD"; card: CardConteudo }
  | { tipo: "UPD_CARD"; card: CardConteudo }
  | { tipo: "DEL_CARD"; id: string }
  | { tipo: "MOVER"; activeId: string; overId: string }
  | { tipo: "DEF_ETAPA"; id: string; etapa: Etapa; extra?: Partial<CardConteudo> }
  | { tipo: "AGENDAR"; id: string; data: string };

function reducer(estado: Board, acao: Acao): Board {
  switch (acao.tipo) {
    case "INICIALIZAR":
      return acao.board;

    case "ADD_CAMPANHA":
      return { ...estado, campanhas: [...estado.campanhas, acao.campanha] };

    case "UPD_CAMPANHA":
      return {
        ...estado,
        campanhas: estado.campanhas.map((c) =>
          c.id === acao.campanha.id ? { ...acao.campanha, atualizadoEm: agora() } : c
        ),
      };

    case "STATUS_CAMPANHA":
      // Arquiva (concluida/cancelada) ou reabre (ativa) uma campanha.
      return {
        ...estado,
        campanhas: estado.campanhas.map((c) =>
          c.id === acao.id
            ? {
                ...c,
                status: acao.status,
                arquivadaEm: acao.status === "ativa" ? undefined : agora(),
                atualizadoEm: agora(),
              }
            : c
        ),
      };

    case "DEL_CAMPANHA":
      // Remove a campanha e todos os conteudos dela.
      return {
        campanhas: estado.campanhas.filter((c) => c.id !== acao.id),
        cards: estado.cards.filter((c) => c.campanhaId !== acao.id),
      };

    case "ADD_CARD":
      // Novo card entra no topo da sua coluna.
      return { ...estado, cards: [acao.card, ...estado.cards] };

    case "UPD_CARD":
      return {
        ...estado,
        cards: estado.cards.map((c) =>
          c.id === acao.card.id ? { ...acao.card, atualizadoEm: agora() } : c
        ),
      };

    case "DEL_CARD":
      return { ...estado, cards: estado.cards.filter((c) => c.id !== acao.id) };

    case "MOVER":
      return { ...estado, cards: moverCardNoBoard(estado.cards, acao.activeId, acao.overId) };

    case "DEF_ETAPA":
      return {
        ...estado,
        cards: definirEtapaNoBoard(estado.cards, acao.id, acao.etapa, acao.extra),
      };

    case "AGENDAR":
      return {
        ...estado,
        cards: estado.cards.map((c) =>
          c.id === acao.id ? { ...c, dataPublicacao: acao.data, atualizadoEm: agora() } : c
        ),
      };

    default:
      return estado;
  }
}

/**
 * Reordena os cards apos um drag and drop.
 * overId pode ser o id de outro card ou o id de uma coluna (quando solto numa
 * coluna vazia ou no espaco abaixo dos cards).
 */
function moverCardNoBoard(
  cards: CardConteudo[],
  activeId: string,
  overId: string
): CardConteudo[] {
  if (activeId === overId) return cards;

  const ativo = cards.find((c) => c.id === activeId);
  if (!ativo) return cards;

  const overCard = cards.find((c) => c.id === overId);
  let etapaDestino: Etapa;
  if (overCard) {
    etapaDestino = overCard.etapa;
  } else if ((ETAPAS as string[]).includes(overId)) {
    etapaDestino = overId as Etapa;
  } else {
    return cards;
  }

  // Agrupa os cards por etapa, preservando a ordem atual de cada coluna.
  const grupos = agruparPorEtapa(cards);
  const origem = ativo.etapa;

  // Caso 1: reordenar dentro da mesma coluna.
  if (origem === etapaDestino && overCard) {
    const lista = grupos.get(origem) ?? [];
    const oldIndex = lista.findIndex((c) => c.id === activeId);
    const newIndex = lista.findIndex((c) => c.id === overId);
    if (oldIndex === -1 || newIndex === -1) return cards;
    const reordenada = arrayMove(lista, oldIndex, newIndex).map((c) =>
      c.id === activeId ? { ...c, atualizadoEm: agora() } : c
    );
    grupos.set(origem, reordenada);
    return achatar(grupos);
  }

  // Caso 2: mover para outra coluna (atualiza a etapa).
  const listaOrigem = (grupos.get(origem) ?? []).filter((c) => c.id !== activeId);
  grupos.set(origem, listaOrigem);

  const ativoAtualizado: CardConteudo = {
    ...ativo,
    etapa: etapaDestino,
    // Sair de "publicado" via arraste tira o carimbo de postado.
    postadoEm: etapaDestino === "publicado" ? ativo.postadoEm ?? agora() : undefined,
    atualizadoEm: agora(),
  };

  const listaDestino = grupos.get(etapaDestino) ?? [];
  let indice = listaDestino.length; // por padrao, vai para o final da coluna
  if (overCard) {
    const idxOver = listaDestino.findIndex((c) => c.id === overId);
    if (idxOver >= 0) indice = idxOver;
  }
  listaDestino.splice(indice, 0, ativoAtualizado);
  grupos.set(etapaDestino, listaDestino);

  return achatar(grupos);
}

/** Muda a etapa de um card colocando-o no topo da nova coluna. */
function definirEtapaNoBoard(
  cards: CardConteudo[],
  id: string,
  novaEtapa: Etapa,
  extra?: Partial<CardConteudo>
): CardConteudo[] {
  const alvo = cards.find((c) => c.id === id);
  if (!alvo) return cards;

  const grupos = agruparPorEtapa(cards);
  // Remove da etapa atual.
  grupos.set(alvo.etapa, (grupos.get(alvo.etapa) ?? []).filter((c) => c.id !== id));
  // Insere no topo da nova etapa.
  const atualizado: CardConteudo = {
    ...alvo,
    ...extra,
    etapa: novaEtapa,
    atualizadoEm: agora(),
  };
  grupos.set(novaEtapa, [atualizado, ...(grupos.get(novaEtapa) ?? [])]);
  return achatar(grupos);
}

function agruparPorEtapa(cards: CardConteudo[]): Map<Etapa, CardConteudo[]> {
  const grupos = new Map<Etapa, CardConteudo[]>();
  ETAPAS.forEach((e) => grupos.set(e, []));
  cards.forEach((c) => grupos.get(c.etapa)?.push(c));
  return grupos;
}

/** Junta os grupos por etapa de volta num unico array, na ordem das colunas. */
function achatar(grupos: Map<Etapa, CardConteudo[]>): CardConteudo[] {
  const resultado: CardConteudo[] = [];
  ETAPAS.forEach((e) => {
    const lista = grupos.get(e);
    if (lista) resultado.push(...lista);
  });
  return resultado;
}

/** Cria um card novo e vazio para uma campanha e etapa. */
function criarCardVazio(
  campanhaId: string,
  etapa: Etapa,
  tipo: TipoConteudo = "post"
): CardConteudo {
  const ts = agora();
  const ehProjeto = tipo === "projeto";
  return {
    id: gerarId(),
    campanhaId,
    titulo: ehProjeto ? "Novo projeto" : "Novo conteudo",
    tipo,
    // Projeto nao publica em canais; comeca sem nenhum marcado.
    canais: ehProjeto ? [] : ["instagram"],
    etapa,
    tema: "",
    dataPublicacao: undefined,
    horaPublicacao: "",
    midiaUrl: "",
    briefing: "",
    roteiro: "",
    teleprompter: "",
    legenda: "",
    responsavel: "",
    // Projeto ja nasce com as fases sugeridas (Pesquisa, Producao, Revisao).
    projeto: ehProjeto ? criarProjetoVazio() : undefined,
    criadoEm: ts,
    atualizadoEm: ts,
  };
}

/** Cria uma campanha nova com valores padrao. */
function criarCampanhaVazia(parcial?: Partial<Campanha>): Campanha {
  const ts = agora();
  return {
    id: gerarId(),
    nome: "Nova campanha",
    marca: "brusoft" as Marca,
    tipo: "geral" as TipoCampanha,
    descricao: "",
    inicio: undefined,
    fim: undefined,
    criadoEm: ts,
    atualizadoEm: ts,
    ...parcial,
  };
}

interface BoardStore {
  campanhas: Campanha[];
  cards: CardConteudo[];
  pronto: boolean;
  erroCarregar: boolean; // falha ao carregar do Supabase (rede/login)
  // Campanhas
  adicionarCampanha: (parcial?: Partial<Campanha>) => Campanha;
  atualizarCampanha: (campanha: Campanha) => void;
  arquivarCampanha: (id: string, status: "concluida" | "cancelada") => void;
  reabrirCampanha: (id: string) => void;
  excluirCampanha: (id: string) => void;
  campanhaPorId: (id: string) => Campanha | undefined;
  // Cards
  cardPorId: (id: string) => CardConteudo | undefined;
  cardsDaCampanha: (campanhaId: string) => CardConteudo[];
  temasDaCampanha: (campanhaId: string) => string[];
  adicionarCard: (campanhaId: string, etapa: Etapa, tipo?: TipoConteudo) => CardConteudo;
  adicionarCardCompleto: (card: CardConteudo) => void;
  atualizarCard: (card: CardConteudo) => void;
  excluirCard: (id: string) => void;
  moverCard: (activeId: string, overId: string) => void;
  concluirCard: (id: string) => void; // move para "aprovado"
  marcarPostado: (id: string) => void; // move para "publicado"
  reabrirCard: (id: string) => void; // volta de "publicado" para "aprovado"
  agendarCard: (id: string, dataISO: string) => void;
}

const BoardContext = createContext<BoardStore | null>(null);

const ESTADO_VAZIO: Board = { campanhas: [], cards: [] };

export function BoardProvider({ children }: { children: ReactNode }) {
  // Estado inicial deterministico (igual no servidor e no cliente) para evitar
  // erro de hidratacao. Os dados reais sao carregados logo apos a montagem.
  const [board, dispatch] = useReducer(reducer, ESTADO_VAZIO);
  const [pronto, setPronto] = useState(false);
  const [erroCarregar, setErroCarregar] = useState(false);
  // Identificador desta aba/sessao, para ignorar no realtime a propria escrita.
  const clienteId = useRef<string>(gerarId());
  const timerSalvar = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Momento (ms) da ultima gravacao local concluida. Usado para ignorar, por
  // uma curta janela, um payload de realtime que poderia reverter o que
  // acabamos de salvar (eco de uma versao um pouco mais antiga de outro editor).
  const salvoEm = useRef(0);
  // Marca quando a proxima mudanca de board veio do load/realtime (nao do
  // usuario), para nao re-salvar (evita eco) nem persistir o estado recem-lido.
  const origemRemota = useRef(false);
  // Espelho do board atual, para o flush no unmount.
  const boardRef = useRef(board);
  boardRef.current = board;

  // Carrega o quadro (localStorage ou Supabase) e assina mudancas em tempo real.
  useEffect(() => {
    let ativo = true;
    carregarBoard()
      .then((b) => {
        if (!ativo) return;
        origemRemota.current = true; // o INICIALIZAR a seguir nao deve ser re-salvo
        dispatch({ tipo: "INICIALIZAR", board: b });
        setPronto(true);
      })
      .catch(() => {
        // Falha de leitura (rede/RLS): NAO habilita salvamento para nao
        // sobrescrever os dados reais; mostra aviso para o usuario.
        if (ativo) setErroCarregar(true);
      });

    // No modo Supabase, recarrega quando OUTRO cliente salva (sincronizacao).
    const cancelar = assinarBoard((dados, remoteId) => {
      if (remoteId === clienteId.current) return; // ignora a propria escrita
      if (timerSalvar.current) return; // ha edicao local pendente: nao sobrescreve
      // Acabei de salvar: ignora por uma curta janela para um eco mais antigo de
      // outro editor nao reverter o que escrevi (modelo de blob, ultimo a salvar
      // vence; isso protege a edicao recem-feita, ex: um projeto sendo editado).
      if (Date.now() - salvoEm.current < 2500) return;
      origemRemota.current = true;
      dispatch({ tipo: "INICIALIZAR", board: dados });
    });

    return () => {
      ativo = false;
      if (cancelar) cancelar();
    };
  }, []);

  // Persiste com debounce a cada alteracao local (evita gravar a cada tecla).
  // Mudancas vindas do load/realtime nao geram gravacao (sem eco).
  useEffect(() => {
    if (!pronto) return;
    if (origemRemota.current) {
      origemRemota.current = false;
      return;
    }
    if (timerSalvar.current) clearTimeout(timerSalvar.current);
    timerSalvar.current = setTimeout(() => {
      timerSalvar.current = null;
      salvoEm.current = Date.now();
      void salvarBoard(board, clienteId.current);
    }, 500);
    return () => {
      if (timerSalvar.current) clearTimeout(timerSalvar.current);
    };
  }, [board, pronto]);

  // Flush no unmount: grava a ultima alteracao pendente (nao perde edicao).
  useEffect(() => {
    return () => {
      if (timerSalvar.current) {
        clearTimeout(timerSalvar.current);
        timerSalvar.current = null;
        salvoEm.current = Date.now();
        void salvarBoard(boardRef.current, clienteId.current);
      }
    };
  }, []);

  // ----- Campanhas -----
  const adicionarCampanha = useCallback((parcial?: Partial<Campanha>): Campanha => {
    const campanha = criarCampanhaVazia(parcial);
    dispatch({ tipo: "ADD_CAMPANHA", campanha });
    return campanha;
  }, []);

  const atualizarCampanha = useCallback((campanha: Campanha) => {
    dispatch({ tipo: "UPD_CAMPANHA", campanha });
  }, []);

  const arquivarCampanha = useCallback((id: string, status: "concluida" | "cancelada") => {
    dispatch({ tipo: "STATUS_CAMPANHA", id, status });
  }, []);

  const reabrirCampanha = useCallback((id: string) => {
    dispatch({ tipo: "STATUS_CAMPANHA", id, status: "ativa" });
  }, []);

  const excluirCampanha = useCallback((id: string) => {
    dispatch({ tipo: "DEL_CAMPANHA", id });
  }, []);

  // ----- Cards -----
  const adicionarCard = useCallback(
    (campanhaId: string, etapa: Etapa, tipo?: TipoConteudo): CardConteudo => {
      const card = criarCardVazio(campanhaId, etapa, tipo);
      dispatch({ tipo: "ADD_CARD", card });
      return card;
    },
    []
  );

  const adicionarCardCompleto = useCallback((card: CardConteudo) => {
    dispatch({ tipo: "ADD_CARD", card });
  }, []);

  const atualizarCard = useCallback((card: CardConteudo) => {
    dispatch({ tipo: "UPD_CARD", card });
  }, []);

  const excluirCard = useCallback((id: string) => {
    dispatch({ tipo: "DEL_CARD", id });
  }, []);

  const moverCard = useCallback((activeId: string, overId: string) => {
    dispatch({ tipo: "MOVER", activeId, overId });
  }, []);

  const concluirCard = useCallback((id: string) => {
    dispatch({ tipo: "DEF_ETAPA", id, etapa: "aprovado", extra: { postadoEm: undefined } });
  }, []);

  const marcarPostado = useCallback((id: string) => {
    dispatch({ tipo: "DEF_ETAPA", id, etapa: "publicado", extra: { postadoEm: agora() } });
  }, []);

  const reabrirCard = useCallback((id: string) => {
    dispatch({ tipo: "DEF_ETAPA", id, etapa: "aprovado", extra: { postadoEm: undefined } });
  }, []);

  const agendarCard = useCallback((id: string, dataISO: string) => {
    dispatch({ tipo: "AGENDAR", id, data: dataISO });
  }, []);

  // Seletores derivados (recriados quando o board muda).
  const seletores = useMemo(() => {
    const campanhaPorId = (id: string) => board.campanhas.find((c) => c.id === id);
    const cardPorId = (id: string) => board.cards.find((c) => c.id === id);
    const cardsDaCampanha = (campanhaId: string) =>
      board.cards.filter((c) => c.campanhaId === campanhaId);
    const temasDaCampanha = (campanhaId: string) => {
      const set = new Set<string>();
      board.cards.forEach((c) => {
        if (c.campanhaId !== campanhaId) return;
        const t = c.tema?.trim();
        if (t) set.add(t);
      });
      return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
    };
    return { campanhaPorId, cardPorId, cardsDaCampanha, temasDaCampanha };
  }, [board.campanhas, board.cards]);

  const valor: BoardStore = useMemo(
    () => ({
      campanhas: board.campanhas,
      cards: board.cards,
      pronto,
      erroCarregar,
      adicionarCampanha,
      atualizarCampanha,
      arquivarCampanha,
      reabrirCampanha,
      excluirCampanha,
      adicionarCard,
      adicionarCardCompleto,
      atualizarCard,
      excluirCard,
      moverCard,
      concluirCard,
      marcarPostado,
      reabrirCard,
      agendarCard,
      ...seletores,
    }),
    [
      board.campanhas,
      board.cards,
      pronto,
      erroCarregar,
      adicionarCampanha,
      atualizarCampanha,
      arquivarCampanha,
      reabrirCampanha,
      excluirCampanha,
      adicionarCard,
      adicionarCardCompleto,
      atualizarCard,
      excluirCard,
      moverCard,
      concluirCard,
      marcarPostado,
      reabrirCard,
      agendarCard,
      seletores,
    ]
  );

  return <BoardContext.Provider value={valor}>{children}</BoardContext.Provider>;
}

/** Hook para acessar o estado central do quadro. */
export function useBoard(): BoardStore {
  const ctx = useContext(BoardContext);
  if (!ctx) {
    throw new Error("useBoard precisa estar dentro de <BoardProvider>");
  }
  return ctx;
}
