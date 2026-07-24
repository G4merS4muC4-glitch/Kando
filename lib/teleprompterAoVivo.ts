"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { criarClienteNavegador, supabaseConfigurado } from "./supabase/client";

/**
 * Sincronizacao AO VIVO do texto do teleprompter via Supabase Broadcast.
 *
 * Broadcast e um canal pub/sub que NAO depende de RLS nem de login: o visitante
 * anonimo (link publico) e o time autenticado entram na mesma "sala" (por card)
 * e trocam o texto em tempo real, nos dois sentidos, na hora, independente de
 * quem esta com o cursor no campo. Os dois podem digitar ao mesmo tempo (vence o
 * ultimo a enviar). A persistencia continua nos caminhos normais (store do time
 * e endpoint do visitante); aqui e so a camada ao vivo, instantanea.
 *
 * Uso: const { enviar } = useCanalTeleprompter(cardId, (texto) => aplicar(texto));
 *  - chame `enviar(texto)` a cada tecla; ele propaga (com leve throttle).
 *  - o callback recebe o texto quando a OUTRA ponta envia.
 */
export function useCanalTeleprompter(
  cardId: string | null,
  aoReceber: (texto: string) => void,
  habilitado = true
): { enviar: (texto: string) => void } {
  // Mantem o callback mais recente sem reassinar o canal a cada render.
  const aoReceberRef = useRef(aoReceber);
  aoReceberRef.current = aoReceber;
  const canalRef = useRef<RealtimeChannel | null>(null);
  const ultimoRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!habilitado || !cardId || !supabaseConfigurado()) return;
    const sb = criarClienteNavegador();
    const canal = sb.channel(`tp-card:${cardId}`, {
      config: { broadcast: { self: false } }, // nao recebe o proprio eco
    });
    canal.on("broadcast", { event: "tp" }, (msg: { payload?: { texto?: unknown } }) => {
      const t = msg?.payload?.texto;
      if (typeof t === "string") aoReceberRef.current(t);
    });
    canal.subscribe();
    canalRef.current = canal;

    return () => {
      canalRef.current = null;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      void sb.removeChannel(canal);
    };
  }, [cardId, habilitado]);

  // Throttle leve (~90ms): coalesce rajadas de digitacao e envia o texto atual.
  const enviar = useCallback((texto: string) => {
    ultimoRef.current = texto;
    if (timerRef.current) return;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const canal = canalRef.current;
      if (canal) {
        void canal.send({ type: "broadcast", event: "tp", payload: { texto: ultimoRef.current } });
      }
    }, 90);
  }, []);

  return { enviar };
}

/**
 * Controle remoto AO VIVO do teleprompter (play/pause, velocidade, fonte e
 * posicao), compartilhado entre todas as telas abertas do mesmo card: aba
 * principal e link publico, nos dois sentidos. Mesma tecnologia do texto
 * (Supabase Broadcast), em um canal separado por card. Qualquer tela controla;
 * todas obedecem ("ao mesmo tempo"). Sem login nem RLS (sala por card).
 *
 * play/pause/velocidade/fonte sao estado continuo (todos aplicam ao receber).
 * `saltar` marca um comando de posicao (reiniciar, avancar, sincronizar): o
 * receptor pula para `posicaoPct` (0..1, posicao relativa, tolerante a telas de
 * tamanhos diferentes); fora disso cada tela rola sozinha na mesma velocidade.
 */
export interface ControleTeleprompter {
  tocando: boolean;
  velocidade: number;
  tamanho: number;
  posicaoPct: number;
  saltar: boolean;
  // Salto por FRASE (fracao de bloco, 0..N): quando presente com `saltar`, as
  // telas pulam para esta frase (independe do tamanho da tela). Usado pelo
  // controle remoto; no modo normal fica ausente e vale o `posicaoPct`.
  fbSaltar?: number;
  // A guia atual e um controle remoto: as telas de exibicao NAO rolam sozinhas,
  // so seguem a posicao por frase (posrem). Evita elas rolarem em px em paralelo.
  remoto?: boolean;
}

/**
 * Modo de uma tela:
 * - "exibir": limpa (so o prompt rolando);
 * - "controle": botoes grandes + o texto;
 * - "remoto": controle remoto de bolso (so a frase atual + barra e botoes), que
 *   comanda as telas de exibicao POR FRASE, independente do tamanho de cada tela.
 */
export type ModoTela = "controle" | "exibir" | "remoto";

/** Uma tela conectada na sala do card (presenca em tempo real). */
export interface PresencaTela {
  id: string;
  nome: string;
  modo: ModoTela;
}

interface OpcoesControle {
  meuId: string;
  nome: string;
  modo: ModoTela;
  aoReceberControle: (c: ControleTeleprompter) => void;
  aoComandoModo: (modo: ModoTela) => void;
  aoReceberPosicao: (pct: number, vel: number) => void;
  // Posicao POR FRASE vinda do controle remoto (fb = fracao de bloco; vel em
  // frações de bloco por ms). As telas deslizam ate a frase, independente do
  // tamanho de cada uma.
  aoReceberPosicaoRemota: (fb: number, vel: number) => void;
}

/**
 * Sala ao vivo do teleprompter (por card): controle compartilhado + presenca.
 * - enviarControle: play/pause/velocidade/fonte/posicao para todas as telas.
 * - telas: quais telas estao abertas agora (nome + modo), via Supabase Presence.
 * - comandarModo(id): pede a uma tela especifica para virar "limpa" ou "controle".
 */
export function useControleTeleprompter(
  cardId: string | null,
  opts: OpcoesControle,
  habilitado = true
): {
  enviarControle: (c: ControleTeleprompter) => void;
  comandarModo: (alvoId: string, modo: ModoTela) => void;
  enviarPosicao: (pct: number, vel: number) => void;
  enviarPosicaoRemota: (fb: number, vel: number) => void;
  telas: PresencaTela[];
  ativo: boolean;
} {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const canalRef = useRef<RealtimeChannel | null>(null);
  const [ativo, setAtivo] = useState(false);
  const [telas, setTelas] = useState<PresencaTela[]>([]);

  useEffect(() => {
    if (!habilitado || !cardId || !supabaseConfigurado()) {
      setAtivo(false);
      setTelas([]);
      return;
    }
    const sb = criarClienteNavegador();
    const meuId = optsRef.current.meuId;
    const canal = sb.channel(`tp-ctrl:${cardId}`, {
      config: { broadcast: { self: false }, presence: { key: meuId } },
    });

    canal.on("broadcast", { event: "ctrl" }, (msg: { payload?: Partial<ControleTeleprompter> }) => {
      const p = msg?.payload;
      if (!p || typeof p.tocando !== "boolean") return;
      optsRef.current.aoReceberControle({
        tocando: p.tocando,
        velocidade: typeof p.velocidade === "number" ? p.velocidade : 1.4,
        tamanho: typeof p.tamanho === "number" ? p.tamanho : 44,
        posicaoPct: typeof p.posicaoPct === "number" ? p.posicaoPct : 0,
        saltar: Boolean(p.saltar),
        fbSaltar: typeof p.fbSaltar === "number" ? p.fbSaltar : undefined,
        remoto: Boolean(p.remoto),
      });
    });

    canal.on("broadcast", { event: "modo" }, (msg: { payload?: { alvo?: string; modo?: ModoTela } }) => {
      const p = msg?.payload;
      if (
        p &&
        p.alvo === meuId &&
        (p.modo === "controle" || p.modo === "exibir" || p.modo === "remoto")
      ) {
        optsRef.current.aoComandoModo(p.modo);
      }
    });

    // Posicao POR FRASE do controle remoto (independe do tamanho de cada tela).
    canal.on("broadcast", { event: "posrem" }, (msg: { payload?: { fb?: number; vel?: number } }) => {
      const p = msg?.payload;
      if (p && typeof p.fb === "number") {
        optsRef.current.aoReceberPosicaoRemota(p.fb, typeof p.vel === "number" ? p.vel : 0);
      }
    });

    // Posicao relativa + velocidade da tela-guia (stream continuo) para quem
    // acompanha extrapolar o movimento e deslizar suave entre as atualizacoes.
    canal.on("broadcast", { event: "pos" }, (msg: { payload?: { pct?: number; vel?: number } }) => {
      const p = msg?.payload;
      if (p && typeof p.pct === "number") {
        optsRef.current.aoReceberPosicao(p.pct, typeof p.vel === "number" ? p.vel : 0);
      }
    });

    canal.on("presence", { event: "sync" }, () => {
      const estado = canal.presenceState() as Record<
        string,
        Array<{ id?: string; nome?: string; modo?: ModoTela }>
      >;
      const lista: PresencaTela[] = [];
      const vistos = new Set<string>();
      Object.values(estado).forEach((entradas) =>
        entradas.forEach((e) => {
          const id = e.id ?? "";
          if (!id || vistos.has(id)) return;
          vistos.add(id);
          const m: ModoTela = e.modo === "exibir" ? "exibir" : e.modo === "remoto" ? "remoto" : "controle";
          lista.push({ id, nome: e.nome ?? "Tela", modo: m });
        })
      );
      setTelas(lista);
    });

    canal.subscribe((status: string) => {
      const ok = status === "SUBSCRIBED";
      setAtivo(ok);
      if (ok) {
        const o = optsRef.current;
        void canal.track({ id: o.meuId, nome: o.nome, modo: o.modo });
      }
    });
    canalRef.current = canal;

    return () => {
      canalRef.current = null;
      setAtivo(false);
      setTelas([]);
      void sb.removeChannel(canal);
    };
  }, [cardId, habilitado]);

  // Atualiza a presenca desta tela quando o nome ou o modo mudam.
  useEffect(() => {
    const canal = canalRef.current;
    if (canal && ativo) {
      void canal.track({ id: opts.meuId, nome: opts.nome, modo: opts.modo });
    }
  }, [opts.meuId, opts.nome, opts.modo, ativo]);

  const enviarControle = useCallback((c: ControleTeleprompter) => {
    const canal = canalRef.current;
    if (canal) void canal.send({ type: "broadcast", event: "ctrl", payload: c });
  }, []);

  const comandarModo = useCallback((alvoId: string, modo: ModoTela) => {
    const canal = canalRef.current;
    if (canal) void canal.send({ type: "broadcast", event: "modo", payload: { alvo: alvoId, modo } });
  }, []);

  const enviarPosicao = useCallback((pct: number, vel: number) => {
    const canal = canalRef.current;
    if (canal) void canal.send({ type: "broadcast", event: "pos", payload: { pct, vel } });
  }, []);

  const enviarPosicaoRemota = useCallback((fb: number, vel: number) => {
    const canal = canalRef.current;
    if (canal) void canal.send({ type: "broadcast", event: "posrem", payload: { fb, vel } });
  }, []);

  return { enviarControle, comandarModo, enviarPosicao, enviarPosicaoRemota, telas, ativo };
}

/**
 * Presenca GLOBAL do teleprompter (por organizacao, nao por card): permite que
 * telas abertas em PROJETOS DIFERENTES se enxerguem. Serve para trocar o roteiro
 * de todas as telas de uma vez ("comecar o proximo video") sem ir em cada
 * aparelho: quem abre o novo projeto manda um comando `trocar` com o texto e as
 * outras telas (mesmo em outro card) recarregam na hora.
 */
export interface PresencaGlobal {
  id: string;
  cardId: string;
  titulo: string;
  modo: ModoTela;
}

interface OpcoesGlobal {
  meuId: string;
  cardId: string | null;
  titulo: string;
  modo: ModoTela;
  aoTrocar: (cardId: string, texto: string, titulo: string) => void;
}

export function usePresencaGlobalTeleprompter(
  escopo: string | null | undefined,
  opts: OpcoesGlobal,
  habilitado = true
): {
  telasGlobais: PresencaGlobal[];
  enviarTroca: (cardId: string, texto: string, titulo: string) => void;
  ativoGlobal: boolean;
} {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const canalRef = useRef<RealtimeChannel | null>(null);
  const [ativoGlobal, setAtivoGlobal] = useState(false);
  const [telasGlobais, setTelasGlobais] = useState<PresencaGlobal[]>([]);

  useEffect(() => {
    if (!habilitado || !escopo || !supabaseConfigurado()) {
      setAtivoGlobal(false);
      setTelasGlobais([]);
      return;
    }
    const sb = criarClienteNavegador();
    const meuId = optsRef.current.meuId;
    const canal = sb.channel(`tp-global:${escopo}`, {
      config: { broadcast: { self: false }, presence: { key: meuId } },
    });

    canal.on(
      "broadcast",
      { event: "trocar" },
      (msg: { payload?: { cardId?: string; texto?: string; titulo?: string } }) => {
        const p = msg?.payload;
        if (p && typeof p.cardId === "string" && typeof p.texto === "string") {
          optsRef.current.aoTrocar(p.cardId, p.texto, typeof p.titulo === "string" ? p.titulo : "");
        }
      }
    );

    canal.on("presence", { event: "sync" }, () => {
      const estado = canal.presenceState() as Record<
        string,
        Array<{ id?: string; cardId?: string; titulo?: string; modo?: ModoTela }>
      >;
      const lista: PresencaGlobal[] = [];
      const vistos = new Set<string>();
      Object.values(estado).forEach((entradas) =>
        entradas.forEach((e) => {
          const id = e.id ?? "";
          if (!id || vistos.has(id)) return;
          vistos.add(id);
          const m: ModoTela = e.modo === "exibir" ? "exibir" : e.modo === "remoto" ? "remoto" : "controle";
          lista.push({ id, cardId: e.cardId ?? "", titulo: e.titulo ?? "", modo: m });
        })
      );
      setTelasGlobais(lista);
    });

    canal.subscribe((status: string) => {
      const ok = status === "SUBSCRIBED";
      setAtivoGlobal(ok);
      if (ok) {
        const o = optsRef.current;
        void canal.track({ id: o.meuId, cardId: o.cardId ?? "", titulo: o.titulo, modo: o.modo });
      }
    });
    canalRef.current = canal;

    return () => {
      canalRef.current = null;
      setAtivoGlobal(false);
      setTelasGlobais([]);
      void sb.removeChannel(canal);
    };
  }, [escopo, habilitado]);

  // Atualiza a presenca global quando o card/titulo/modo desta tela mudam
  // (ex: acabou de trocar de projeto).
  useEffect(() => {
    const canal = canalRef.current;
    if (canal && ativoGlobal) {
      void canal.track({ id: opts.meuId, cardId: opts.cardId ?? "", titulo: opts.titulo, modo: opts.modo });
    }
  }, [opts.meuId, opts.cardId, opts.titulo, opts.modo, ativoGlobal]);

  const enviarTroca = useCallback((cardId: string, texto: string, titulo: string) => {
    const canal = canalRef.current;
    if (canal) void canal.send({ type: "broadcast", event: "trocar", payload: { cardId, texto, titulo } });
  }, []);

  return { telasGlobais, enviarTroca, ativoGlobal };
}
