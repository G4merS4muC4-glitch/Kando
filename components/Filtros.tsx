"use client";

import { Search, X } from "lucide-react";
import { CANAIS, CANAIS_ORDEM, TIPOS, TIPOS_ORDEM } from "@/lib/config";
import type { FiltrosState } from "@/lib/types";

const selectClasse =
  "rounded-marca border border-marca-cinza/40 bg-white px-2.5 py-2 text-sm text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40";

/**
 * Busca por titulo e filtros por tipo, canal e tema.
 * Todos funcionam em conjunto (o quadro mostra apenas o que satisfaz todos).
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
  const temFiltroAtivo =
    filtros.busca !== "" ||
    filtros.tipo !== "todos" ||
    filtros.canal !== "todos" ||
    filtros.tema !== "todos";

  return (
    <div className="flex flex-1 flex-wrap items-center gap-2">
      {/* Busca por titulo */}
      <div className="relative w-full sm:w-auto sm:min-w-[180px] sm:flex-1">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-marca-cinza"
          aria-hidden
        />
        <input
          type="search"
          value={filtros.busca}
          onChange={(e) => onChange({ busca: e.target.value })}
          placeholder="Buscar por titulo..."
          aria-label="Buscar por titulo"
          className="w-full rounded-marca border border-marca-cinza/40 bg-white py-2 pl-9 pr-3 text-sm text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
        />
      </div>

      {/* Filtro por tipo */}
      <select
        value={filtros.tipo}
        onChange={(e) => onChange({ tipo: e.target.value as FiltrosState["tipo"] })}
        aria-label="Filtrar por tipo de conteudo"
        className={selectClasse}
      >
        <option value="todos">Todos os tipos</option>
        {TIPOS_ORDEM.map((t) => (
          <option key={t} value={t}>
            {TIPOS[t].label}
          </option>
        ))}
      </select>

      {/* Filtro por canal */}
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

      {/* Filtro por tema */}
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

      {/* Limpar filtros */}
      {temFiltroAtivo && (
        <button
          type="button"
          onClick={() => onChange({ busca: "", tipo: "todos", canal: "todos", tema: "todos" })}
          className="flex items-center gap-1 rounded-marca px-2.5 py-2 text-sm font-medium text-marca-cinza transition hover:bg-marca-branco hover:text-marca-azulEscuro"
        >
          <X size={14} aria-hidden />
          Limpar
        </button>
      )}
    </div>
  );
}
