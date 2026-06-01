"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import type { ColunaConfig } from "@/lib/config";
import type { CardConteudo, Etapa } from "@/lib/types";
import Card from "./Card";

/**
 * Coluna (etapa) do quadro. E uma area que recebe cards arrastados e lista
 * os cards daquela etapa de forma ordenavel.
 */
export default function Coluna({
  coluna,
  cards,
  onAbrir,
  onNovo,
}: {
  coluna: ColunaConfig;
  cards: CardConteudo[];
  onAbrir: (id: string) => void;
  onNovo: (etapa: Etapa) => void;
}) {
  // A coluna inteira e um destino de drop (permite soltar em coluna vazia).
  const { setNodeRef, isOver } = useDroppable({ id: coluna.id });

  return (
    <section
      className="flex w-full shrink-0 flex-col sm:h-full sm:w-[300px]"
      aria-label={coluna.titulo}
    >
      {/* Cabecalho da coluna */}
      <header className="mb-2 px-1">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-marca-azulEscuro">
            {coluna.titulo}
            <span className="rounded-marca bg-marca-azulEscuro/10 px-2 py-0.5 text-xs font-semibold text-marca-azulEscuro">
              {cards.length}
            </span>
          </h2>
        </div>
        <p className="mt-0.5 text-xs text-marca-cinza">{coluna.descricao}</p>
      </header>

      {/* Botao de novo conteudo no topo da coluna */}
      <button
        type="button"
        onClick={() => onNovo(coluna.id)}
        className="mb-2 flex items-center justify-center gap-1.5 rounded-marca border border-dashed border-marca-cinza/50 px-3 py-2 text-xs font-semibold text-marca-cinza transition hover:border-marca-laranja hover:bg-marca-laranja/5 hover:text-marca-laranja focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-laranja"
      >
        <Plus size={14} aria-hidden />
        Novo conteúdo
      </button>

      {/* Lista de cards (area de drop) */}
      <div
        ref={setNodeRef}
        className={`flex min-h-[80px] flex-col gap-2 rounded-marca p-1 transition-colors sm:min-h-[120px] sm:flex-1 sm:overflow-y-auto ${
          isOver ? "bg-marca-laranja/10 ring-2 ring-marca-laranja/60" : "bg-transparent"
        }`}
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
