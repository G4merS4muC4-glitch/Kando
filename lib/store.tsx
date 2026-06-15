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
  EtapaOrg,
  Marca,
  MarcaOrg,
  StatusCampanha,
  TipoCampanha,
  TipoConteudo,
} from "./types";
import { ETAPAS_PADRAO, MARCAS } from "./config";
import { criarProjetoVazio } from "./projeto";
import { assinarBoard, carregarBoard, salvarBoard } from "./storage";
import { useOrg } from "./orgProvider";
import { agora, gerarId } from "./util";

/**
 * Estado central da aplicacao.
 *
 * Usa useReducer + Context e persiste automaticamente no localStorage a cada
 * alteracao (atraves da camada isolada em storage.ts). Para trocar a
 * persistencia por um banco no futuro, basta mudar storage.ts.
 */

type PapelEtapa = "inicial" | "postado";

type Acao =
  | { tipo: "INICIALIZAR"; board: Board }
  | { tipo: "ADD_MARCA"; marca: MarcaOrg }
  | { tipo: "UPD_MARCA"; marca: MarcaOrg }
  | { tipo: "DEL_MARCA"; id: string }
  | { tipo: "ADD_ETAPA"; etapa: EtapaOrg }
  | { tipo: "UPD_ETAPA"; etapa: EtapaOrg }
  | { tipo: "DEL_ETAPA"; id: string }
  | { tipo: "MOVER_ETAPA"; id: string; dir: -1 | 1 }
  | { tipo: "PAPEL_ETAPA"; id: string; papel: PapelEtapa }
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

    case "ADD_MARCA":
      return { ...estado, marcas: [...(estado.marcas ?? []), acao.marca] };

    case "UPD_MARCA":
      return {
        ...estado,
        marcas: (estado.marcas ?? []).map((m) => (m.id === acao.marca.id ? acao.marca : m)),
      };

    case "DEL_MARCA":
      return { ...estado, marcas: (estado.marcas ?? []).filter((m) => m.id !== acao.id) };

    case "ADD_ETAPA": {
      // Nova coluna entra antes da coluna de Publicado (ou no fim).
      const atuais = etapasDe(estado);
      const idxPost = atuais.findIndex((e) => e.postado);
      const pos = idxPost >= 0 ? idxPost : atuais.length;
      return { ...estado, etapas: [...atuais.slice(0, pos), acao.etapa, ...atuais.slice(pos)] };
    }

    case "UPD_ETAPA":
      // So nome e descricao mudam aqui; os papeis sao geridos por PAPEL_ETAPA.
      return {
        ...estado,
        etapas: etapasDe(estado).map((e) =>
          e.id === acao.etapa.id
            ? { ...e, titulo: acao.etapa.titulo, descricao: acao.etapa.descricao }
            : e
        ),
      };

    case "DEL_ETAPA": {
      const atuais = etapasDe(estado);
      if (atuais.length <= 1) return estado; // nunca remove a ultima coluna
      const restantes = atuais.filter((e) => e.id !== acao.id);
      if (restantes.length === atuais.length) return estado; // id inexistente
      // Cards da coluna removida vao para a inicial (ou a primeira restante).
      const destino = (restantes.find((e) => e.inicial) ?? restantes[0]).id;
      const cards = estado.cards.map((c) =>
        c.etapa === acao.id ? { ...c, etapa: destino, atualizadoEm: agora() } : c
      );
      // Garante que sempre exista uma coluna inicial e uma de postado.
      let novas = restantes;
      if (!novas.some((e) => e.inicial)) {
        novas = novas.map((e, i) => (i === 0 ? { ...e, inicial: true } : e));
      }
      if (!novas.some((e) => e.postado)) {
        novas = novas.map((e, i) => (i === novas.length - 1 ? { ...e, postado: true } : e));
      }
      return { ...estado, etapas: novas, cards };
    }

    case "MOVER_ETAPA": {
      const atuais = etapasDe(estado);
      const idx = atuais.findIndex((e) => e.id === acao.id);
      const j = idx + acao.dir;
      if (idx < 0 || j < 0 || j >= atuais.length) return estado;
      const novas = [...atuais];
      [novas[idx], novas[j]] = [novas[j], novas[idx]];
      return { ...estado, etapas: novas };
    }

    case "PAPEL_ETAPA": {
      const atuais = etapasDe(estado);
      if (!atuais.some((e) => e.id === acao.id)) return estado;
      // Marca o papel (inicial/postado) so na coluna escolhida, tirando das outras.
      return {
        ...estado,
        etapas: atuais.map((e) => ({ ...e, [acao.papel]: e.id === acao.id })),
      };
    }

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
      return {
        ...estado,
        cards: moverCardNoBoard(
          estado.cards,
          acao.activeId,
          acao.overId,
          ordemDe(estado),
          postadoIdDe(estado)
        ),
      };

    case "DEF_ETAPA":
      return {
        ...estado,
        cards: definirEtapaNoBoard(estado.cards, acao.id, acao.etapa, ordemDe(estado), acao.extra),
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

// ----- Resolvedores das etapas (as da organizacao, ou as 6 padrao) -----

/** Etapas efetivas do quadro (board.etapas, ou as padrao como fallback). */
function etapasDe(estado: Board): EtapaOrg[] {
  return estado.etapas && estado.etapas.length > 0 ? estado.etapas : ETAPAS_PADRAO;
}
/** Ordem das colunas (ids), para agrupar e achatar os cards. */
function ordemDe(estado: Board): string[] {
  return etapasDe(estado).map((e) => e.id);
}
/** Id da coluna de Publicado (a marcada como `postado`, ou a ultima). */
function postadoIdDe(estado: Board): string {
  const e = etapasDe(estado);
  return (e.find((x) => x.postado) ?? e[e.length - 1]).id;
}
/** Id da coluna inicial (a marcada como `inicial`, ou a primeira). */
function inicialIdDe(estado: Board): string {
  const e = etapasDe(estado);
  return (e.find((x) => x.inicial) ?? e[0]).id;
}

/**
 * Reordena os cards apos um drag and drop.
 * overId pode ser o id de outro card ou o id de uma coluna (quando solto numa
 * coluna vazia ou no espaco abaixo dos cards).
 */
function moverCardNoBoard(
  cards: CardConteudo[],
  activeId: string,
  overId: string,
  ordem: string[],
  postadoId: string
): CardConteudo[] {
  if (activeId === overId) return cards;

  const ativo = cards.find((c) => c.id === activeId);
  if (!ativo) return cards;

  const overCard = cards.find((c) => c.id === overId);
  let etapaDestino: string;
  if (overCard) {
    etapaDestino = overCard.etapa;
  } else if (ordem.includes(overId)) {
    etapaDestino = overId;
  } else {
    return cards;
  }

  // Agrupa os cards por etapa, preservando a ordem atual de cada coluna.
  const grupos = agruparPorEtapa(cards, ordem);
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
    return achatar(grupos, ordem);
  }

  // Caso 2: mover para outra coluna (atualiza a etapa).
  const listaOrigem = (grupos.get(origem) ?? []).filter((c) => c.id !== activeId);
  grupos.set(origem, listaOrigem);

  const ativoAtualizado: CardConteudo = {
    ...ativo,
    etapa: etapaDestino,
    // Entrar na coluna de Publicado carimba o postado; sair limpa.
    postadoEm: etapaDestino === postadoId ? ativo.postadoEm ?? agora() : undefined,
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

  return achatar(grupos, ordem);
}

/** Muda a etapa de um card colocando-o no topo da nova coluna. */
function definirEtapaNoBoard(
  cards: CardConteudo[],
  id: string,
  novaEtapa: Etapa,
  ordem: string[],
  extra?: Partial<CardConteudo>
): CardConteudo[] {
  const alvo = cards.find((c) => c.id === id);
  if (!alvo) return cards;

  const grupos = agruparPorEtapa(cards, ordem);
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
  return achatar(grupos, ordem);
}

function agruparPorEtapa(cards: CardConteudo[], ordem: string[]): Map<string, CardConteudo[]> {
  const grupos = new Map<string, CardConteudo[]>();
  ordem.forEach((e) => grupos.set(e, []));
  cards.forEach((c) => {
    // Card de uma etapa que nao existe mais cai na primeira coluna (nao se perde).
    (grupos.get(c.etapa) ?? grupos.get(ordem[0]))?.push(c);
  });
  return grupos;
}

/** Junta os grupos por etapa de volta num unico array, na ordem das colunas. */
function achatar(grupos: Map<string, CardConteudo[]>, ordem: string[]): CardConteudo[] {
  const resultado: CardConteudo[] = [];
  ordem.forEach((e) => {
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

/** Cria uma campanha nova com valores padrao. A marca vem de quem cria (a 1a da
 *  organizacao); fica vazia so se a organizacao ainda nao tiver marcas. */
function criarCampanhaVazia(parcial?: Partial<Campanha>): Campanha {
  const ts = agora();
  return {
    id: gerarId(),
    nome: "Nova campanha",
    marca: "",
    tipo: "geral" as TipoCampanha,
    descricao: "",
    inicio: undefined,
    fim: undefined,
    criadoEm: ts,
    atualizadoEm: ts,
    ...parcial,
  };
}

/** Cria uma marca nova com cor padrao da marca (laranja). */
function criarMarcaVazia(parcial?: Partial<MarcaOrg>): MarcaOrg {
  return {
    id: gerarId(),
    nome: "Nova marca",
    cor: "#FA611E",
    corSuave: "#FFF1E9",
    ...parcial,
  };
}

interface BoardStore {
  marcas: MarcaOrg[];
  campanhas: Campanha[];
  cards: CardConteudo[];
  pronto: boolean;
  erroCarregar: boolean; // falha ao carregar do Supabase (rede/login)
  // Marcas (da organizacao)
  marcaPorId: (id: string) => MarcaOrg;
  adicionarMarca: (parcial?: Partial<MarcaOrg>) => MarcaOrg;
  atualizarMarca: (marca: MarcaOrg) => void;
  excluirMarca: (id: string) => void;
  // Etapas / colunas (da organizacao)
  etapas: EtapaOrg[];
  etapaInicial: EtapaOrg; // onde o card novo nasce
  etapaPostado: EtapaOrg; // coluna de Publicado (selo, progresso, prazo, robo)
  etapaPorId: (id: string) => EtapaOrg;
  adicionarEtapa: () => void;
  atualizarEtapa: (etapa: EtapaOrg) => void;
  excluirEtapa: (id: string) => void;
  moverEtapa: (id: string, dir: -1 | 1) => void;
  definirPapelEtapa: (id: string, papel: "inicial" | "postado") => void;
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
  marcarPostado: (id: string) => void; // move para a coluna de Publicado
  reabrirCard: (id: string) => void; // tira de Publicado (volta a coluna anterior)
  agendarCard: (id: string, dataISO: string) => void;
}

const BoardContext = createContext<BoardStore | null>(null);

const ESTADO_VAZIO: Board = { marcas: [], campanhas: [], cards: [] };

export function BoardProvider({ children }: { children: ReactNode }) {
  // A organizacao ativa define de qual quadro carregamos/salvamos os dados.
  const { orgId } = useOrg();
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
  // Espelho do board atual, para o flush ao trocar de org ou desmontar.
  const boardRef = useRef(board);
  boardRef.current = board;
  // Espelho do orgId para o salvamento com debounce nao precisar dele na dependencia.
  const orgIdRef = useRef(orgId);
  orgIdRef.current = orgId;

  // Carrega o quadro da organizacao ativa e assina mudancas em tempo real.
  // Recarrega quando a organizacao muda; antes de trocar, grava o que estiver
  // pendente (nao perde edicao ao trocar de org nem ao desmontar).
  useEffect(() => {
    if (!orgId) return; // ainda resolvendo a organizacao
    let ativo = true;
    setPronto(false);
    setErroCarregar(false);

    carregarBoard(orgId)
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
    const cancelar = assinarBoard(orgId, (dados, remoteId) => {
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
      // Grava a ultima alteracao pendente desta organizacao antes de sair.
      if (timerSalvar.current) {
        clearTimeout(timerSalvar.current);
        timerSalvar.current = null;
        salvoEm.current = Date.now();
        void salvarBoard(boardRef.current, clienteId.current, orgId);
      }
      if (cancelar) cancelar();
    };
  }, [orgId]);

  // Persiste com debounce a cada alteracao local (evita gravar a cada tecla).
  // Mudancas vindas do load/realtime nao geram gravacao (sem eco).
  useEffect(() => {
    if (!pronto) return;
    if (origemRemota.current) {
      origemRemota.current = false;
      return;
    }
    const org = orgIdRef.current;
    if (!org) return;
    if (timerSalvar.current) clearTimeout(timerSalvar.current);
    timerSalvar.current = setTimeout(() => {
      timerSalvar.current = null;
      salvoEm.current = Date.now();
      void salvarBoard(board, clienteId.current, org);
    }, 500);
    return () => {
      if (timerSalvar.current) clearTimeout(timerSalvar.current);
    };
  }, [board, pronto]);

  // ----- Marcas (da organizacao) -----
  const adicionarMarca = useCallback((parcial?: Partial<MarcaOrg>): MarcaOrg => {
    const marca = criarMarcaVazia(parcial);
    dispatch({ tipo: "ADD_MARCA", marca });
    return marca;
  }, []);

  const atualizarMarca = useCallback((marca: MarcaOrg) => {
    dispatch({ tipo: "UPD_MARCA", marca });
  }, []);

  const excluirMarca = useCallback((id: string) => {
    dispatch({ tipo: "DEL_MARCA", id });
  }, []);

  // ----- Etapas / colunas (da organizacao) -----
  const adicionarEtapa = useCallback(() => {
    dispatch({ tipo: "ADD_ETAPA", etapa: { id: gerarId(), titulo: "Nova coluna", descricao: "" } });
  }, []);

  const atualizarEtapa = useCallback((etapa: EtapaOrg) => {
    dispatch({ tipo: "UPD_ETAPA", etapa });
  }, []);

  const excluirEtapa = useCallback((id: string) => {
    dispatch({ tipo: "DEL_ETAPA", id });
  }, []);

  const moverEtapa = useCallback((id: string, dir: -1 | 1) => {
    dispatch({ tipo: "MOVER_ETAPA", id, dir });
  }, []);

  const definirPapelEtapa = useCallback((id: string, papel: "inicial" | "postado") => {
    dispatch({ tipo: "PAPEL_ETAPA", id, papel });
  }, []);

  // ----- Campanhas -----
  const adicionarCampanha = useCallback((parcial?: Partial<Campanha>): Campanha => {
    // Marca padrao = a primeira da organizacao (vazia so se ainda nao houver marca).
    const padraoMarca = boardRef.current.marcas?.[0]?.id ?? "";
    const campanha = criarCampanhaVazia({ marca: padraoMarca, ...parcial });
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

  const marcarPostado = useCallback((id: string) => {
    const post = postadoIdDe(boardRef.current);
    dispatch({ tipo: "DEF_ETAPA", id, etapa: post, extra: { postadoEm: agora() } });
  }, []);

  const reabrirCard = useCallback((id: string) => {
    // Volta para a coluna imediatamente antes da de Publicado (ou a inicial).
    const ord = ordemDe(boardRef.current);
    const post = postadoIdDe(boardRef.current);
    const i = ord.indexOf(post);
    const anterior = (i > 0 ? ord[i - 1] : undefined) ?? inicialIdDe(boardRef.current);
    dispatch({ tipo: "DEF_ETAPA", id, etapa: anterior, extra: { postadoEm: undefined } });
  }, []);

  const agendarCard = useCallback((id: string, dataISO: string) => {
    dispatch({ tipo: "AGENDAR", id, data: dataISO });
  }, []);

  // Seletores derivados (recriados quando o board muda).
  const seletores = useMemo(() => {
    const lista = board.marcas ?? [];
    // Resolve uma marca pelo id: primeiro nas marcas da organizacao; senao no
    // catalogo estatico (compatibilidade/demo); senao um cinza neutro.
    const marcaPorId = (id: string): MarcaOrg => {
      const m = lista.find((x) => x.id === id);
      if (m) return m;
      const f = MARCAS[id];
      if (f) return { id, nome: f.label, cor: f.cor, corSuave: f.corSuave };
      return { id, nome: id || "Sem marca", cor: "#8790AB", corSuave: "#EEF0F5" };
    };
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
    // Etapas efetivas (as da org, ou as padrao) + papeis e lookup por id.
    const etapas = board.etapas && board.etapas.length > 0 ? board.etapas : ETAPAS_PADRAO;
    const etapaPorId = (id: string): EtapaOrg => etapas.find((e) => e.id === id) ?? { id, titulo: id };
    const etapaInicial = etapas.find((e) => e.inicial) ?? etapas[0];
    const etapaPostado = etapas.find((e) => e.postado) ?? etapas[etapas.length - 1];
    return {
      marcaPorId,
      etapas,
      etapaPorId,
      etapaInicial,
      etapaPostado,
      campanhaPorId,
      cardPorId,
      cardsDaCampanha,
      temasDaCampanha,
    };
  }, [board.marcas, board.etapas, board.campanhas, board.cards]);

  const valor: BoardStore = useMemo(
    () => ({
      marcas: board.marcas ?? [],
      campanhas: board.campanhas,
      cards: board.cards,
      pronto,
      erroCarregar,
      adicionarMarca,
      atualizarMarca,
      excluirMarca,
      adicionarEtapa,
      atualizarEtapa,
      excluirEtapa,
      moverEtapa,
      definirPapelEtapa,
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
      marcarPostado,
      reabrirCard,
      agendarCard,
      ...seletores,
    }),
    [
      board.marcas,
      board.campanhas,
      board.cards,
      pronto,
      erroCarregar,
      adicionarMarca,
      atualizarMarca,
      excluirMarca,
      adicionarEtapa,
      atualizarEtapa,
      excluirEtapa,
      moverEtapa,
      definirPapelEtapa,
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
