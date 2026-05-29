"use client";

import { memo, useEffect, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Check, Trash2 } from "lucide-react";
import type { ProjetoTarefa } from "@/lib/types";

/**
 * Uma tarefa do projeto: alca de arraste, marcador de concluido, texto editavel
 * e botao de excluir. O arraste sai apenas da alca (GripVertical), entao tocar
 * no texto ou no check nunca inicia um arraste, e o deslize do dedo rola a tela.
 */
function TarefaItem({
  tarefa,
  faseId,
  focar,
  onToggle,
  onEditar,
  onRemover,
  onEnter,
  onBackspaceVazio,
  onFocado,
}: {
  tarefa: ProjetoTarefa;
  faseId: string;
  focar: boolean;
  onToggle: (faseId: string, tarefaId: string) => void;
  onEditar: (faseId: string, tarefaId: string, texto: string) => void;
  onRemover: (faseId: string, tarefaId: string) => void;
  onEnter: (faseId: string, tarefaId: string) => void;
  onBackspaceVazio: (faseId: string, tarefaId: string) => void;
  onFocado: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tarefa.id,
    data: { tipo: "tarefa", faseId },
  });
  const inputRef = useRef<HTMLInputElement>(null);

  // Foca quando a tarefa acabou de ser criada (fluxo rapido de digitar varias).
  // O foco e "de uso unico": apos focar, avisa o pai para limpar o pedido, assim
  // um remount posterior da mesma tarefa (ex: arrastada para outra fase) nao
  // rouba o foco de novo.
  useEffect(() => {
    if (!focar) return;
    const el = inputRef.current;
    if (el) {
      el.focus();
      const fim = el.value.length;
      el.setSelectionRange(fim, fim);
    }
    onFocado();
  }, [focar, onFocado]);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-1.5 rounded-marca border border-marca-cinza/30 bg-white px-2 py-2 shadow-card animate-slideUp"
    >
      {/* Alca de arraste (so aqui saem os listeners). Area de toque alta (40px)
          para o long-press funcionar bem no celular. */}
      <button
        type="button"
        aria-label="Arrastar tarefa"
        title="Arraste para mover entre fases"
        className="-my-2 -ml-1 flex min-h-[40px] w-7 shrink-0 cursor-grab touch-none items-center justify-center text-marca-cinza/50 transition hover:text-marca-cinza active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} aria-hidden />
      </button>

      {/* Marcador de concluido (anel 20px com area de toque ampliada via ::before) */}
      <button
        type="button"
        role="checkbox"
        aria-checked={tarefa.feita}
        aria-label={tarefa.feita ? "Marcar como nao feita" : "Marcar como feita"}
        onClick={() => onToggle(faseId, tarefa.id)}
        onPointerDown={(e) => e.stopPropagation()}
        className={`relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition before:absolute before:-inset-2.5 before:content-[''] ${
          tarefa.feita
            ? "border-marca-verde bg-marca-verde text-white"
            : "border-marca-cinza/50 text-transparent hover:border-marca-verde"
        }`}
      >
        {tarefa.feita && <Check size={13} strokeWidth={3} className="animate-checkPop" aria-hidden />}
      </button>

      {/* Texto editavel */}
      <input
        ref={inputRef}
        type="text"
        value={tarefa.texto}
        onChange={(e) => onEditar(faseId, tarefa.id, e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onEnter(faseId, tarefa.id);
          } else if (e.key === "Backspace" && tarefa.texto === "") {
            e.preventDefault();
            onBackspaceVazio(faseId, tarefa.id);
          }
        }}
        placeholder="Ex: Ver medidas"
        className={`min-w-0 flex-1 border-none bg-transparent text-base outline-none placeholder:text-marca-cinza/60 focus:ring-0 sm:text-sm ${
          tarefa.feita ? "text-marca-cinza line-through" : "text-marca-preto"
        }`}
      />

      {/* Excluir (sempre visivel no mobile; aparece no hover no desktop) */}
      <button
        type="button"
        aria-label="Excluir tarefa"
        title="Excluir tarefa"
        onClick={() => onRemover(faseId, tarefa.id)}
        onPointerDown={(e) => e.stopPropagation()}
        className="-my-2 -mr-1 flex min-h-[40px] w-9 shrink-0 items-center justify-center rounded-marca text-marca-cinza/70 transition hover:bg-marca-vermelho/10 hover:text-marca-vermelho sm:opacity-0 sm:group-hover:opacity-100"
      >
        <Trash2 size={14} aria-hidden />
      </button>
    </div>
  );
}

// Memoizado: so re-renderiza quando a propria tarefa (ou o foco) muda, mantendo
// a digitacao fluida mesmo com muitas tarefas e fases.
export default memo(TarefaItem);
