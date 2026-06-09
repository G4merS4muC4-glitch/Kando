"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Clock, X } from "lucide-react";
import { usePopoverFlutuante } from "@/lib/usePopoverFlutuante";

const HORAS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
const MINUTOS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

/**
 * Seletor de horario no mesmo padrao do calendario (SeletorData): popover que
 * surge animado, duas colunas (hora e minuto) com bloquinhos que reagem ao
 * cursor. Portal + posicao fixa para nao ser cortado dentro do modal.
 */
export default function SeletorHora({
  value,
  onChange,
  placeholder = "Selecionar horário",
}: {
  value?: string; // HH:MM
  onChange: (hhmm: string | undefined) => void;
  placeholder?: string;
}) {
  const { botaoRef, painelRef, aberto, montado, abrir, fechar, setAberto, estiloPainel } =
    usePopoverFlutuante(220, 300);

  const [hh, mm] = value ? value.split(":") : ["", ""];
  const colHoraRef = useRef<HTMLDivElement>(null);
  const colMinRef = useRef<HTMLDivElement>(null);

  // Ao abrir, centraliza a hora/minuto selecionados nas colunas.
  useEffect(() => {
    if (!aberto) return;
    const centralizar = (col: HTMLDivElement | null, idx: number) => {
      if (!col || idx < 0) return;
      col.scrollTop = Math.max(0, idx * 40 - col.clientHeight / 2 + 20);
    };
    centralizar(colHoraRef.current, HORAS.indexOf(hh));
    centralizar(colMinRef.current, MINUTOS.indexOf(mm));
  }, [aberto, hh, mm]);

  function escolherHora(h: string) {
    onChange(`${h}:${mm || "00"}`);
  }
  function escolherMin(m: string) {
    onChange(`${hh || "00"}:${m}`);
  }
  function agora() {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    onChange(`${p(d.getHours())}:${p(d.getMinutes() - (d.getMinutes() % 5))}`);
  }

  function itemClasse(ativo: boolean) {
    return `flex h-9 shrink-0 items-center justify-center rounded-marca text-sm font-medium outline-none transition-[transform,background-color,box-shadow] duration-150 ease-suave will-change-transform focus-visible:ring-2 focus-visible:ring-marca-laranja ${
      ativo
        ? "bg-marca-laranja font-bold text-white shadow-dia"
        : "text-marca-preto hover:scale-[1.06] hover:bg-white hover:shadow-card"
    }`;
  }

  return (
    <>
      <button
        type="button"
        ref={botaoRef}
        onClick={() => (aberto ? setAberto(false) : abrir())}
        className="flex w-full items-center justify-between gap-2 rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 text-left text-sm text-marca-preto outline-none transition-[border-color,box-shadow] duration-200 ease-suave hover:border-marca-laranja/70 focus-visible:border-marca-laranja focus-visible:ring-2 focus-visible:ring-marca-laranja/40"
      >
        <span className={value ? "text-marca-preto" : "text-marca-cinza/70"}>
          {value ? value : placeholder}
        </span>
        <Clock size={16} className="shrink-0 text-marca-cinza" aria-hidden />
      </button>

      {montado &&
        aberto &&
        createPortal(
          <div
            ref={painelRef}
            className="fixed z-[80] animate-surgir rounded-marca border border-marca-cinza/25 bg-white p-3 shadow-modal"
            style={estiloPainel}
          >
            <div className="mb-2 grid grid-cols-2 gap-2 text-center text-[11px] font-semibold uppercase tracking-wide text-marca-cinza">
              <span>Hora</span>
              <span>Min</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div
                ref={colHoraRef}
                className="flex h-[200px] flex-col gap-1 overflow-y-auto rounded-marca bg-marca-branco/60 p-1"
              >
                {HORAS.map((h) => (
                  <button key={h} type="button" onClick={() => escolherHora(h)} className={itemClasse(h === hh)}>
                    {h}
                  </button>
                ))}
              </div>
              <div
                ref={colMinRef}
                className="flex h-[200px] flex-col gap-1 overflow-y-auto rounded-marca bg-marca-branco/60 p-1"
              >
                {MINUTOS.map((m) => (
                  <button key={m} type="button" onClick={() => escolherMin(m)} className={itemClasse(m === mm)}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-marca-cinza/20 pt-2 text-sm">
              <button
                type="button"
                onClick={() => {
                  onChange(undefined);
                  fechar();
                }}
                className="flex items-center gap-1 rounded-marca px-2 py-1 font-semibold text-marca-cinza transition hover:text-marca-vermelho"
              >
                <X size={14} aria-hidden /> Limpar
              </button>
              <button
                type="button"
                onClick={() => {
                  agora();
                  fechar();
                }}
                className="rounded-marca px-2 py-1 font-semibold text-marca-laranja transition hover:brightness-95"
              >
                Agora
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
