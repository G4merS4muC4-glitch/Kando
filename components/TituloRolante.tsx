"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Nome que desliza do inicio ao fim e volta, em loop, quando nao cabe na largura
 * disponivel. Se o aparelho pede menos movimento, fica parado com reticencias
 * (sem cortar no meio da palavra). Usado nas pilulas flutuantes (timer e prazo).
 */
export default function TituloRolante({ texto }: { texto: string }) {
  const contRef = useRef<HTMLDivElement>(null);
  const txtRef = useRef<HTMLSpanElement>(null);
  const [desloc, setDesloc] = useState(0);
  const [reduzido, setReduzido] = useState(false);

  useEffect(() => {
    const medir = () => {
      const c = contRef.current;
      const t = txtRef.current;
      if (!c || !t) return;
      const over = t.scrollWidth - c.clientWidth;
      setDesloc(over > 4 ? over : 0);
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [texto]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const aplicar = () => setReduzido(mq.matches);
    aplicar();
    mq.addEventListener?.("change", aplicar);
    return () => mq.removeEventListener?.("change", aplicar);
  }, []);

  const animar = desloc > 0 && !reduzido;
  // ~28px/s de leitura, ida e volta, com folga para as pausas em cada ponta.
  const dur = Math.max(7, Math.round((desloc / 28) * 2) + 4);

  return (
    <div ref={contRef} className="pointer-events-none min-w-0 flex-1 overflow-hidden">
      <span
        ref={txtRef}
        title={texto}
        className={`text-sm font-semibold ${
          animar ? "inline-block whitespace-nowrap tp-nome-rolante" : "block truncate"
        }`}
        style={
          animar
            ? ({
                "--tp-nome-desloc": `-${desloc}px`,
                "--tp-nome-dur": `${dur}s`,
              } as React.CSSProperties)
            : undefined
        }
      >
        {texto}
      </span>
    </div>
  );
}
