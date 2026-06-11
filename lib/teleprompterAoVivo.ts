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
}

export function useControleTeleprompter(
  cardId: string | null,
  aoReceber: (c: ControleTeleprompter) => void,
  habilitado = true
): { enviarControle: (c: ControleTeleprompter) => void; ativo: boolean } {
  const aoReceberRef = useRef(aoReceber);
  aoReceberRef.current = aoReceber;
  const canalRef = useRef<RealtimeChannel | null>(null);
  const [ativo, setAtivo] = useState(false);

  useEffect(() => {
    if (!habilitado || !cardId || !supabaseConfigurado()) {
      setAtivo(false);
      return;
    }
    const sb = criarClienteNavegador();
    const canal = sb.channel(`tp-ctrl:${cardId}`, {
      config: { broadcast: { self: false } },
    });
    canal.on(
      "broadcast",
      { event: "ctrl" },
      (msg: { payload?: Partial<ControleTeleprompter> }) => {
        const p = msg?.payload;
        if (!p || typeof p.tocando !== "boolean") return;
        aoReceberRef.current({
          tocando: p.tocando,
          velocidade: typeof p.velocidade === "number" ? p.velocidade : 1.4,
          tamanho: typeof p.tamanho === "number" ? p.tamanho : 44,
          posicaoPct: typeof p.posicaoPct === "number" ? p.posicaoPct : 0,
          saltar: Boolean(p.saltar),
        });
      }
    );
    canal.subscribe((status: string) => setAtivo(status === "SUBSCRIBED"));
    canalRef.current = canal;

    return () => {
      canalRef.current = null;
      setAtivo(false);
      void sb.removeChannel(canal);
    };
  }, [cardId, habilitado]);

  const enviarControle = useCallback((c: ControleTeleprompter) => {
    const canal = canalRef.current;
    if (canal) void canal.send({ type: "broadcast", event: "ctrl", payload: c });
  }, []);

  return { enviarControle, ativo };
}
