"use client";

import { forwardRef, memo, type ComponentPropsWithoutRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Calendar,
  Maximize2,
  AlertTriangle,
  Circle,
  CheckCircle2,
  RotateCcw,
  ListChecks,
} from "lucide-react";
import { CANAIS } from "@/lib/config";
import { useBoard } from "@/lib/store";
import type { CardConteudo } from "@/lib/types";
import { formatarData, prazoVencido } from "@/lib/util";
import { contarProgresso } from "@/lib/projeto";
import BadgeTipo from "./BadgeTipo";

type CardVisualProps = ComponentPropsWithoutRef<"div"> & {
  card: CardConteudo;
  onAbrir?: (id: string) => void;
};

/**
 * Visual do card (sem a logica de drag). E reaproveitado tanto pelo card
 * ordenavel no quadro quanto pela previa que segue o cursor durante o arraste,
 * garantindo que o card arrastado tenha exatamente o mesmo tamanho e conteudo.
 */
export const CardVisual = forwardRef<HTMLDivElement, CardVisualProps>(function CardVisual(
  { card, onAbrir, className = "", ...rest },
  ref
) {
  const { concluirCard, marcarPostado, reabrirCard } = useBoard();

  const vencido = prazoVencido(card.dataPublicacao, card.etapa);
  const postado = card.etapa === "publicado";
  const aprovado = card.etapa === "aprovado";
  // Progresso interno do projeto (independente da etapa do quadro).
  const prog = card.tipo === "projeto" ? contarProgresso(card.projeto) : null;

  // Acao rapida do botao de check, conforme a etapa atual.
  function acaoRapida(e: React.MouseEvent) {
    e.stopPropagation();
    if (postado) reabrirCard(card.id);
    else if (aprovado) marcarPostado(card.id);
    else concluirCard(card.id);
  }

  const acaoConfig = postado
    ? { Icone: RotateCcw, titulo: "Reabrir (desfazer postado)", cor: "text-marca-verdeEscuro" }
    : aprovado
      ? { Icone: CheckCircle2, titulo: "Marcar como postado", cor: "text-marca-laranja" }
      : { Icone: Circle, titulo: "Marcar como concluido", cor: "text-marca-cinza" };
  const IconeAcao = acaoConfig.Icone;

  return (
    <div
      ref={ref}
      className={`group relative shrink-0 cursor-grab overflow-hidden rounded-marca border p-3 text-marca-preto shadow-card outline-none transition-shadow hover:shadow-cardHover focus-visible:ring-2 focus-visible:ring-marca-laranja active:cursor-grabbing ${
        postado ? "border-marca-verde bg-marca-verdeClaro" : "border-marca-cinza/30 bg-white"
      } ${className}`}
      {...rest}
    >
      {/* Sobreposicao de postado: grande check verde semi-transparente */}
      {postado && (
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
          <CheckCircle2
            className="animate-checkPop text-marca-verde opacity-20"
            size={92}
            strokeWidth={2.2}
            aria-hidden
          />
        </div>
      )}

      <div className="relative z-10">
        {/* Cabecalho: tipo, acao rapida e abrir */}
        <div className="mb-2 flex items-start justify-between gap-2">
          <BadgeTipo tipo={card.tipo} />
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              aria-label={acaoConfig.titulo}
              title={acaoConfig.titulo}
              onClick={acaoRapida}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") e.stopPropagation();
              }}
              className={`rounded-marca p-1 transition hover:bg-white focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-marca-laranja ${acaoConfig.cor}`}
            >
              <IconeAcao size={18} strokeWidth={2.4} aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Abrir detalhes do conteudo"
              title="Abrir detalhes"
              onClick={(e) => {
                e.stopPropagation();
                onAbrir?.(card.id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") e.stopPropagation();
              }}
              className="rounded-marca p-1 text-marca-cinza opacity-0 transition hover:bg-white hover:text-marca-azulEscuro focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-marca-laranja group-hover:opacity-100"
            >
              <Maximize2 size={14} aria-hidden />
            </button>
          </div>
        </div>

        {/* Selo de postado */}
        {postado && (
          <span className="mb-2 inline-flex items-center gap-1 rounded-marca bg-marca-verde px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
            <CheckCircle2 size={12} aria-hidden /> Postado
          </span>
        )}

        {/* Titulo */}
        <h3 className="mb-2 text-sm font-semibold leading-snug text-marca-preto">
          {card.titulo || "Sem titulo"}
        </h3>

        {/* Rodape: para projeto, mostra o progresso das tarefas; para os demais,
            mostra canais e data de publicacao. */}
        {prog ? (
          <div className="flex flex-col gap-1.5">
            {prog.fases === 0 ? (
              <span className="text-[11px] text-marca-cinza">Projeto vazio</span>
            ) : (
              <>
                {prog.total > 0 && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-marca-cinza/20">
                    <div
                      className={`h-full rounded-full transition-[width] duration-500 ${
                        prog.pct === 100 ? "bg-marca-verde" : "bg-marca-laranja"
                      }`}
                      style={{ width: `${prog.pct}%` }}
                    />
                  </div>
                )}
                <div className="flex items-center justify-between text-[11px] text-marca-cinza">
                  <span className="flex items-center gap-1">
                    <ListChecks size={13} aria-hidden /> {prog.fases} {prog.fases === 1 ? "fase" : "fases"}
                  </span>
                  {prog.total === 0 ? (
                    <span className="text-marca-cinza">Sem tarefas ainda</span>
                  ) : prog.pct === 100 ? (
                    <span className="flex items-center gap-1 font-semibold text-marca-verde">
                      <CheckCircle2 size={12} aria-hidden /> Concluido
                    </span>
                  ) : (
                    <span className="font-semibold text-marca-azulEscuro">
                      {prog.feitas}/{prog.total}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-marca-cinza">
            {card.canais.length > 0 && (
              <span className="flex items-center gap-1.5">
                {card.canais.map((canal) => {
                  const IconeCanal = CANAIS[canal].icone;
                  return (
                    <IconeCanal
                      key={canal}
                      size={14}
                      aria-label={CANAIS[canal].label}
                      style={{ color: CANAIS[canal].cor }}
                    />
                  );
                })}
              </span>
            )}

            {card.dataPublicacao && (
              <span
                className={`flex items-center gap-1 ${vencido ? "font-semibold" : ""}`}
                style={vencido ? { color: "#EC1313" } : undefined}
              >
                {vencido ? <AlertTriangle size={13} aria-hidden /> : <Calendar size={13} aria-hidden />}
                {formatarData(card.dataPublicacao)}
              </span>
            )}
          </div>
        )}

        {/* Etiqueta de tema */}
        {card.tema && card.tema.trim() !== "" && (
          <div className="mt-2">
            <span className="inline-block rounded-marca border border-marca-cinza/40 bg-white px-2 py-0.5 text-[11px] font-medium text-marca-azulClaro">
              {card.tema}
            </span>
          </div>
        )}

        {/* Indicador de prazo vencido */}
        {vencido && (
          <div className="mt-2">
            <span
              className="inline-block rounded-marca px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white"
              style={{ backgroundColor: "#EC1313" }}
            >
              Prazo vencido
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

/**
 * Card ordenavel do quadro. Enquanto e arrastado, a previa que segue o cursor
 * (DragOverlay, no Board) mostra exatamente este mesmo visual. O card de origem
 * fica invisivel (mantendo o espaco) para nao parecer duplicado.
 */
function Card({
  card,
  onAbrir,
}: {
  card: CardConteudo;
  onAbrir: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, data: { etapa: card.etapa } });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Esconde o original durante o arraste, sem mudar tamanho (o espaco fica).
    opacity: isDragging ? 0 : 1,
  };

  return (
    <CardVisual
      ref={setNodeRef}
      card={card}
      onAbrir={onAbrir}
      style={style}
      onClick={() => onAbrir(card.id)}
      {...attributes}
      {...listeners}
    />
  );
}

// Memoizado: so re-renderiza quando o proprio card muda, mantendo a digitacao
// no modal fluida mesmo com muitos cards no quadro.
export default memo(Card);
