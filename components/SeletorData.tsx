"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { DIAS_SEMANA, MESES, dataDeISO, formatarData, gerarGradeMes, hojeISO } from "@/lib/util";
import { usePopoverFlutuante } from "@/lib/usePopoverFlutuante";

/**
 * Seletor de data proprio (substitui o input nativo). Abre um calendario com
 * animacao de surgimento; cada dia e um bloquinho que inclina em 3D seguindo o
 * cursor. Usa portal + posicao fixa para nao ser cortado dentro do modal.
 */
export default function SeletorData({
  value,
  onChange,
  placeholder = "Selecionar data",
}: {
  value?: string; // yyyy-mm-dd
  onChange: (iso: string | undefined) => void;
  placeholder?: string;
}) {
  const { botaoRef, painelRef, aberto, montado, abrir, fechar, setAberto, estiloPainel } =
    usePopoverFlutuante(300, 360);

  const base = value ? dataDeISO(value) : new Date();
  const [ano, setAno] = useState(base.getFullYear());
  const [mes, setMes] = useState(base.getMonth());

  function abrirCalendario() {
    const d = value ? dataDeISO(value) : new Date();
    setAno(d.getFullYear());
    setMes(d.getMonth());
    abrir();
  }

  function irMes(delta: number) {
    let m = mes + delta;
    let a = ano;
    if (m < 0) {
      m = 11;
      a -= 1;
    } else if (m > 11) {
      m = 0;
      a += 1;
    }
    setMes(m);
    setAno(a);
  }

  function selecionar(chave: string) {
    onChange(chave);
    fechar();
  }

  const grade = gerarGradeMes(ano, mes);

  return (
    <>
      <button
        type="button"
        ref={botaoRef}
        onClick={() => (aberto ? setAberto(false) : abrirCalendario())}
        className="flex w-full items-center justify-between gap-2 rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 text-left text-sm text-marca-preto outline-none transition-[border-color,box-shadow] duration-200 ease-suave hover:border-marca-laranja/70 focus-visible:border-marca-laranja focus-visible:ring-2 focus-visible:ring-marca-laranja/40"
      >
        <span className={value ? "text-marca-preto" : "text-marca-cinza/70"}>
          {value ? formatarData(value) : placeholder}
        </span>
        <Calendar size={16} className="shrink-0 text-marca-cinza" aria-hidden />
      </button>

      {montado &&
        aberto &&
        createPortal(
          <div
            ref={painelRef}
            className="fixed z-[80] animate-surgir rounded-marca border border-marca-cinza/25 bg-white p-3 shadow-modal"
            style={estiloPainel}
          >
            {/* Cabecalho: mes e navegacao */}
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold capitalize text-marca-azulEscuro">
                {MESES[mes].toLowerCase()} de {ano}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => irMes(-1)}
                  aria-label="Mês anterior"
                  className="rounded-marca p-1.5 text-marca-cinza transition hover:bg-marca-branco hover:text-marca-azulEscuro"
                >
                  <ChevronLeft size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => irMes(1)}
                  aria-label="Próximo mês"
                  className="rounded-marca p-1.5 text-marca-cinza transition hover:bg-marca-branco hover:text-marca-azulEscuro"
                >
                  <ChevronRight size={16} aria-hidden />
                </button>
              </div>
            </div>

            {/* Dias da semana */}
            <div className="mb-1 grid grid-cols-7 gap-1">
              {DIAS_SEMANA.map((d) => (
                <div
                  key={d}
                  className="py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-marca-cinza"
                >
                  {d.charAt(0)}
                </div>
              ))}
            </div>

            {/* Bloquinhos dos dias (3D no hover) */}
            <div className="grid grid-cols-7 gap-1">
              {grade.map((dia, i) => (
                <Dia3D
                  key={dia.chave}
                  numero={dia.data.getDate()}
                  noMes={dia.noMes}
                  hoje={dia.hoje}
                  selecionado={value === dia.chave}
                  indice={i}
                  onSelecionar={() => selecionar(dia.chave)}
                />
              ))}
            </div>

            {/* Rodape: limpar e hoje */}
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
                onClick={() => selecionar(hojeISO())}
                className="rounded-marca px-2 py-1 font-semibold text-marca-laranja transition hover:brightness-95"
              >
                Hoje
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

/** Bloquinho de um dia: inclina em 3D seguindo o cursor, com leve elevacao. */
function Dia3D({
  numero,
  noMes,
  hoje,
  selecionado,
  indice,
  onSelecionar,
}: {
  numero: number;
  noMes: boolean;
  hoje: boolean;
  selecionado: boolean;
  indice: number;
  onSelecionar: () => void;
}) {
  // Contorno laranja + sombra de elevacao (some quando o cursor sai).
  const SOMBRA_DIA = "inset 0 0 0 1.5px rgba(250, 97, 30, 0.85), 0 10px 20px -8px rgba(0, 41, 82, 0.3)";
  // Entrada: SEM transicao no transform (o tilt acompanha o cursor na hora);
  // so o contorno/fundo surgem suaves.
  function aoEntrar(e: React.PointerEvent<HTMLButtonElement>) {
    const el = e.currentTarget;
    el.style.transition = "box-shadow 150ms ease, background-color 150ms ease";
    el.style.transform = "perspective(480px) translateZ(8px) scale(1.08)";
    el.style.zIndex = "3";
    if (!selecionado) el.style.boxShadow = SOMBRA_DIA;
  }
  // Movimento: inclina 3D seguindo o cursor, instantaneo (sem delay).
  function aoMover(e: React.PointerEvent<HTMLButtonElement>) {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(480px) rotateX(${(-py * 22).toFixed(2)}deg) rotateY(${(px * 22).toFixed(2)}deg) translateZ(12px) scale(1.1)`;
  }
  // Saida: SO aqui anima o transform de volta (entrada/saida suaves, sem travar).
  function aoSair(e: React.PointerEvent<HTMLButtonElement>) {
    const el = e.currentTarget;
    el.style.transition = "transform 200ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 200ms ease";
    el.style.transform = "";
    el.style.zIndex = "";
    el.style.boxShadow = "";
  }

  return (
    <button
      type="button"
      onPointerEnter={aoEntrar}
      onPointerMove={aoMover}
      onPointerLeave={aoSair}
      onClick={onSelecionar}
      style={{ animationDelay: `${Math.min(indice * 8, 220)}ms` }}
      className={`relative flex h-9 animate-diaEntra items-center justify-center rounded-marca text-sm font-medium outline-none will-change-transform focus-visible:ring-2 focus-visible:ring-marca-laranja ${
        selecionado
          ? "bg-marca-laranja font-bold text-white shadow-dia"
          : hoje
            ? "font-bold text-marca-laranja ring-2 ring-inset ring-marca-laranja/70 hover:bg-marca-branco"
            : noMes
              ? "text-marca-preto hover:bg-marca-branco"
              : "text-marca-cinza/40 hover:bg-marca-branco"
      }`}
    >
      {numero}
    </button>
  );
}
