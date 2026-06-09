"use client";

import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";

/**
 * Logica compartilhada dos popovers flutuantes (calendario e horario):
 * posicao fixa calculada a partir do botao (com flip pra cima quando falta espaco
 * embaixo e clamp nas bordas), fechar ao clicar fora / Esc, e reposicionar ao
 * rolar/redimensionar. Renderize o painel via portal usando `estiloPainel`.
 */
export function usePopoverFlutuante(larguraMin = 300, alturaEstimada = 360) {
  const botaoRef = useRef<HTMLButtonElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);
  const [aberto, setAberto] = useState(false);
  const [montado, setMontado] = useState(false);
  const [pos, setPos] = useState({ left: 0, topo: 0, baixo: 0, largura: larguraMin, acima: false });

  useEffect(() => setMontado(true), []);

  const reposicionar = useCallback(() => {
    const b = botaoRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const largura = Math.min(Math.max(r.width, larguraMin), window.innerWidth - 16);
    const espacoAbaixo = window.innerHeight - r.bottom;
    const acima = espacoAbaixo < alturaEstimada && r.top > espacoAbaixo;
    let left = r.left;
    if (left + largura > window.innerWidth - 8) left = window.innerWidth - 8 - largura;
    if (left < 8) left = 8;
    setPos({ left, topo: r.bottom + 8, baixo: window.innerHeight - r.top + 8, largura, acima });
  }, [larguraMin, alturaEstimada]);

  const abrir = useCallback(() => {
    reposicionar();
    setAberto(true);
  }, [reposicionar]);

  const fechar = useCallback(() => setAberto(false), []);

  useEffect(() => {
    if (!aberto) return;
    function aoClicar(e: PointerEvent) {
      const alvo = e.target as Node;
      if (botaoRef.current?.contains(alvo) || painelRef.current?.contains(alvo)) return;
      setAberto(false);
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    function aoMexer() {
      reposicionar();
    }
    document.addEventListener("pointerdown", aoClicar, true);
    document.addEventListener("keydown", aoTeclar, true);
    window.addEventListener("scroll", aoMexer, true);
    window.addEventListener("resize", aoMexer);
    return () => {
      document.removeEventListener("pointerdown", aoClicar, true);
      document.removeEventListener("keydown", aoTeclar, true);
      window.removeEventListener("scroll", aoMexer, true);
      window.removeEventListener("resize", aoMexer);
    };
  }, [aberto, reposicionar]);

  const estiloPainel: CSSProperties = {
    left: pos.left,
    width: pos.largura,
    ...(pos.acima ? { bottom: pos.baixo } : { top: pos.topo }),
    transformOrigin: pos.acima ? "bottom center" : "top center",
  };

  return { botaoRef, painelRef, aberto, montado, abrir, fechar, setAberto, estiloPainel };
}
