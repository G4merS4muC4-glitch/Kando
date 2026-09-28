"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

const FECHAR_PX = 90; // arrastou mais que isso para baixo: fecha
const FECHAR_VELOCIDADE = 0.6; // ou soltou rapido (px/ms), num gesto de "jogar para baixo"
const SAIDA_MS = 220;

/**
 * Folha que sobe do rodape (padrao de app no celular): fundo escurecido, alca no
 * topo e fecha tocando fora, com Esc ou arrastando para baixo (a folha segue o
 * dedo e volta ao lugar se o gesto for curto). Vai para o <body> via portal, para
 * nao ficar presa em nenhum container com rolagem ou transform.
 */
export default function FolhaInferior({
  onFechar,
  titulo,
  subtitulo,
  children,
}: {
  onFechar: () => void;
  titulo?: ReactNode;
  subtitulo?: ReactNode;
  children: ReactNode;
}) {
  const [montado, setMontado] = useState(false);
  const [dy, setDy] = useState(0);
  const [saindo, setSaindo] = useState(false);
  const arraste = useRef<{ y0: number; t0: number; ultimoY: number; ultimoT: number } | null>(null);
  // So fecha no fundo se o toque COMECOU no fundo: ao abrir a folha segurando um
  // card, soltar o dedo gera um clique no mesmo ponto (ja em cima do fundo).
  const tocouFundo = useRef(false);
  const onFecharRef = useRef(onFechar);
  onFecharRef.current = onFechar;

  function fechar() {
    if (saindo) return;
    setSaindo(true);
    window.setTimeout(() => onFecharRef.current(), SAIDA_MS);
  }

  useEffect(() => {
    setMontado(true);
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") fechar();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function aoPressionar(e: PointerEvent<HTMLDivElement>) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    arraste.current = { y0: e.clientY, t0: e.timeStamp, ultimoY: e.clientY, ultimoT: e.timeStamp };
  }
  function aoMover(e: PointerEvent<HTMLDivElement>) {
    const a = arraste.current;
    if (!a) return;
    a.ultimoY = e.clientY;
    a.ultimoT = e.timeStamp;
    setDy(Math.max(0, e.clientY - a.y0));
  }
  function aoSoltar(e: PointerEvent<HTMLDivElement>) {
    const a = arraste.current;
    arraste.current = null;
    if (!a) return;
    const dist = e.clientY - a.y0;
    const vel = dist / Math.max(1, e.timeStamp - a.t0);
    if (dist > FECHAR_PX || (dist > 20 && vel > FECHAR_VELOCIDADE)) fechar();
    else setDy(0);
  }

  if (!montado) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col justify-end" role="dialog" aria-modal="true">
      <div
        className={`absolute inset-0 bg-marca-preto/45 transition-opacity duration-200 ${
          saindo ? "opacity-0" : "animate-fadeIn"
        }`}
        onPointerDown={() => {
          tocouFundo.current = true;
        }}
        onClick={() => {
          if (tocouFundo.current) fechar();
          tocouFundo.current = false;
        }}
        aria-hidden
      />
      <div
        className={`relative max-h-[88dvh] overflow-hidden rounded-t-[1.75rem] bg-white pb-[env(safe-area-inset-bottom)] shadow-modal ${
          saindo ? "" : "animate-folhaSobe"
        }`}
        style={{
          transform: saindo ? "translateY(100%)" : dy ? `translateY(${dy}px)` : undefined,
          transition: arraste.current ? "none" : `transform ${SAIDA_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }}
      >
        {/* Alca + titulo: area de arrastar para baixo */}
        <div
          className="cursor-grab touch-none select-none px-5 pb-2 pt-2.5 active:cursor-grabbing"
          onPointerDown={aoPressionar}
          onPointerMove={aoMover}
          onPointerUp={aoSoltar}
          onPointerCancel={aoSoltar}
        >
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-marca-cinza/35" aria-hidden />
          {titulo && <div className="text-base font-bold leading-snug text-marca-azulEscuro">{titulo}</div>}
          {subtitulo && <div className="mt-0.5 text-xs text-marca-cinza">{subtitulo}</div>}
        </div>
        <div className="max-h-[calc(88dvh-4rem)] overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
