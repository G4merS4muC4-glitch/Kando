"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { COLUNAS } from "@/lib/config";
import { useBoard } from "@/lib/store";
import type { CardConteudo, Etapa } from "@/lib/types";
import Coluna from "./Coluna";
import { CardVisual } from "./Card";

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

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
  const { moverCard, pronto } = useBoard();
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [larguraArrasto, setLarguraArrasto] = useState<number | undefined>(undefined);

  // Mouse: arrasta com um pequeno movimento. Toque: segura ~0,2s para arrastar
  // (assim o deslize do dedo rola o quadro normalmente, sem agarrar o card).
  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Agrupa os cards visiveis por etapa, preservando a ordem.
  const porEtapa = useMemo(() => {
    const mapa = new Map<Etapa, CardConteudo[]>();
    COLUNAS.forEach((c) => mapa.set(c.id, []));
    cards.forEach((card) => mapa.get(card.etapa)?.push(card));
    return mapa;
  }, [cards]);

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
  useEffect(() => () => pararFisica(), []);

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
    if (over) moverCard(String(active.id), String(over.id));
  }

  function aoCancelar() {
    pararFisica();
    setArrastandoId(null);
  }

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={closestCorners}
      onDragStart={aoIniciarArrasto}
      onDragMove={aoMoverArrasto}
      onDragEnd={aoTerminarArrasto}
      onDragCancel={aoCancelar}
    >
      {/* Mobile: colunas empilhadas, a pagina rola inteira (cards sem corte).
          Desktop: Kanban horizontal com rolagem por coluna. */}
      <div className="flex flex-col gap-4 px-3 pb-8 pt-4 sm:h-full sm:flex-row sm:gap-4 sm:overflow-x-auto sm:overflow-y-hidden sm:px-4 sm:pb-4">

        {COLUNAS.map((coluna) => (
          <Coluna
            key={coluna.id}
            coluna={coluna}
            cards={porEtapa.get(coluna.id) ?? []}
            onAbrir={onAbrir}
            onNovo={onNovo}
          />
        ))}
      </div>

      {/* Previa que segue o cursor: mesmo card (tamanho e info), com a fisica
          de inclinacao aplicada via overlayRef. O perspective da o efeito 3D. */}
      <DragOverlay>
        {cardArrastado ? (
          <div style={{ perspective: 900 }}>
            <CardVisual
              ref={overlayRef}
              card={cardArrastado}
              style={{
                width: larguraArrasto,
                boxShadow: "0 18px 38px rgba(30, 32, 38, 0.32)",
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
