"use client";

import { Fragment, useCallback, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { Plus, ListChecks, GripVertical, Check } from "lucide-react";
import { useBoard } from "@/lib/store";
import type { CardConteudo, ProjetoDados } from "@/lib/types";
import { criarProjetoVazio, contarProgresso, faseProgresso, moverTarefa } from "@/lib/projeto";
import { agora, gerarId } from "@/lib/util";
import AnelProgresso from "./AnelProgresso";
import Conector from "./Conector";
import FaseNode from "./FaseNode";

/**
 * Aba "Projeto": o fluxo de producao do card. Mostra um anel de progresso geral,
 * as fases (lanes) como um fluxo (horizontal no desktop, vertical no mobile) e
 * deixa criar/editar/marcar tarefas e arrastar tarefas entre fases.
 *
 * Enquanto o usuario nao mexe em nada, trabalha com um rascunho local (tres
 * fases sugeridas) sem gravar; a primeira alteracao materializa e persiste o
 * projeto no card, via atualizarCard (auto-save com debounce do store).
 */
export default function AbaProjeto({ card }: { card: CardConteudo }) {
  const { atualizarCard } = useBoard();
  // Rascunho local estavel (ids fixos durante a vida da aba) usado so quando o
  // card ainda nao tem projeto. Assim os ids nao mudam a cada render.
  const padrao = useMemo(() => criarProjetoVazio(), []);
  const projeto = card.projeto ?? padrao;

  // Refs para handlers estaveis lerem sempre a versao mais recente.
  const cardRef = useRef(card);
  cardRef.current = card;

  const [focoId, setFocoId] = useState<string | null>(null);
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);

  // Foco de uso unico: limpa apos a tarefa receber o foco, para nao roubar o
  // foco de novo num remount posterior (ex: tarefa arrastada para outra fase).
  const limparFoco = useCallback(() => setFocoId(null), []);

  // Persiste a partir da versao mais fresca do card (nao sobrescreve a etapa
  // alterada por um arraste no quadro enquanto o modal esta aberto).
  const aplicar = useCallback(
    (proximo: ProjetoDados) => {
      atualizarCard({ ...cardRef.current, projeto: proximo });
    },
    [atualizarCard]
  );

  // Versao de trabalho atual (card.projeto ou o rascunho local).
  const baseAtual = useCallback(() => cardRef.current.projeto ?? padrao, [padrao]);

  // ----- Mutacoes de tarefas -----
  const adicionarTarefa = useCallback(
    (faseId: string, texto: string) => {
      const base = baseAtual();
      const nova = { id: gerarId(), texto, feita: false };
      aplicar({
        ...base,
        fases: base.fases.map((f) =>
          f.id === faseId ? { ...f, tarefas: [...f.tarefas, nova] } : f
        ),
      });
    },
    [aplicar, baseAtual]
  );

  const criarTarefaApos = useCallback(
    (faseId: string, tarefaId: string) => {
      const base = baseAtual();
      const novaId = gerarId();
      aplicar({
        ...base,
        fases: base.fases.map((f) => {
          if (f.id !== faseId) return f;
          const idx = f.tarefas.findIndex((t) => t.id === tarefaId);
          const arr = [...f.tarefas];
          arr.splice(idx + 1, 0, { id: novaId, texto: "", feita: false });
          return { ...f, tarefas: arr };
        }),
      });
      setFocoId(novaId);
    },
    [aplicar, baseAtual]
  );

  const toggleTarefa = useCallback(
    (faseId: string, tarefaId: string) => {
      const base = baseAtual();
      aplicar({
        ...base,
        fases: base.fases.map((f) =>
          f.id !== faseId
            ? f
            : {
                ...f,
                tarefas: f.tarefas.map((t) =>
                  t.id !== tarefaId
                    ? t
                    : { ...t, feita: !t.feita, feitaEm: !t.feita ? agora() : undefined }
                ),
              }
        ),
      });
    },
    [aplicar, baseAtual]
  );

  const editarTarefa = useCallback(
    (faseId: string, tarefaId: string, texto: string) => {
      const base = baseAtual();
      aplicar({
        ...base,
        fases: base.fases.map((f) =>
          f.id !== faseId
            ? f
            : { ...f, tarefas: f.tarefas.map((t) => (t.id !== tarefaId ? t : { ...t, texto })) }
        ),
      });
    },
    [aplicar, baseAtual]
  );

  const removerTarefa = useCallback(
    (faseId: string, tarefaId: string) => {
      const base = baseAtual();
      aplicar({
        ...base,
        fases: base.fases.map((f) =>
          f.id !== faseId ? f : { ...f, tarefas: f.tarefas.filter((t) => t.id !== tarefaId) }
        ),
      });
    },
    [aplicar, baseAtual]
  );

  const backspaceVazio = useCallback(
    (faseId: string, tarefaId: string) => {
      const base = baseAtual();
      const fase = base.fases.find((f) => f.id === faseId);
      if (!fase) return;
      const idx = fase.tarefas.findIndex((t) => t.id === tarefaId);
      const anteriorId = idx > 0 ? fase.tarefas[idx - 1].id : null;
      aplicar({
        ...base,
        fases: base.fases.map((f) =>
          f.id !== faseId ? f : { ...f, tarefas: f.tarefas.filter((t) => t.id !== tarefaId) }
        ),
      });
      if (anteriorId) setFocoId(anteriorId);
    },
    [aplicar, baseAtual]
  );

  // ----- Mutacoes de fases -----
  const adicionarFase = useCallback(() => {
    const base = baseAtual();
    aplicar({ ...base, fases: [...base.fases, { id: gerarId(), nome: "Nova fase", tarefas: [] }] });
  }, [aplicar, baseAtual]);

  const renomearFase = useCallback(
    (faseId: string, nome: string) => {
      const base = baseAtual();
      aplicar({ ...base, fases: base.fases.map((f) => (f.id === faseId ? { ...f, nome } : f)) });
    },
    [aplicar, baseAtual]
  );

  const excluirFase = useCallback(
    (faseId: string) => {
      const base = baseAtual();
      aplicar({ ...base, fases: base.fases.filter((f) => f.id !== faseId) });
    },
    [aplicar, baseAtual]
  );

  const moverFase = useCallback(
    (faseId: string, dir: "tras" | "frente") => {
      const base = baseAtual();
      const idx = base.fases.findIndex((f) => f.id === faseId);
      const alvo = dir === "tras" ? idx - 1 : idx + 1;
      if (idx === -1 || alvo < 0 || alvo >= base.fases.length) return;
      aplicar({ ...base, fases: arrayMove(base.fases, idx, alvo) });
    },
    [aplicar, baseAtual]
  );

  // ----- Arraste de tarefas (mesmos sensores do quadro: long-press no mobile) -----
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function aoIniciar(evento: DragStartEvent) {
    setArrastandoId(String(evento.active.id));
  }
  function aoTerminar(evento: DragEndEvent) {
    const { active, over } = evento;
    setArrastandoId(null);
    if (over) aplicar(moverTarefa(baseAtual(), String(active.id), String(over.id)));
  }

  const tarefaArrastada = useMemo(() => {
    if (!arrastandoId) return null;
    for (const f of projeto.fases) {
      const t = f.tarefas.find((t) => t.id === arrastandoId);
      if (t) return t;
    }
    return null;
  }, [arrastandoId, projeto]);

  const prog = contarProgresso(projeto);
  const fasesCompletas = projeto.fases.filter((f) => {
    const p = faseProgresso(f);
    return p.total > 0 && p.pct === 100;
  }).length;

  // Estado sem nenhuma fase (usuario apagou todas).
  if (projeto.fases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-center animate-slideUp">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-marca-branco text-marca-cinza">
          <ListChecks size={28} aria-hidden />
        </span>
        <p className="max-w-xs text-sm text-marca-cinza">
          Comece adicionando uma fase para organizar a produção do projeto.
        </p>
        <button
          type="button"
          onClick={adicionarFase}
          className="flex items-center gap-1.5 rounded-marca bg-marca-laranja px-4 py-2 text-sm font-bold text-white transition hover:brightness-95"
        >
          <Plus size={16} aria-hidden /> Adicionar fase
        </button>
      </div>
    );
  }

  return (
    <div className="animate-slideUp">
      {/* Cabecalho: anel de progresso geral e resumo */}
      <div className="mb-4 flex flex-col items-center gap-4 rounded-marca border border-marca-cinza/20 bg-marca-branco p-4 sm:flex-row sm:items-center sm:gap-5">
        <AnelProgresso pct={prog.pct} size={84} stroke={8}>
          <span className="text-lg font-bold text-marca-azulEscuro">{prog.pct}%</span>
        </AnelProgresso>
        <div className="text-center sm:text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
            Fluxo de produção
          </p>
          <p className="mt-0.5 text-sm font-semibold text-marca-preto">
            {prog.feitas} de {prog.total} tarefas concluídas
          </p>
          <p className="text-xs text-marca-cinza">
            {fasesCompletas} de {prog.fases} fases concluídas
          </p>
          <p className="mt-1.5 text-xs text-marca-cinza">
            Quebre o projeto em fases e marque cada tarefa concluída.
          </p>
        </div>
      </div>

      {/* O fluxo: fases ligadas por conectores */}
      <DndContext
        sensors={sensores}
        collisionDetection={closestCorners}
        onDragStart={aoIniciar}
        onDragEnd={aoTerminar}
        onDragCancel={() => setArrastandoId(null)}
      >
        <div className="flex flex-col gap-0 sm:flex-row sm:items-start sm:gap-0 sm:overflow-x-auto sm:pb-2">
          {projeto.fases.map((fase, i) => {
            // O conector "acende" de forma monotonica: quando todas as fases
            // anteriores que tem tarefas ja estao 100% (e ao menos uma tem
            // tarefas), para o fluxo nao apagar no meio.
            const anteriores = projeto.fases.slice(0, i).map(faseProgresso);
            const aceso =
              anteriores.some((p) => p.total > 0) &&
              anteriores.every((p) => p.total === 0 || p.pct === 100);
            return (
              <Fragment key={fase.id}>
                {i > 0 && <Conector aceso={aceso} />}
                <FaseNode
                  fase={fase}
                  indice={i}
                  total={projeto.fases.length}
                  focoId={focoId}
                  onRenomear={renomearFase}
                  onExcluir={excluirFase}
                  onMover={moverFase}
                  onAddTarefa={adicionarTarefa}
                  onToggle={toggleTarefa}
                  onEditarTarefa={editarTarefa}
                  onRemoverTarefa={removerTarefa}
                  onEnterTarefa={criarTarefaApos}
                  onBackspaceVazio={backspaceVazio}
                  onFocado={limparFoco}
                />
              </Fragment>
            );
          })}

          {/* Adicionar fase no fim do fluxo */}
          <button
            type="button"
            onClick={adicionarFase}
            className="mt-3 flex shrink-0 items-center justify-center gap-1.5 rounded-marca border border-dashed border-marca-cinza/50 py-3 text-sm font-semibold text-marca-cinza transition hover:border-marca-laranja hover:bg-marca-laranja/5 hover:text-marca-laranja sm:ml-3 sm:mt-0 sm:w-44 sm:self-stretch sm:py-0"
          >
            <Plus size={16} aria-hidden /> Adicionar fase
          </button>
        </div>

        {/* Previa que segue o dedo/cursor ao arrastar uma tarefa */}
        <DragOverlay>
          {tarefaArrastada ? (
            <div className="flex items-center gap-1.5 rounded-marca border border-marca-laranja bg-white px-2 py-2 shadow-cardHover animate-fadeIn">
              <GripVertical size={16} className="text-marca-cinza/50" aria-hidden />
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  tarefaArrastada.feita
                    ? "border-marca-verde bg-marca-verde text-white"
                    : "border-marca-cinza/50"
                }`}
              >
                {tarefaArrastada.feita && <Check size={13} strokeWidth={3} aria-hidden />}
              </span>
              <span
                className={`text-sm ${
                  tarefaArrastada.feita ? "text-marca-cinza line-through" : "text-marca-preto"
                }`}
              >
                {tarefaArrastada.texto || "Tarefa"}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
