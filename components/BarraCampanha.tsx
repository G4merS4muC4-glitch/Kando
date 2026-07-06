"use client";

import Link from "next/link";
import { ArrowLeft, Plus, Sparkles, ListChecks, Columns3, Lightbulb } from "lucide-react";
import { useState, type ReactNode } from "react";
import { TIPOS_CAMPANHA } from "@/lib/config";
import type { Campanha } from "@/lib/types";
import MarcaBadge from "./MarcaBadge";
import GerenciarEtapas from "./GerenciarEtapas";
import ModalSugestoes from "./ModalSugestoes";

/**
 * Barra de contexto da campanha (abaixo da navegacao global): voltar, nome da
 * campanha, busca e filtros, alem dos botoes de colar do Claude e novo conteudo.
 */
export default function BarraCampanha({
  campanha,
  onNovo,
  onNovoProjeto,
  onColar,
  children,
}: {
  campanha: Campanha;
  onNovo: () => void;
  onNovoProjeto: () => void;
  onColar: () => void;
  children: ReactNode; // busca e filtros
}) {
  const tipoConf = TIPOS_CAMPANHA[campanha.tipo];
  const [colunasAberto, setColunasAberto] = useState(false);
  const [sugestoesAberto, setSugestoesAberto] = useState(false);

  return (
    <>
    <div className="border-b border-marca-cinza/30 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        {/* Voltar e identificacao da campanha */}
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/campanhas"
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

        {/* Acoes. No mobile, os secundarios ficam so com o icone (menos poluicao)
            e o principal vira "Novo"; no desktop, todos com rotulo completo. */}
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setSugestoesAberto(true)}
            aria-label="Link de sugestões"
            title="Gerar link para colegas mandarem ideias"
            className="flex items-center gap-1.5 rounded-marca border border-marca-cinza/50 px-3 py-2 text-sm font-semibold text-marca-azulEscuro transition hover:border-marca-azulEscuro hover:bg-marca-branco focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-azulEscuro"
          >
            <Lightbulb size={16} aria-hidden />
            <span className="hidden espacoso:inline">Sugestões</span>
          </button>
          <button
            type="button"
            onClick={() => setColunasAberto(true)}
            aria-label="Colunas do quadro"
            title="Editar colunas do quadro"
            className="flex items-center gap-1.5 rounded-marca border border-marca-cinza/50 px-3 py-2 text-sm font-semibold text-marca-azulEscuro transition hover:border-marca-azulEscuro hover:bg-marca-branco focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-azulEscuro"
          >
            <Columns3 size={16} aria-hidden />
            <span className="hidden espacoso:inline">Colunas</span>
          </button>
          <button
            type="button"
            onClick={onColar}
            aria-label="Colar do Claude"
            title="Colar do Claude"
            className="flex items-center gap-1.5 rounded-marca border border-marca-azulClaro px-3 py-2 text-sm font-semibold text-marca-azulClaro transition hover:bg-marca-azulClaro hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-azulClaro"
          >
            <Sparkles size={16} aria-hidden />
            <span className="hidden espacoso:inline">Colar do Claude</span>
          </button>
          <button
            type="button"
            onClick={onNovoProjeto}
            aria-label="Novo projeto"
            title="Criar um projeto com fases e tarefas"
            className="flex items-center gap-1.5 rounded-marca border border-marca-cinza/50 px-3 py-2 text-sm font-semibold text-marca-azulEscuro transition hover:border-marca-azulEscuro hover:bg-marca-branco focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-azulEscuro"
          >
            <ListChecks size={16} aria-hidden />
            <span className="hidden espacoso:inline">Projeto</span>
          </button>
          <button
            type="button"
            onClick={onNovo}
            aria-label="Novo conteúdo"
            title="Novo conteúdo"
            className="flex items-center gap-1.5 rounded-marca bg-marca-laranja px-4 py-2 text-sm font-bold text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-azulEscuro"
          >
            <Plus size={16} aria-hidden />
            <span className="espacoso:hidden">Novo</span>
            <span className="hidden espacoso:inline">Novo conteúdo</span>
          </button>
        </div>
      </div>
    </div>
    {colunasAberto && <GerenciarEtapas onFechar={() => setColunasAberto(false)} />}
    {sugestoesAberto && (
      <ModalSugestoes campanha={campanha} onFechar={() => setSugestoesAberto(false)} />
    )}
    </>
  );
}
