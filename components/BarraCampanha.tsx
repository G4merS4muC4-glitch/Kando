"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Sparkles,
  ListChecks,
  Columns3,
  Lightbulb,
  MoreHorizontal,
  ChevronRight,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { TIPOS_CAMPANHA } from "@/lib/config";
import type { Campanha } from "@/lib/types";
import MarcaBadge from "./MarcaBadge";
import GerenciarEtapas from "./GerenciarEtapas";
import ModalSugestoes from "./ModalSugestoes";
import FolhaInferior from "./FolhaInferior";

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
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <>
    <div className="border-b border-marca-cinza/30 bg-white px-3 py-2.5 espacoso:px-4 espacoso:py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 espacoso:gap-x-4 espacoso:gap-y-3">
        {/* Voltar e identificacao da campanha */}
        <div className="flex min-w-0 flex-1 items-center gap-2 espacoso:flex-none espacoso:gap-3">
          <Link
            href="/campanhas"
            aria-label="Voltar para campanhas"
            title="Voltar para campanhas"
            className="pressionavel shrink-0 rounded-full p-2 text-marca-cinza transition hover:bg-marca-branco hover:text-marca-azulEscuro"
          >
            <ArrowLeft size={20} aria-hidden />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <MarcaBadge marca={campanha.marca} tamanho="pequeno" />
              <span className="text-xs font-semibold uppercase tracking-wide text-marca-cinza">
                {tipoConf.label}
              </span>
            </div>
            <h1 className="truncate text-base font-bold leading-tight text-marca-azulEscuro espacoso:text-lg">
              {campanha.nome}
            </h1>
          </div>
        </div>

        {/* Busca e filtros. No mobile, ocupam uma linha propria (sem corte); no
            desktop ficam inline entre o nome e as acoes. */}
        <div className="order-last w-full sm:order-none sm:flex-1">{children}</div>

        {/* Acoes. No desktop, todas com rotulo. No celular, as secundarias ficam
            no menu "..." (com nome e explicacao) e o principal vira "Novo". */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setSugestoesAberto(true)}
            title="Gerar link para colegas mandarem ideias"
            className="hidden items-center gap-1.5 rounded-marca border border-marca-cinza/50 px-3 py-2 text-sm font-semibold text-marca-azulEscuro transition hover:border-marca-azulEscuro hover:bg-marca-branco focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-azulEscuro espacoso:flex"
          >
            <Lightbulb size={16} aria-hidden />
            Sugestões
          </button>
          <button
            type="button"
            onClick={() => setColunasAberto(true)}
            title="Editar colunas do quadro"
            className="hidden items-center gap-1.5 rounded-marca border border-marca-cinza/50 px-3 py-2 text-sm font-semibold text-marca-azulEscuro transition hover:border-marca-azulEscuro hover:bg-marca-branco focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-azulEscuro espacoso:flex"
          >
            <Columns3 size={16} aria-hidden />
            Colunas
          </button>
          <button
            type="button"
            onClick={onColar}
            title="Colar do Claude"
            className="hidden items-center gap-1.5 rounded-marca border border-marca-azulClaro px-3 py-2 text-sm font-semibold text-marca-azulClaro transition hover:bg-marca-azulClaro hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-azulClaro espacoso:flex"
          >
            <Sparkles size={16} aria-hidden />
            Colar do Claude
          </button>
          <button
            type="button"
            onClick={onNovoProjeto}
            title="Criar um projeto com fases e tarefas"
            className="hidden items-center gap-1.5 rounded-marca border border-marca-cinza/50 px-3 py-2 text-sm font-semibold text-marca-azulEscuro transition hover:border-marca-azulEscuro hover:bg-marca-branco focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-azulEscuro espacoso:flex"
          >
            <ListChecks size={16} aria-hidden />
            Projeto
          </button>
          <button
            type="button"
            onClick={() => setMenuAberto(true)}
            aria-label="Mais ações da campanha"
            className="pressionavel flex h-10 w-10 items-center justify-center rounded-full border border-marca-cinza/40 text-marca-azulEscuro espacoso:hidden"
          >
            <MoreHorizontal size={20} aria-hidden />
          </button>
          <button
            type="button"
            onClick={onNovo}
            aria-label="Novo conteúdo"
            title="Novo conteúdo"
            className="pressionavel flex items-center gap-1.5 rounded-full bg-marca-laranja px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-azulEscuro espacoso:rounded-marca espacoso:py-2"
          >
            <Plus size={16} aria-hidden />
            <span className="espacoso:hidden">Novo</span>
            <span className="hidden espacoso:inline">Novo conteúdo</span>
          </button>
        </div>
      </div>
    </div>
    {menuAberto && (
      <FolhaInferior onFechar={() => setMenuAberto(false)} titulo={campanha.nome} subtitulo="Ações da campanha">
        <div className="flex flex-col gap-1.5">
          <ItemMenu
            icone={<ListChecks size={20} aria-hidden />}
            titulo="Novo projeto"
            descricao="Um projeto com fases e tarefas"
            onClick={() => {
              setMenuAberto(false);
              onNovoProjeto();
            }}
          />
          <ItemMenu
            icone={<Sparkles size={20} aria-hidden />}
            titulo="Colar do Claude"
            descricao="Cria os conteúdos a partir de um texto colado"
            onClick={() => {
              setMenuAberto(false);
              onColar();
            }}
          />
          <ItemMenu
            icone={<Lightbulb size={20} aria-hidden />}
            titulo="Link de sugestões"
            descricao="Para colegas mandarem ideias para esta campanha"
            onClick={() => {
              setMenuAberto(false);
              setSugestoesAberto(true);
            }}
          />
          <ItemMenu
            icone={<Columns3 size={20} aria-hidden />}
            titulo="Colunas do quadro"
            descricao="Renomear, reordenar ou criar etapas"
            onClick={() => {
              setMenuAberto(false);
              setColunasAberto(true);
            }}
          />
        </div>
      </FolhaInferior>
    )}
    {colunasAberto && <GerenciarEtapas onFechar={() => setColunasAberto(false)} />}
    {sugestoesAberto && (
      <ModalSugestoes campanha={campanha} onFechar={() => setSugestoesAberto(false)} />
    )}
    </>
  );
}

/** Linha do menu "..." do celular: icone, nome e o que a acao faz. */
function ItemMenu({
  icone,
  titulo,
  descricao,
  onClick,
}: {
  icone: ReactNode;
  titulo: string;
  descricao: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressionavel flex items-center gap-3 rounded-2xl bg-marca-branco px-4 py-3 text-left"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-marca-azulEscuro shadow-card">
        {icone}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-marca-azulEscuro">{titulo}</span>
        <span className="block text-xs text-marca-cinza">{descricao}</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-marca-cinza" aria-hidden />
    </button>
  );
}
