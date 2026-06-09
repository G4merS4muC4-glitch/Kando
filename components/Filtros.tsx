"use client";

import { useState } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { CANAIS, CANAIS_ORDEM, TIPOS, TIPOS_ORDEM } from "@/lib/config";
import type { FiltrosState } from "@/lib/types";

const selectClasse =
  "rounded-marca border border-marca-cinza/40 bg-white px-2.5 py-2 text-sm text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40";

/**
 * Busca por titulo e filtros por tipo, canal e tema.
 * Desktop: tudo inline (busca + tres filtros).
 * Mobile: comeca como um unico botao de lupa; ao abrir, vira o campo de busca
 * com um botao de filtro ao lado (que revela os tres filtros num painel),
 * deixando a entrada bem mais limpa.
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
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  const temFiltroSelect =
    filtros.tipo !== "todos" || filtros.canal !== "todos" || filtros.tema !== "todos";
  const temFiltroAtivo = filtros.busca !== "" || temFiltroSelect;

  /** Os tres selects (reaproveitados no desktop inline e no painel do mobile). */
  function selects(extra = "") {
    return (
      <>
        <select
          value={filtros.tipo}
          onChange={(e) => onChange({ tipo: e.target.value as FiltrosState["tipo"] })}
          aria-label="Filtrar por tipo de conteúdo"
          className={`${selectClasse} ${extra}`}
        >
          <option value="todos">Todos os tipos</option>
          {TIPOS_ORDEM.map((t) => (
            <option key={t} value={t}>
              {TIPOS[t].label}
            </option>
          ))}
        </select>

        <select
          value={filtros.canal}
          onChange={(e) => onChange({ canal: e.target.value as FiltrosState["canal"] })}
          aria-label="Filtrar por canal"
          className={`${selectClasse} ${extra}`}
        >
          <option value="todos">Todos os canais</option>
          {CANAIS_ORDEM.map((c) => (
            <option key={c} value={c}>
              {CANAIS[c].label}
            </option>
          ))}
        </select>

        <select
          value={filtros.tema}
          onChange={(e) => onChange({ tema: e.target.value })}
          aria-label="Filtrar por tema"
          className={`${selectClasse} ${extra}`}
        >
          <option value="todos">Todos os temas</option>
          {temas.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </>
    );
  }

  function limpar() {
    onChange({ busca: "", tipo: "todos", canal: "todos", tema: "todos" });
  }

  return (
    <div className="w-full sm:flex-1">
      {/* Desktop: busca + filtros inline */}
      <div className="hidden flex-wrap items-center gap-2 sm:flex">
        <div className="relative min-w-[180px] flex-1">
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
        {selects()}
        {temFiltroAtivo && (
          <button
            type="button"
            onClick={limpar}
            className="flex items-center gap-1 rounded-marca px-2.5 py-2 text-sm font-medium text-marca-cinza transition hover:bg-marca-branco hover:text-marca-azulEscuro"
          >
            <X size={14} aria-hidden />
            Limpar
          </button>
        )}
      </div>

      {/* Mobile: lupa que abre a busca + botao de filtro */}
      <div className="flex flex-col gap-2 sm:hidden">
        <div className="flex items-center gap-2">
          {!buscaAberta ? (
            <button
              type="button"
              onClick={() => setBuscaAberta(true)}
              aria-label="Buscar e filtrar"
              className="relative flex items-center gap-2 rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 text-sm font-semibold text-marca-cinza transition hover:border-marca-laranja hover:text-marca-laranja focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-laranja"
            >
              <Search size={16} aria-hidden />
              Buscar
              {temFiltroAtivo && (
                <span
                  className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-marca-laranja"
                  aria-hidden
                />
              )}
            </button>
          ) : (
            <>
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-marca-cinza"
                  aria-hidden
                />
                {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                <input
                  type="search"
                  autoFocus
                  value={filtros.busca}
                  onChange={(e) => onChange({ busca: e.target.value })}
                  placeholder="Buscar por título..."
                  aria-label="Buscar por título"
                  className="w-full rounded-marca border border-marca-cinza/40 bg-white py-2 pl-9 pr-3 text-sm text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
                />
              </div>
              <button
                type="button"
                onClick={() => setFiltrosAbertos((o) => !o)}
                aria-label="Filtros"
                aria-expanded={filtrosAbertos}
                className={`relative flex shrink-0 items-center justify-center rounded-marca border px-3 py-2 transition ${
                  filtrosAbertos || temFiltroSelect
                    ? "border-marca-laranja text-marca-laranja"
                    : "border-marca-cinza/40 text-marca-cinza hover:border-marca-laranja hover:text-marca-laranja"
                }`}
              >
                <SlidersHorizontal size={16} aria-hidden />
                {temFiltroSelect && (
                  <span
                    className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-marca-laranja"
                    aria-hidden
                  />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setBuscaAberta(false);
                  setFiltrosAbertos(false);
                }}
                aria-label="Fechar busca"
                className="flex shrink-0 items-center justify-center rounded-marca border border-marca-cinza/40 px-3 py-2 text-marca-cinza transition hover:text-marca-azulEscuro"
              >
                <X size={16} aria-hidden />
              </button>
            </>
          )}
        </div>

        {/* Painel de filtros (mobile) */}
        {buscaAberta && filtrosAbertos && (
          <div className="flex flex-col gap-2 rounded-marca border border-marca-cinza/30 bg-white p-2.5 shadow-card">
            {selects("w-full")}
            {temFiltroAtivo && (
              <button
                type="button"
                onClick={limpar}
                className="flex items-center justify-center gap-1 rounded-marca border border-marca-cinza/40 px-2.5 py-2 text-sm font-medium text-marca-cinza transition hover:text-marca-azulEscuro"
              >
                <X size={14} aria-hidden />
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
