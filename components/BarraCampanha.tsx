"use client";

import Link from "next/link";
import { ArrowLeft, Plus, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { TIPOS_CAMPANHA } from "@/lib/config";
import type { Campanha } from "@/lib/types";
import MarcaBadge from "./MarcaBadge";

/**
 * Barra de contexto da campanha (abaixo da navegacao global): voltar, nome da
 * campanha, busca e filtros, alem dos botoes de colar do Claude e novo conteudo.
 */
export default function BarraCampanha({
  campanha,
  onNovo,
  onColar,
  children,
}: {
  campanha: Campanha;
  onNovo: () => void;
  onColar: () => void;
  children: ReactNode; // busca e filtros
}) {
  const tipoConf = TIPOS_CAMPANHA[campanha.tipo];

  return (
    <div className="border-b border-marca-cinza/30 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {/* Voltar e identificacao da campanha */}
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/"
            aria-label="Voltar para campanhas"
            title="Voltar para campanhas"
            className="rounded-marca p-2 text-marca-cinza transition hover:bg-marca-branco hover:text-marca-azulEscuro"
          >
            <ArrowLeft size={18} aria-hidden />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <MarcaBadge marca={campanha.marca} tamanho="pequeno" />
              <span className="text-xs font-semibold uppercase tracking-wide text-marca-cinza">
                {tipoConf.label}
              </span>
            </div>
            <h1 className="text-lg font-bold leading-tight text-marca-azulEscuro">
              {campanha.nome}
            </h1>
          </div>
        </div>

        {/* Busca e filtros. No mobile, ocupam uma linha propria (sem corte); no
            desktop ficam inline entre o nome e as acoes. */}
        <div className="order-last w-full sm:order-none sm:flex-1">{children}</div>

        {/* Acoes */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onColar}
            className="flex items-center gap-1.5 rounded-marca border border-marca-azulClaro px-3 py-2 text-sm font-semibold text-marca-azulClaro transition hover:bg-marca-azulClaro hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-azulClaro"
          >
            <Sparkles size={16} aria-hidden />
            Colar do Claude
          </button>
          <button
            type="button"
            onClick={onNovo}
            className="flex items-center gap-1.5 rounded-marca bg-marca-laranja px-4 py-2 text-sm font-bold text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-azulEscuro"
          >
            <Plus size={16} aria-hidden />
            Novo conteudo
          </button>
        </div>
      </div>
    </div>
  );
}
