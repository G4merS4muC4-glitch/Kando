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
  FlipHorizontal,
  Type,
} from "lucide-react";

/**
 * Teleprompter em tela cheia para o roteiro.
 * Texto grande e legivel, auto-scroll com velocidade ajustavel, tamanho de
 * fonte, e modo espelhado (horizontal e vertical) para uso com vidro de
 * teleprompter. Funciona bem no celular: controles compactos, fonte adaptada e
 * toque na tela para rolar/pausar.
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
  // Fonte menor por padrao no celular (cabe mais palavra por linha).
  const [tamanho, setTamanho] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 640 ? 30 : 44
  );
  const [velocidade, setVelocidade] = useState(1.4); // px por quadro
  // Espelho para o vidro do teleprompter: inverte so a esquerda-direita. Mantem a
  // ordem (comeca da primeira linha); no vidro o texto le normal, do comeco ao fim.
  const [espelhoH, setEspelhoH] = useState(false);

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

  // Bloqueia o scroll do corpo enquanto o teleprompter esta aberto.
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

  const botaoIcone =
    "rounded-marca bg-white/10 p-2 text-white transition hover:bg-white/20 active:bg-white/30";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0b0d12] text-white animate-fadeIn">
      {/* Barra de controles (compacta e com quebra de linha no celular) */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2 sm:px-5 sm:py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTocando((t) => !t)}
            className="flex items-center gap-2 rounded-marca bg-marca-laranja px-4 py-2 text-sm font-bold text-white transition hover:brightness-95"
          >
            {tocando ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
            {tocando ? "Pausar" : "Rolar"}
          </button>
          <button type="button" onClick={reiniciar} title="Reiniciar do topo" className={botaoIcone}>
            <RotateCcw size={16} aria-hidden />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-3">
          {/* Velocidade */}
          <div className="flex items-center gap-1">
            <Turtle size={16} aria-hidden className="hidden text-white/60 sm:block" />
            <button
              type="button"
              onClick={() => setVelocidade((v) => Math.max(0.4, +(v - 0.4).toFixed(1)))}
              className={botaoIcone}
              aria-label="Diminuir velocidade"
            >
              <Minus size={14} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setVelocidade((v) => Math.min(6, +(v + 0.4).toFixed(1)))}
              className={botaoIcone}
              aria-label="Aumentar velocidade"
            >
              <Plus size={14} aria-hidden />
            </button>
            <Rabbit size={16} aria-hidden className="hidden text-white/60 sm:block" />
          </div>

          {/* Tamanho da fonte */}
          <div className="flex items-center gap-1">
            <Type size={15} aria-hidden className="text-white/60" />
            <button
              type="button"
              onClick={() => setTamanho((t) => Math.max(20, t - 4))}
              className={botaoIcone}
              aria-label="Diminuir fonte"
            >
              <Minus size={14} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => setTamanho((t) => Math.min(100, t + 4))}
              className={botaoIcone}
              aria-label="Aumentar fonte"
            >
              <Plus size={14} aria-hidden />
            </button>
          </div>

          {/* Espelho para o vidro do teleprompter (inverte so esquerda-direita;
              mantem a ordem, comecando da primeira linha) */}
          <button
            type="button"
            onClick={() => setEspelhoH((e) => !e)}
            aria-pressed={espelhoH}
            title="Espelho para o vidro do teleprompter: no vidro o texto le normal, do começo ao fim"
            className={`flex items-center gap-1.5 rounded-marca px-2.5 py-2 text-sm font-semibold transition ${
              espelhoH ? "bg-marca-laranja text-white" : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <FlipHorizontal size={16} aria-hidden />
            <span className="hidden sm:inline">Espelho</span>
          </button>

          <button
            type="button"
            onClick={onFechar}
            className="flex items-center gap-1.5 rounded-marca bg-white/10 px-3 py-2 text-sm font-semibold transition hover:bg-white/20"
          >
            <X size={16} aria-hidden />
            <span className="hidden sm:inline">Fechar</span>
          </button>
        </div>
      </div>

      {/* Texto do roteiro. Tocar na area rola/pausa (pratico no celular). */}
      <div
        ref={areaRef}
        onClick={() => setTocando((t) => !t)}
        className="flex-1 cursor-pointer overflow-y-auto overscroll-contain px-5 py-12 sm:px-16 sm:py-16"
      >
        <div
          className="mx-auto max-w-4xl"
          style={{ transform: `scaleX(${espelhoH ? -1 : 1})` }}
        >
          <p
            className="whitespace-pre-wrap text-center font-semibold"
            style={{ fontSize: `${tamanho}px`, lineHeight: 1.5 }}
          >
            {texto.trim() || "Sem roteiro para exibir."}
          </p>
          {/* Espaco extra ao final para o texto poder rolar ate sair da tela. */}
          <div className="h-[60vh]" aria-hidden />
        </div>
      </div>

      {/* Dicas discretas */}
      <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-center">
        {espelhoH && (
          <p className="rounded-marca bg-white/10 px-3 py-1 text-[11px] font-medium text-white/75">
            Espelho para o vidro: as letras saem invertidas aqui, mas no vidro o texto lê normal, do
            começo ao fim.
          </p>
        )}
        <p className="text-[11px] text-white/40">Toque na tela para rolar ou pausar</p>
      </div>
    </div>
  );
}
