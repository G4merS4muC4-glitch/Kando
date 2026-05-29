"use client";

import { AlertTriangle } from "lucide-react";
import { useBoard } from "@/lib/store";

/**
 * Faixa de aviso quando o app nao consegue carregar os dados do Supabase
 * (rede ou login). Enquanto isso, o salvamento automatico fica desligado para
 * nao sobrescrever os dados reais do time por engano.
 */
export default function AvisoErroCarregar() {
  const { erroCarregar } = useBoard();
  if (!erroCarregar) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[70] flex flex-wrap items-center justify-center gap-3 px-4 py-2 text-sm font-semibold text-white"
      style={{ backgroundColor: "#EC1313" }}
    >
      <span className="flex items-center gap-2">
        <AlertTriangle size={16} aria-hidden />
        Nao foi possivel carregar os dados. Verifique a conexao e o login.
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-marca bg-white/20 px-3 py-1 transition hover:bg-white/30"
      >
        Recarregar
      </button>
    </div>
  );
}
