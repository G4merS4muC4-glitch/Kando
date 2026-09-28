"use client";

import { useEffect, useRef, type MouseEvent, type PointerEvent } from "react";

const TOLERANCIA_PX = 8; // mexeu mais que isso: e rolagem, nao pressao longa

/**
 * Pressionar e segurar (toque ou mouse): chama `aoSegurar` depois de `ms` sem
 * mexer o dedo, com uma vibracao curta onde o aparelho suporta. O clique que vem
 * logo depois da pressao longa e engolido (para nao abrir o card por baixo), e o
 * menu do navegador (copiar/salvar imagem) nao aparece.
 */
export function usePressaoLonga(aoSegurar: () => void, ms = 420) {
  const timer = useRef<number | null>(null);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const disparou = useRef(false);
  const aoSegurarRef = useRef(aoSegurar);
  aoSegurarRef.current = aoSegurar;

  const cancelar = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    inicio.current = null;
  };

  useEffect(() => cancelar, []);

  return {
    onPointerDown: (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      disparou.current = false;
      inicio.current = { x: e.clientX, y: e.clientY };
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        disparou.current = true;
        inicio.current = null;
        navigator.vibrate?.(12);
        aoSegurarRef.current();
      }, ms);
    },
    onPointerMove: (e: PointerEvent) => {
      const i = inicio.current;
      if (i && Math.hypot(e.clientX - i.x, e.clientY - i.y) > TOLERANCIA_PX) cancelar();
    },
    onPointerUp: cancelar,
    onPointerCancel: cancelar,
    onPointerLeave: cancelar,
    onContextMenu: (e: MouseEvent) => e.preventDefault(),
    onClickCapture: (e: MouseEvent) => {
      if (disparou.current) {
        e.preventDefault();
        e.stopPropagation();
        disparou.current = false;
      }
    },
  };
}
