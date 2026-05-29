"use client";

import { MARCAS, MARCAS_ORDEM } from "@/lib/config";
import type { PerfilMetrica } from "@/lib/metricas";

/** Alterna o perfil ativo (Brusoft / Evotalks), no mesmo estilo do filtro de marca. */
export default function SeletorPerfil({
  perfil,
  onChange,
}: {
  perfil: PerfilMetrica;
  onChange: (p: PerfilMetrica) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(MARCAS_ORDEM as PerfilMetrica[]).map((m) => {
        const ativo = perfil === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            aria-pressed={ativo}
            className={`flex items-center gap-1.5 rounded-marca border px-3 py-1.5 text-sm font-semibold transition ${
              ativo
                ? "border-transparent text-white"
                : "border-marca-cinza/40 bg-white text-marca-cinza hover:text-marca-azulEscuro"
            }`}
            style={ativo ? { backgroundColor: MARCAS[m].cor } : undefined}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: ativo ? "rgba(255,255,255,0.9)" : MARCAS[m].cor }}
              aria-hidden
            />
            {MARCAS[m].label}
          </button>
        );
      })}
    </div>
  );
}
