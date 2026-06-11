"use client";

import { useBoard } from "@/lib/store";
import type { PerfilMetrica } from "@/lib/metricas";

/** Alterna o perfil ativo entre as marcas da organizacao, no estilo do filtro de marca. */
export default function SeletorPerfil({
  perfil,
  onChange,
}: {
  perfil: PerfilMetrica;
  onChange: (p: PerfilMetrica) => void;
}) {
  const { marcas } = useBoard();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {marcas.map((m) => {
        const ativo = perfil === m.id;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onChange(m.id)}
            aria-pressed={ativo}
            className={`flex items-center gap-1.5 rounded-marca border px-3 py-1.5 text-sm font-semibold transition ${
              ativo
                ? "border-transparent text-white"
                : "border-marca-cinza/40 bg-white text-marca-cinza hover:text-marca-azulEscuro"
            }`}
            style={ativo ? { backgroundColor: m.cor } : undefined}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: ativo ? "rgba(255,255,255,0.9)" : m.cor }}
              aria-hidden
            />
            {m.nome}
          </button>
        );
      })}
    </div>
  );
}
