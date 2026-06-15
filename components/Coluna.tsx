"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, ChevronRight } from "lucide-react";
import type { CardConteudo, Etapa, EtapaOrg } from "@/lib/types";
import Card from "./Card";

/**
 * Coluna (etapa) do quadro. E uma area que recebe cards arrastados e lista
 * os cards daquela etapa de forma ordenavel.
 *
 * Desktop: colunas lado a lado (Kanban), todas sempre abertas.
 * Mobile: cada coluna vira uma "gaveta" (accordion). As que tem cards abrem
 * sozinhas; as vazias ficam recolhidas e mais apagadas (so o cabecalho, como um
 * minicard sem projeto rodando). Durante um arraste todas abrem para permitir
 * soltar em qualquer etapa.
 */
export default function Coluna({
  coluna,
  cards,
  onAbrir,
  onNovo,
  arrastando = false,
}: {
  coluna: EtapaOrg;
  cards: CardConteudo[];
  onAbrir: (id: string) => void;
  onNovo: (etapa: Etapa) => void;
  arrastando?: boolean;
}) {
  // A coluna inteira e um destino de drop (permite soltar em coluna vazia).
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id });
  const temCards = cards.length > 0;

  // Gaveta (mobile) comeca fechada: o usuario abre ao tocar. O destaque de quais
  // etapas tem conteudo fica no contador (laranja). Durante um arraste, tudo abre
  // para que qualquer etapa possa receber o card.
  const [aberto, setAberto] = useState(false);
  const mostrarCorpo = aberto || arrastando;

  return (
    <section
      className="flex w-full shrink-0 flex-col sm:w-[300px] baixo:snap-start"
      aria-label={coluna.titulo}
    >
      {/* Cabecalho da coluna (paisagem/desktop). Fica FIXO no topo (sticky) com
          fundo solido cobrindo os cards que rolam por baixo. Como a area de cards
          rola sem padding no topo, ele gruda rente ao topo sem card aparecer. */}
      <header className="hidden px-1 sm:sticky sm:top-0 sm:z-20 sm:block sm:bg-marca-branco sm:pb-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-marca-azulEscuro">
            {coluna.titulo}
            <span
              className={`rounded-marca px-2 py-0.5 text-xs font-semibold ${
                temCards ? "bg-marca-laranja text-white" : "bg-marca-azulEscuro/10 text-marca-azulEscuro/60"
              }`}
            >
              {cards.length}
            </span>
          </h2>
        </div>
        <p className="mt-0.5 text-xs text-marca-cinza">{coluna.descricao}</p>
      </header>

      {/* Cabecalho retrato: gaveta (toca para abrir/fechar) + "+" discreto */}
      <div className="mb-2 flex items-stretch gap-1.5 sm:hidden">
        <button
          type="button"
          onClick={() => setAberto((o) => !o)}
          aria-expanded={aberto}
          className={`flex flex-1 items-center gap-2 rounded-marca border px-3 py-2.5 text-left transition ${
            temCards
              ? "border-marca-cinza/30 bg-white shadow-card"
              : "border-dashed border-marca-cinza/40 bg-marca-branco/50 opacity-70"
          }`}
        >
          <ChevronRight
            size={16}
            className={`shrink-0 text-marca-cinza transition-transform duration-200 ${
              mostrarCorpo ? "rotate-90" : ""
            }`}
            aria-hidden
          />
          <span className="flex-1 truncate text-sm font-bold uppercase tracking-wide text-marca-azulEscuro">
            {coluna.titulo}
          </span>
          <span
            className={`shrink-0 rounded-marca px-2 py-0.5 text-xs font-semibold ${
              temCards ? "bg-marca-laranja text-white" : "bg-marca-azulEscuro/10 text-marca-azulEscuro/60"
            }`}
          >
            {cards.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => onNovo(coluna.id)}
          aria-label={`Novo conteúdo em ${coluna.titulo}`}
          title="Novo conteúdo"
          className="flex shrink-0 items-center justify-center rounded-marca border border-marca-cinza/40 px-3 text-marca-cinza transition hover:border-marca-laranja hover:bg-marca-laranja/5 hover:text-marca-laranja focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-laranja"
        >
          <Plus size={16} aria-hidden />
        </button>
      </div>

      {/* Botao de novo conteudo no topo da coluna (desktop) */}
      <button
        type="button"
        onClick={() => onNovo(coluna.id)}
        className="mb-2 hidden items-center justify-center gap-1.5 rounded-marca border border-dashed border-marca-cinza/50 px-3 py-2 text-xs font-semibold text-marca-cinza transition hover:border-marca-laranja hover:bg-marca-laranja/5 hover:text-marca-laranja focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-laranja sm:flex"
      >
        <Plus size={14} aria-hidden />
        Novo conteúdo
      </button>

      {/* Lista de cards (area de drop). No mobile so aparece com a gaveta aberta. */}
      <div
        ref={setNodeRef}
        className={`min-h-[80px] flex-col gap-2 rounded-marca p-1 transition-colors sm:flex sm:min-h-[120px] sm:flex-1 ${
          mostrarCorpo ? "flex" : "hidden"
        } ${isOver ? "bg-marca-laranja/10 ring-2 ring-marca-laranja/60" : "bg-transparent"}`}
      >
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <Card key={card.id} card={card} onAbrir={onAbrir} />
          ))}
        </SortableContext>

        {cards.length === 0 && (
          <p className="select-none px-2 py-6 text-center text-xs text-marca-cinza/70">
            Arraste um card para cá ou crie um novo conteúdo.
          </p>
        )}
      </div>
    </section>
  );
}
