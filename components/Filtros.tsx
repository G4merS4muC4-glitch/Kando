"use client";

import { createPortal } from "react-dom";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { CANAIS, CANAIS_ORDEM, TIPOS, TIPOS_ORDEM } from "@/lib/config";
import type { FiltrosState } from "@/lib/types";
import { usePopoverFlutuante } from "@/lib/usePopoverFlutuante";

const selectClasse =
  "w-full rounded-marca border border-marca-cinza/40 bg-white px-2.5 py-2 text-sm text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40";

/**
 * Busca por titulo + filtros (tipo, canal, tema).
 * A busca fica sempre visivel e os tres filtros ficam atras de um unico botao
 * "Filtros" ao lado, que abre um painel. Assim tudo cabe em uma linha so, no
 * mobile e no desktop, sem as fileiras de menus ocupando espaco vertical.
 */
export default function Filtros({
  filtros,
  onChange,
  temas,
}: {
  filtros: FiltrosState;
  onChange: (parcial: Partial<FiltrosState>) => void;
  temas: string[];
}) {
  return (
    <div className="flex w-full items-center gap-2">
      {/* Busca por titulo */}
      <div className="relative min-w-0 flex-1">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-marca-cinza"
          aria-hidden
        />
        <input
          type="search"
          value={filtros.busca}
          onChange={(e) => onChange({ busca: e.target.value })}
          placeholder="Buscar por título..."
          aria-label="Buscar por título"
          className="w-full rounded-marca border border-marca-cinza/40 bg-white py-2 pl-9 pr-3 text-sm text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
        />
      </div>

      {/* Botao unico de filtros (abre o painel com tipo, canal e tema) */}
      <BotaoFiltros filtros={filtros} onChange={onChange} temas={temas} />
    </div>
  );
}

/** Botao "Filtros" com contador de ativos; abre um painel flutuante com os tres filtros. */
function BotaoFiltros({
  filtros,
  onChange,
  temas,
}: {
  filtros: FiltrosState;
  onChange: (parcial: Partial<FiltrosState>) => void;
  temas: string[];
}) {
  const { botaoRef, painelRef, aberto, montado, abrir, fechar, setAberto, estiloPainel } =
    usePopoverFlutuante(260, 340);

  const ativos =
    (filtros.tipo !== "todos" ? 1 : 0) +
    (filtros.canal !== "todos" ? 1 : 0) +
    (filtros.tema !== "todos" ? 1 : 0);

  return (
    <>
      <button
        type="button"
        ref={botaoRef}
        onClick={() => (aberto ? setAberto(false) : abrir())}
        aria-label="Filtros"
        aria-expanded={aberto}
        className={`flex shrink-0 items-center gap-1.5 rounded-marca border px-3 py-2 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-marca-laranja/40 ${
          ativos > 0 || aberto
            ? "border-marca-laranja text-marca-laranja"
            : "border-marca-cinza/40 text-marca-azulEscuro hover:border-marca-laranja hover:text-marca-laranja"
        }`}
      >
        <SlidersHorizontal size={16} aria-hidden />
        <span className="hidden espacoso:inline">Filtros</span>
        {ativos > 0 && (
          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-marca-laranja px-1 text-[11px] font-bold text-white">
            {ativos}
          </span>
        )}
      </button>

      {montado &&
        aberto &&
        createPortal(
          <div
            ref={painelRef}
            className="fixed z-[80] animate-surgir rounded-marca border border-marca-cinza/25 bg-white p-3 shadow-modal"
            style={estiloPainel}
          >
            <div className="flex flex-col gap-2.5">
              <CampoFiltro rotulo="Tipo de conteúdo">
                <select
                  value={filtros.tipo}
                  onChange={(e) => onChange({ tipo: e.target.value as FiltrosState["tipo"] })}
                  aria-label="Filtrar por tipo de conteúdo"
                  className={selectClasse}
                >
                  <option value="todos">Todos os tipos</option>
                  {TIPOS_ORDEM.map((t) => (
                    <option key={t} value={t}>
                      {TIPOS[t].label}
                    </option>
                  ))}
                </select>
              </CampoFiltro>

              <CampoFiltro rotulo="Canal">
                <select
                  value={filtros.canal}
                  onChange={(e) => onChange({ canal: e.target.value as FiltrosState["canal"] })}
                  aria-label="Filtrar por canal"
                  className={selectClasse}
                >
                  <option value="todos">Todos os canais</option>
                  {CANAIS_ORDEM.map((c) => (
                    <option key={c} value={c}>
                      {CANAIS[c].label}
                    </option>
                  ))}
                </select>
              </CampoFiltro>

              <CampoFiltro rotulo="Tema">
                <select
                  value={filtros.tema}
                  onChange={(e) => onChange({ tema: e.target.value })}
                  aria-label="Filtrar por tema"
                  className={selectClasse}
                >
                  <option value="todos">Todos os temas</option>
                  {temas.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </CampoFiltro>

              {ativos > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onChange({ tipo: "todos", canal: "todos", tema: "todos" });
                    fechar();
                  }}
                  className="mt-0.5 flex items-center justify-center gap-1 rounded-marca border border-marca-cinza/40 px-2.5 py-2 text-sm font-semibold text-marca-cinza transition hover:border-marca-vermelho hover:text-marca-vermelho"
                >
                  <X size={14} aria-hidden />
                  Limpar filtros
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

/** Rotulo curto acima de cada filtro no painel. */
function CampoFiltro({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-marca-cinza">
        {rotulo}
      </span>
      {children}
    </label>
  );
}
