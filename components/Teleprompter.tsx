"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Minus,
  Plus,
  Rabbit,
  Turtle,
} from "lucide-react";

/**
 * Teleprompter em tela cheia para o roteiro.
 * Texto grande e legivel, com auto-scroll de velocidade ajustavel, controle de
 * tamanho da fonte e botao de reiniciar. Ideal para gravar lendo a fala.
 */
export default function Teleprompter({
  texto,
  onFechar,
}: {
  texto: string;
  onFechar: () => void;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [tocando, setTocando] = useState(false);
  const [tamanho, setTamanho] = useState(44); // tamanho da fonte em px
  const [velocidade, setVelocidade] = useState(1.4); // px por quadro

  // Fecha com Esc (em captura, para nao fechar tambem o modal por baixo).
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        e.preventDefault();
        onFechar();
      }
    }
    window.addEventListener("keydown", aoTeclar, true);
    return () => window.removeEventListener("keydown", aoTeclar, true);
  }, [onFechar]);

  // Bloqueia o scroll do corpo enquanto o teleprompter esta aberto (autocontido).
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  // Loop de auto-scroll.
  useEffect(() => {
    if (!tocando) return;
    let raf = 0;
    const passo = () => {
      const el = areaRef.current;
      if (el) {
        el.scrollTop += velocidade;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
          setTocando(false);
          return;
        }
      }
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [tocando, velocidade]);

  function reiniciar() {
    if (areaRef.current) areaRef.current.scrollTop = 0;
    setTocando(false);
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0b0d12] text-white animate-fadeIn">
      {/* Barra de controles */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTocando((t) => !t)}
            className="flex items-center gap-2 rounded-marca bg-marca-laranja px-4 py-2 text-sm font-bold text-white transition hover:brightness-95"
          >
            {tocando ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
            {tocando ? "Pausar" : "Rolar"}
          </button>
          <button
            type="button"
            onClick={reiniciar}
            title="Reiniciar do topo"
            className="rounded-marca bg-white/10 p-2 text-white transition hover:bg-white/20"
          >
            <RotateCcw size={16} aria-hidden />
          </button>
        </div>

        <div className="flex items-center gap-4 text-sm">
          {/* Velocidade */}
          <div className="flex items-center gap-1.5">
            <Turtle size={16} aria-hidden className="text-white/60" />
            <button
              type="button"
              onClick={() => setVelocidade((v) => Math.max(0.4, +(v - 0.4).toFixed(1)))}
              className="rounded-marca bg-white/10 p-1.5 transition hover:bg-white/20"
              aria-label="Diminuir velocidade"
            >
              <Minus size={14} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setVelocidade((v) => Math.min(6, +(v + 0.4).toFixed(1)))}
              className="rounded-marca bg-white/10 p-1.5 transition hover:bg-white/20"
              aria-label="Aumentar velocidade"
            >
              <Plus size={14} aria-hidden />
            </button>
            <Rabbit size={16} aria-hidden className="text-white/60" />
          </div>

          {/* Tamanho da fonte */}
          <div className="flex items-center gap-1.5">
            <span className="text-white/60">Fonte</span>
            <button
              type="button"
              onClick={() => setTamanho((t) => Math.max(22, t - 4))}
              className="rounded-marca bg-white/10 p-1.5 transition hover:bg-white/20"
              aria-label="Diminuir fonte"
            >
              <Minus size={14} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setTamanho((t) => Math.min(96, t + 4))}
              className="rounded-marca bg-white/10 p-1.5 transition hover:bg-white/20"
              aria-label="Aumentar fonte"
            >
              <Plus size={14} aria-hidden />
            </button>
          </div>

          <button
            type="button"
            onClick={onFechar}
            className="flex items-center gap-1.5 rounded-marca bg-white/10 px-3 py-2 font-semibold transition hover:bg-white/20"
          >
            <X size={16} aria-hidden />
            Fechar
          </button>
        </div>
      </div>

      {/* Texto do roteiro */}
      <div ref={areaRef} className="flex-1 overflow-y-auto scroll-smooth px-6 py-16 sm:px-16">
        <div className="mx-auto max-w-4xl">
          <p
            className="whitespace-pre-wrap text-center font-semibold leading-relaxed"
            style={{ fontSize: `${tamanho}px`, lineHeight: 1.5 }}
          >
            {texto.trim() || "Sem roteiro para exibir."}
          </p>
          {/* Espaco extra ao final para o texto poder rolar ate sair da tela. */}
          <div className="h-[50vh]" aria-hidden />
        </div>
      </div>
    </div>
  );
}
