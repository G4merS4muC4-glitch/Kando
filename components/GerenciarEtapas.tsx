"use client";

import { useState } from "react";
import { X, Plus, Trash2, ChevronUp, ChevronDown, Columns3, Flag, CheckCircle2 } from "lucide-react";
import { useBoard } from "@/lib/store";

/**
 * Gerencia as colunas (etapas) do quadro da organizacao: adicionar, renomear,
 * descricao, reordenar e excluir. Os papeis marcam a coluna "Inicial" (onde o
 * card novo nasce) e a "Publicado" (selo verde, progresso, prazo, robo). Excluir
 * uma coluna move os cards dela para a inicial; a inicial e a de Publicado nao
 * podem ser excluidas sem antes passar o papel para outra.
 */
export default function GerenciarEtapas({ onFechar }: { onFechar: () => void }) {
  const { etapas, cards, adicionarEtapa, atualizarEtapa, excluirEtapa, moverEtapa, definirPapelEtapa } =
    useBoard();
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const cardsNa = (id: string) => cards.filter((c) => c.etapa === id).length;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-stretch justify-center bg-marca-preto/50 p-0 animate-fadeIn sm:items-center sm:p-4"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label="Gerenciar colunas do quadro"
    >
      <div
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-modal sm:h-auto sm:max-h-[90vh] sm:max-w-xl sm:rounded-marca"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 bg-marca-azulEscuro px-5 py-4 text-white">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Columns3 size={18} aria-hidden /> Colunas do quadro
          </h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-marca p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-5 py-5">
          <p className="text-sm text-marca-cinza">
            Reordene com as setas, renomeie e marque os papeis. <strong>Inicial</strong> é onde o
            card novo nasce; <strong>Publicado</strong> é a coluna do selo verde, do progresso e do
            robô. Excluir uma coluna move os cards dela para a Inicial.
          </p>

          {etapas.map((e, i) => {
            const emUso = cardsNa(e.id);
            const confirmar = confirmando === e.id;
            const bloqueada = e.inicial || e.postado || etapas.length <= 1;
            return (
              <div
                key={e.id}
                className="rounded-marca border border-marca-cinza/30 bg-white p-2.5"
              >
                <div className="flex items-center gap-2">
                  {/* Reordenar */}
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => moverEtapa(e.id, -1)}
                      disabled={i === 0}
                      aria-label="Mover para cima"
                      className="rounded p-0.5 text-marca-cinza transition hover:text-marca-azulEscuro disabled:opacity-30"
                    >
                      <ChevronUp size={16} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => moverEtapa(e.id, 1)}
                      disabled={i === etapas.length - 1}
                      aria-label="Mover para baixo"
                      className="rounded p-0.5 text-marca-cinza transition hover:text-marca-azulEscuro disabled:opacity-30"
                    >
                      <ChevronDown size={16} aria-hidden />
                    </button>
                  </div>

                  {/* Nome */}
                  <input
                    type="text"
                    value={e.titulo}
                    onChange={(ev) => atualizarEtapa({ ...e, titulo: ev.target.value })}
                    maxLength={40}
                    placeholder="Nome da coluna"
                    className="min-w-0 flex-1 rounded-marca border border-marca-cinza/40 px-2.5 py-1.5 text-sm font-semibold text-marca-preto outline-none focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
                  />

                  {/* Excluir */}
                  {confirmar ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          excluirEtapa(e.id);
                          setConfirmando(null);
                        }}
                        className="rounded-marca px-2 py-1.5 text-xs font-bold text-white"
                        style={{ backgroundColor: "#EC1313" }}
                      >
                        Excluir
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmando(null)}
                        className="rounded-marca px-2 py-1.5 text-xs font-semibold text-marca-cinza hover:text-marca-azulEscuro"
                      >
                        Não
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmando(e.id)}
                      disabled={bloqueada}
                      aria-label={`Excluir ${e.titulo}`}
                      title={
                        bloqueada
                          ? "Passe o papel (Inicial/Publicado) para outra coluna antes de excluir"
                          : emUso > 0
                            ? `${emUso} card(s) vão para a coluna inicial`
                            : "Excluir coluna"
                      }
                      className="shrink-0 rounded-marca p-1.5 text-marca-cinza transition hover:bg-marca-vermelho/10 hover:text-marca-vermelho disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  )}
                </div>

                {/* Descricao + papeis */}
                <div className="mt-2 flex flex-wrap items-center gap-2 pl-7">
                  <input
                    type="text"
                    value={e.descricao ?? ""}
                    onChange={(ev) => atualizarEtapa({ ...e, descricao: ev.target.value })}
                    maxLength={60}
                    placeholder="Descrição (opcional)"
                    className="min-w-0 flex-1 rounded-marca border border-marca-cinza/30 px-2.5 py-1 text-xs text-marca-cinza outline-none focus:border-marca-laranja"
                  />
                  <button
                    type="button"
                    onClick={() => definirPapelEtapa(e.id, "inicial")}
                    aria-pressed={Boolean(e.inicial)}
                    title="Coluna onde o card novo nasce"
                    className={`flex items-center gap-1 rounded-marca px-2 py-1 text-xs font-semibold transition ${
                      e.inicial
                        ? "bg-marca-azulEscuro text-white"
                        : "border border-marca-cinza/40 text-marca-cinza hover:text-marca-azulEscuro"
                    }`}
                  >
                    <Flag size={12} aria-hidden /> Inicial
                  </button>
                  <button
                    type="button"
                    onClick={() => definirPapelEtapa(e.id, "postado")}
                    aria-pressed={Boolean(e.postado)}
                    title="Coluna de Publicado (selo verde, progresso, prazo, robô)"
                    className={`flex items-center gap-1 rounded-marca px-2 py-1 text-xs font-semibold transition ${
                      e.postado
                        ? "bg-marca-verde text-white"
                        : "border border-marca-cinza/40 text-marca-cinza hover:text-marca-azulEscuro"
                    }`}
                  >
                    <CheckCircle2 size={12} aria-hidden /> Publicado
                  </button>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => adicionarEtapa()}
            className="mt-2 flex items-center gap-1.5 rounded-marca border border-dashed border-marca-laranja/60 px-3 py-2 text-sm font-bold text-marca-laranja transition hover:bg-marca-laranja/5"
          >
            <Plus size={16} aria-hidden /> Adicionar coluna
          </button>
        </div>

        <div className="flex justify-end border-t border-marca-cinza/30 bg-marca-branco px-5 py-3">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-marca bg-marca-laranja px-4 py-2 text-sm font-bold text-white transition hover:brightness-95"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}
