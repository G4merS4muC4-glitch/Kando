"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type DropAnimation,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useBoard } from "@/lib/store";
import type { CardConteudo, Etapa } from "@/lib/types";
import Coluna from "./Coluna";
import { CardVisual } from "./Card";

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

// Soltar suave: o card desliza ate o lugar (em vez de pular instantaneo).
const ANIMACAO_SOLTAR: DropAnimation = {
  duration: 260,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
};

/**
 * Quadro principal. Organiza as colunas e controla o drag and drop entre elas
 * (mouse e teclado). O card arrastado segue o cursor com fisica de inclinacao:
 * ele "pende" para o lado do movimento (forca de arrasto) e volta ao normal
 * quando para (gravidade), sem mudar de tamanho nem perder informacao.
 */
export default function Board({
  cards,
  onAbrir,
  onNovo,
}: {
  cards: CardConteudo[]; // ja filtrados pela busca e filtros
  onAbrir: (id: string) => void;
  onNovo: (etapa: Etapa) => void;
}) {
  const { moverCard, pronto, etapas } = useBoard();
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [larguraArrasto, setLarguraArrasto] = useState<number | undefined>(undefined);
  // Card recem-solto: recebe o pop de "chegou" por ~meio segundo.
  const [recemMovidoId, setRecemMovidoId] = useState<string | null>(null);
  const popTimer = useRef<number | null>(null);

  // Mouse: arrasta com um pequeno movimento. Toque: segura ~0,2s para arrastar
  // (assim o deslize do dedo rola o quadro normalmente, sem agarrar o card).
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Agrupa os cards visiveis por etapa, preservando a ordem. Card de uma etapa
  // que nao existe mais (ex: coluna recem-excluida) cai na primeira coluna.
  const porEtapa = useMemo(() => {
    const mapa = new Map<Etapa, CardConteudo[]>();
    etapas.forEach((c) => mapa.set(c.id, []));
    const primeira = etapas[0]?.id;
    cards.forEach((card) => (mapa.get(card.etapa) ?? mapa.get(primeira))?.push(card));
    return mapa;
  }, [cards, etapas]);

  const cardArrastado = useMemo(
    () => cards.find((c) => c.id === arrastandoId) ?? null,
    [cards, arrastandoId]
  );

  // ----- Fisica de inclinacao do card arrastado (atualizada de forma
  // imperativa via requestAnimationFrame, sem re-renderizar o quadro). -----
  const overlayRef = useRef<HTMLDivElement>(null);
  const ultimoDelta = useRef({ x: 0, y: 0 });
  const alvo = useRef({ rz: 0, rx: 0 }); // inclinacao desejada (vinda do movimento)
  const atual = useRef({ rz: 0, rx: 0 }); // inclinacao suavizada aplicada
  const rafId = useRef<number | null>(null);

  function loopFisica() {
    // Gravidade: a inclinacao desejada decai para zero quando o card nao se move.
    alvo.current.rz *= 0.82;
    alvo.current.rx *= 0.82;
    // Mola: o valor aplicado se aproxima suavemente do alvo.
    atual.current.rz += (alvo.current.rz - atual.current.rz) * 0.25;
    atual.current.rx += (alvo.current.rx - atual.current.rx) * 0.25;
    const el = overlayRef.current;
    if (el) {
      el.style.transform = `rotateX(${atual.current.rx.toFixed(2)}deg) rotateZ(${atual.current.rz.toFixed(2)}deg)`;
    }
    rafId.current = requestAnimationFrame(loopFisica);
  }

  function pararFisica() {
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    alvo.current = { rz: 0, rx: 0 };
    atual.current = { rz: 0, rx: 0 };
  }

  // Garante que o loop pare se o componente desmontar no meio de um arraste.
  useEffect(
    () => () => {
      pararFisica();
      if (popTimer.current) window.clearTimeout(popTimer.current);
    },
    []
  );

  function aoIniciarArrasto(evento: DragStartEvent) {
    setLarguraArrasto(evento.active.rect.current.initial?.width);
    ultimoDelta.current = { x: 0, y: 0 };
    alvo.current = { rz: 0, rx: 0 };
    atual.current = { rz: 0, rx: 0 };
    setArrastandoId(String(evento.active.id));
    if (rafId.current === null) {
      rafId.current = requestAnimationFrame(loopFisica);
    }
  }

  function aoMoverArrasto(evento: DragMoveEvent) {
    const { x, y } = evento.delta;
    const vx = x - ultimoDelta.current.x; // velocidade horizontal (px por evento)
    const vy = y - ultimoDelta.current.y; // velocidade vertical
    ultimoDelta.current = { x, y };
    // Forca de arrasto: acumula inclinacao na direcao do movimento (com limite).
    alvo.current.rz = clamp(alvo.current.rz + vx * 0.9, -18, 18);
    alvo.current.rx = clamp(alvo.current.rx - vy * 0.5, -12, 12);
  }

  function aoTerminarArrasto(evento: DragEndEvent) {
    const { active, over } = evento;
    pararFisica();
    setArrastandoId(null);
    if (over) {
      const id = String(active.id);
      moverCard(id, String(over.id));
      // Pop de "chegou" no card recem-solto (some depois de ~meio segundo).
      setRecemMovidoId(id);
      if (popTimer.current) window.clearTimeout(popTimer.current);
      popTimer.current = window.setTimeout(() => setRecemMovidoId(null), 560);
    }
  }

  function aoCancelar() {
    pararFisica();
    setArrastandoId(null);
  }

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={closestCorners}
      // Remede as colunas durante o arraste: gavetas que abrem no mobile (ou
      // mudancas de altura) viram destinos de drop validos na hora.
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={aoIniciarArrasto}
      onDragMove={aoMoverArrasto}
      onDragEnd={aoTerminarArrasto}
      onDragCancel={aoCancelar}
    >
      {/* Area de cards = UM scroll so (rola o quadro inteiro: vertical, e
          horizontal quando as colunas nao cabem). SEM padding no topo aqui: o
          espacamento de topo vai no conteudo, para o titulo fixo grudar rente ao
          topo sem deixar card aparecer acima. Snap nas colunas em paisagem. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-8 sm:overflow-auto sm:px-4 sm:pb-4 baixo:snap-x baixo:snap-mandatory">
        <div className="flex flex-col gap-2.5 pt-4 sm:flex-row sm:items-start sm:gap-4">
          {etapas.map((coluna) => (
            <Coluna
              key={coluna.id}
              coluna={coluna}
              cards={porEtapa.get(coluna.id) ?? []}
              onAbrir={onAbrir}
              onNovo={onNovo}
              arrastando={!!arrastandoId}
              recemMovidoId={recemMovidoId}
            />
          ))}
        </div>
      </div>

      {/* Previa que segue o cursor: mesmo card (tamanho e info), com a fisica
          de inclinacao aplicada via overlayRef. O perspective da o efeito 3D. */}
      <DragOverlay dropAnimation={ANIMACAO_SOLTAR}>
        {cardArrastado ? (
          <div className="animate-pegar" style={{ perspective: 900 }}>
            <CardVisual
              ref={overlayRef}
              card={cardArrastado}
              style={{
                width: larguraArrasto,
                // Sem sombra extra: usa a sombra sutil normal do card (sem halo cinza).
                cursor: "grabbing",
                willChange: "transform",
              }}
            />
          </div>
        ) : null}
      </DragOverlay>

      {!pronto && <p className="px-4 text-sm text-marca-cinza">Carregando o quadro...</p>}
    </DndContext>
  );
}
