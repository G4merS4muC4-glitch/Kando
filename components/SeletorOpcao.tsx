"use client";

import { createPortal } from "react-dom";
import { ChevronDown, Check } from "lucide-react";
import { usePopoverFlutuante } from "@/lib/usePopoverFlutuante";

export interface OpcaoSel {
  valor: string;
  rotulo: string;
}
export interface GrupoSel {
  rotulo: string;
  opcoes: OpcaoSel[];
}

/**
 * Seletor (dropdown) proprio, no mesmo estilo do calendario/horario: popover que
 * surge animado, opcoes com realce suave (contorno) no hover e marca a escolhida.
 * Aceita lista simples (`opcoes`) ou agrupada (`grupos`). Portal + posicao fixa.
 */
export default function SeletorOpcao({
  value,
  onChange,
  opcoes,
  grupos,
  placeholder = "Selecionar",
}: {
  value: string;
  onChange: (v: string) => void;
  opcoes?: OpcaoSel[];
  grupos?: GrupoSel[];
  placeholder?: string;
}) {
  const { botaoRef, painelRef, aberto, montado, abrir, fechar, setAberto, estiloPainel } =
    usePopoverFlutuante(260, 320);

  const todas = grupos ? grupos.flatMap((g) => g.opcoes) : (opcoes ?? []);
  const selecionada = todas.find((o) => o.valor === value);

  function botaoOpcao(o: OpcaoSel) {
    const ativo = o.valor === value;
    return (
      <button
        key={o.valor}
        type="button"
        onClick={() => {
          onChange(o.valor);
          fechar();
        }}
        className={`flex w-full items-center justify-between gap-2 rounded-marca px-3 py-2 text-left text-sm outline-none transition-[background-color,box-shadow,color] duration-150 ease-suave ${
          ativo
            ? "bg-marca-laranja/10 font-semibold text-marca-laranja"
            : "text-marca-preto hover:bg-marca-branco hover:shadow-[inset_0_0_0_1.5px_rgba(250,97,30,0.4)]"
        }`}
      >
        <span className="truncate">{o.rotulo}</span>
        {ativo && <Check size={15} className="shrink-0" aria-hidden />}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        ref={botaoRef}
        onClick={() => (aberto ? setAberto(false) : abrir())}
        className="flex w-full items-center justify-between gap-2 rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 text-left text-sm outline-none transition-[border-color,box-shadow] duration-200 ease-suave hover:border-marca-laranja/70 focus-visible:border-marca-laranja focus-visible:ring-2 focus-visible:ring-marca-laranja/40"
      >
        <span className={`truncate ${selecionada ? "text-marca-preto" : "text-marca-cinza/70"}`}>
          {selecionada ? selecionada.rotulo : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-marca-cinza transition-transform duration-200 ease-suave ${aberto ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {montado &&
        aberto &&
        createPortal(
          <div
            ref={painelRef}
            className="fixed z-[80] max-h-[320px] animate-surgir overflow-y-auto rounded-marca border border-marca-cinza/25 bg-white p-1.5 shadow-modal"
            style={estiloPainel}
          >
            {grupos
              ? grupos.map((g) => (
                  <div key={g.rotulo} className="mb-1 last:mb-0">
                    <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-marca-cinza">
                      {g.rotulo}
                    </p>
                    {g.opcoes.map((o) => botaoOpcao(o))}
                  </div>
                ))
              : (opcoes ?? []).map((o) => botaoOpcao(o))}
          </div>,
          document.body
        )}
    </>
  );
}
