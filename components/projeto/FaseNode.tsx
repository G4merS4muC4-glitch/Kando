"use client";

import { useEffect, useRef, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
  Plus,
  MoreVertical,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import type { ProjetoFase } from "@/lib/types";
import { faseProgresso } from "@/lib/projeto";
import TarefaItem from "./TarefaItem";

/** Uma fase (lane) do projeto: cabecalho, barra de progresso e lista de tarefas. */
export default function FaseNode({
  fase,
  indice,
  total,
  focoId,
  onRenomear,
  onExcluir,
  onMover,
  onAddTarefa,
  onToggle,
  onEditarTarefa,
  onRemoverTarefa,
  onEnterTarefa,
  onBackspaceVazio,
  onFocado,
}: {
  fase: ProjetoFase;
  indice: number;
  total: number;
  focoId: string | null;
  onRenomear: (faseId: string, nome: string) => void;
  onExcluir: (faseId: string) => void;
  onMover: (faseId: string, dir: "tras" | "frente") => void;
  onAddTarefa: (faseId: string, texto: string) => void;
  onToggle: (faseId: string, tarefaId: string) => void;
  onEditarTarefa: (faseId: string, tarefaId: string, texto: string) => void;
  onRemoverTarefa: (faseId: string, tarefaId: string) => void;
  onEnterTarefa: (faseId: string, tarefaId: string) => void;
  onBackspaceVazio: (faseId: string, tarefaId: string) => void;
  onFocado: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: fase.id, data: { tipo: "fase" } });
  const [menuAberto, setMenuAberto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [nova, setNova] = useState("");
  const inputNovaRef = useRef<HTMLInputElement>(null);
  const { total: totalTarefas, feitas, pct } = faseProgresso(fase);

  // Comemoracao ao chegar em 100% (so quando ha tarefas e acabou de completar).
  const [comemorando, setComemorando] = useState(false);
  const pctAnterior = useRef(pct);
  useEffect(() => {
    if (totalTarefas > 0 && pct === 100 && pctAnterior.current < 100) {
      setComemorando(true);
      const t = window.setTimeout(() => setComemorando(false), 1100);
      pctAnterior.current = pct;
      return () => window.clearTimeout(t);
    }
    pctAnterior.current = pct;
  }, [pct, totalTarefas]);

  const completa = totalTarefas > 0 && pct === 100;

  function adicionar() {
    const texto = nova.trim();
    if (!texto) return;
    onAddTarefa(fase.id, texto);
    setNova("");
    inputNovaRef.current?.focus();
  }

  return (
    <div
      className={`relative flex w-full shrink-0 flex-col overflow-hidden rounded-marca border bg-white shadow-card transition-colors sm:w-64 ${
        completa ? "border-marca-verde" : "border-marca-cinza/30"
      } ${comemorando ? "animate-pop" : ""}`}
    >
      {/* Carimbo de comemoracao ao concluir a fase */}
      {comemorando && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <CheckCircle2 size={84} strokeWidth={2.2} className="animate-checkPop text-marca-verde opacity-25" aria-hidden />
        </div>
      )}

      {/* Cabecalho da fase */}
      <div className="border-b border-marca-cinza/20 px-3 pb-2.5 pt-3">
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={fase.nome}
            onChange={(e) => onRenomear(fase.id, e.target.value)}
            placeholder="Nome da fase"
            aria-label="Nome da fase"
            className="min-w-0 flex-1 border-none bg-transparent text-base font-bold text-marca-azulEscuro outline-none placeholder:font-normal placeholder:text-marca-cinza/60 focus:ring-0 sm:text-sm"
          />
          <span className="shrink-0 text-[11px] font-semibold tabular-nums text-marca-cinza">
            {feitas}/{totalTarefas}
          </span>
          <button
            type="button"
            aria-label="Opções da fase"
            title="Opções da fase"
            onClick={() => {
              setMenuAberto((v) => !v);
              setConfirmando(false);
            }}
            className="-my-1.5 -mr-1 flex min-h-[40px] min-w-[40px] shrink-0 items-center justify-center rounded-marca text-marca-cinza transition hover:bg-marca-branco hover:text-marca-azulEscuro"
          >
            <MoreVertical size={16} aria-hidden />
          </button>
        </div>

        {/* Barra de progresso da fase */}
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-marca-cinza/20">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${
              completa ? "bg-marca-verde" : "bg-marca-laranja"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Menu de acoes da fase (inline, sem sobreposicao) */}
        {menuAberto && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-marca bg-marca-branco p-1.5 animate-slideUp">
            <button
              type="button"
              disabled={indice === 0}
              onClick={() => onMover(fase.id, "tras")}
              aria-label="Mover fase para trás"
              title="Mover fase para trás"
              className="flex items-center gap-1 rounded-marca px-2 py-1.5 text-xs font-semibold text-marca-azulEscuro transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={13} aria-hidden /> Antes
            </button>
            <button
              type="button"
              disabled={indice === total - 1}
              onClick={() => onMover(fase.id, "frente")}
              aria-label="Mover fase para frente"
              title="Mover fase para frente"
              className="flex items-center gap-1 rounded-marca px-2 py-1.5 text-xs font-semibold text-marca-azulEscuro transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Depois <ChevronRight size={13} aria-hidden />
            </button>
            {confirmando ? (
              <span className="ml-auto flex items-center gap-1.5 text-xs">
                <span className="font-medium text-marca-preto">Excluir?</span>
                <button
                  type="button"
                  onClick={() => onExcluir(fase.id)}
                  className="rounded-marca px-2 py-1 font-semibold text-white"
                  style={{ backgroundColor: "#EC1313" }}
                >
                  Sim
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmando(false)}
                  className="rounded-marca px-2 py-1 font-semibold text-marca-cinza hover:text-marca-azulEscuro"
                >
                  Não
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => (totalTarefas > 0 ? setConfirmando(true) : onExcluir(fase.id))}
                className="ml-auto flex items-center gap-1 rounded-marca px-2 py-1 text-xs font-semibold text-marca-vermelho transition hover:bg-marca-vermelho/10"
              >
                <Trash2 size={13} aria-hidden /> Excluir
              </button>
            )}
          </div>
        )}
      </div>

      {/* Lista de tarefas (area de soltar) */}
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-1.5 px-2 py-2 transition-colors ${
          isOver ? "bg-marca-laranja/10 ring-2 ring-inset ring-marca-laranja/60" : ""
        }`}
      >
        <SortableContext items={fase.tarefas.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {fase.tarefas.map((tarefa) => (
            <TarefaItem
              key={tarefa.id}
              tarefa={tarefa}
              faseId={fase.id}
              focar={focoId === tarefa.id}
              onToggle={onToggle}
              onEditar={onEditarTarefa}
              onRemover={onRemoverTarefa}
              onEnter={onEnterTarefa}
              onBackspaceVazio={onBackspaceVazio}
              onFocado={onFocado}
            />
          ))}
        </SortableContext>

        {fase.tarefas.length === 0 && (
          <p className="px-1 py-2 text-center text-xs text-marca-cinza/70">Adicione a primeira tarefa</p>
        )}
      </div>

      {/* Rodape: adicionar tarefa */}
      <div className="mt-auto flex items-center gap-1 border-t border-marca-cinza/20 px-2 py-2">
        <input
          ref={inputNovaRef}
          type="text"
          value={nova}
          onChange={(e) => setNova(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionar();
            }
          }}
          placeholder="Nova tarefa, ex: Ver medidas"
          aria-label="Adicionar tarefa"
          className="min-w-0 flex-1 rounded-marca border border-transparent bg-marca-branco px-2 py-1.5 text-base text-marca-preto outline-none transition placeholder:text-marca-cinza/60 focus:border-marca-laranja sm:text-sm"
        />
        <button
          type="button"
          aria-label="Adicionar tarefa"
          onClick={adicionar}
          className="shrink-0 rounded-marca bg-marca-azulEscuro p-1.5 text-white transition hover:brightness-110"
        >
          <Plus size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
