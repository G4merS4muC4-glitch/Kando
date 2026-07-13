"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, X, AlertTriangle, Calendar, Flag, CheckCircle2 } from "lucide-react";
import { campanhaArquivada, PRIORIDADES } from "@/lib/config";
import { useBoard } from "@/lib/store";
import type { CardConteudo } from "@/lib/types";
import { chaveData } from "@/lib/util";
import BadgeTipo from "./BadgeTipo";
import ModalCard from "./ModalCard";

const CHAVE_DISP = "kando:notif-dispensadas"; // { [cardId]: "yyyy-mm-dd" } dispensado no dia

/** Dias entre uma data (yyyy-mm-dd) e hoje (yyyy-mm-dd): negativo = atrasado. */
function diasAte(data: string, hoje: string): number {
  const d = new Date(`${data}T00:00:00`).getTime();
  const h = new Date(`${hoje}T00:00:00`).getTime();
  if (!Number.isFinite(d) || !Number.isFinite(h)) return 999;
  return Math.round((d - h) / 86_400_000);
}

function rotuloPrazo(dias: number): string {
  if (dias < 0) return `Atrasado há ${-dias} ${-dias === 1 ? "dia" : "dias"}`;
  if (dias === 0) return "Sai hoje";
  if (dias === 1) return "Sai amanhã";
  return `Sai em ${dias} dias`;
}

function lerDispensadas(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const cru = window.localStorage.getItem(CHAVE_DISP);
    return cru ? (JSON.parse(cru) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/**
 * Central flutuante de notificações: um sino fixo (com contador) que avisa sobre
 * prazos dos conteúdos ativos — atrasados, sai hoje/amanhã e nos próximos dias —
 * mostrando a etapa (ex.: Em Produção). Tudo derivado do quadro, ao vivo. Clicar
 * abre o card; dá para dispensar (some até o dia seguinte). So aparece no desktop
 * e no mobile fora do detalhe de campanha (mesmo criterio da navegacao).
 */
export default function CentralNotificacoes() {
  const { cards, campanhas, etapaPostado, etapaPorId, campanhaPorId, marcaPorId } = useBoard();
  const [aberto, setAberto] = useState(false);
  const [cardAbertoId, setCardAbertoId] = useState<string | null>(null);
  const [dispensadas, setDispensadas] = useState<Record<string, string>>({});
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
    setDispensadas(lerDispensadas());
  }, []);

  const hoje = useMemo(() => (montado ? chaveData(new Date()) : ""), [montado]);

  const notificacoes = useMemo(() => {
    if (!hoje) return [];
    const ativas = new Set(
      campanhas.filter((c) => !campanhaArquivada(c.status)).map((c) => c.id)
    );
    return cards
      .filter(
        (c) =>
          ativas.has(c.campanhaId) &&
          c.etapa !== etapaPostado.id &&
          c.dataPublicacao &&
          diasAte(c.dataPublicacao, hoje) <= 7
      )
      .map((c) => ({ card: c, dias: diasAte(c.dataPublicacao as string, hoje) }))
      .sort((a, b) => a.dias - b.dias);
  }, [cards, campanhas, etapaPostado, hoje]);

  // Nao dispensadas hoje (o que realmente aparece na lista/contador).
  const visiveis = notificacoes.filter((n) => dispensadas[n.card.id] !== hoje);
  // Urgentes = atrasados + ate 3 dias (movem o contador vermelho).
  const urgentes = visiveis.filter((n) => n.dias <= 3).length;

  function dispensar(cardId: string) {
    setDispensadas((d) => {
      const novo = { ...d, [cardId]: hoje };
      try {
        window.localStorage.setItem(CHAVE_DISP, JSON.stringify(novo));
      } catch {
        // sem localStorage: apenas nao persiste
      }
      return novo;
    });
  }

  const cardAberto = cardAbertoId ? cards.find((c) => c.id === cardAbertoId) : undefined;

  if (!montado) return null;

  return (
    <>
      {/* Sino flutuante (canto inferior esquerdo; acima da barra do mobile) */}
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label={`Notificações${urgentes > 0 ? ` (${urgentes})` : ""}`}
        title="Lembretes e prazos"
        className="fixed bottom-[88px] left-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-marca-azulEscuro text-white shadow-modal transition hover:brightness-110 active:scale-95 espacoso:bottom-5 espacoso:left-5"
      >
        {urgentes > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-marca-vermelho px-1 text-[11px] font-bold text-white ring-2 ring-marca-branco">
            {urgentes > 9 ? "9+" : urgentes}
          </span>
        )}
        {urgentes > 0 && (
          <span className="absolute inline-flex h-12 w-12 animate-ping rounded-full bg-marca-vermelho/30" aria-hidden />
        )}
        <Bell size={20} aria-hidden />
      </button>

      {/* Painel */}
      {aberto && (
        <>
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => setAberto(false)}
            aria-hidden
          />
          <div className="fixed bottom-[152px] left-4 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-marca bg-white shadow-modal animate-fadeIn espacoso:bottom-20 espacoso:left-5">
            <div className="flex items-center justify-between gap-2 bg-marca-azulEscuro px-4 py-3 text-white">
              <span className="flex items-center gap-2 text-sm font-bold">
                <Bell size={16} aria-hidden /> Lembretes
              </span>
              <button
                type="button"
                onClick={() => setAberto(false)}
                aria-label="Fechar"
                className="rounded-marca p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {visiveis.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-marca-verdeClaro text-marca-verde">
                    <CheckCircle2 size={22} aria-hidden />
                  </span>
                  <p className="text-sm text-marca-cinza">Nada urgente. Tudo em dia!</p>
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {visiveis.map(({ card, dias }) => (
                    <li key={card.id}>
                      <ItemNotificacao
                        card={card}
                        dias={dias}
                        etapaTitulo={etapaPorId(card.etapa).titulo}
                        campanhaNome={campanhaPorId(card.campanhaId)?.nome}
                        marcaCor={(() => {
                          const camp = campanhaPorId(card.campanhaId);
                          return camp ? marcaPorId(camp.marca).cor : undefined;
                        })()}
                        onAbrir={() => {
                          setCardAbertoId(card.id);
                          setAberto(false);
                        }}
                        onDispensar={() => dispensar(card.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}

      {cardAberto && <ModalCard card={cardAberto} onFechar={() => setCardAbertoId(null)} />}
    </>
  );
}

function ItemNotificacao({
  card,
  dias,
  etapaTitulo,
  campanhaNome,
  marcaCor,
  onAbrir,
  onDispensar,
}: {
  card: CardConteudo;
  dias: number;
  etapaTitulo: string;
  campanhaNome?: string;
  marcaCor?: string;
  onAbrir: () => void;
  onDispensar: () => void;
}) {
  const atrasado = dias < 0;
  const urgente = dias <= 3;
  const prio = card.prioridade ? PRIORIDADES[card.prioridade] : null;
  const cor = atrasado ? "#EC1313" : urgente ? "#FA611E" : "#8790AB";

  return (
    <div className="group relative flex items-start gap-2 rounded-marca border border-marca-cinza/30 bg-white p-2.5 transition hover:border-marca-cinza/60 hover:shadow-card">
      <span className="mt-0.5 h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: cor }} aria-hidden />
      <button type="button" onClick={onAbrir} className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-1.5">
          <BadgeTipo tipo={card.tipo} tamanho="pequeno" />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-marca-preto">
            {card.titulo || "Sem título"}
          </span>
          {prio && (
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-marca px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
              style={{ backgroundColor: prio.cor }}
            >
              <Flag size={10} aria-hidden /> {prio.label}
            </span>
          )}
        </span>
        <span
          className="mt-1 flex items-center gap-1 text-xs font-semibold"
          style={{ color: cor }}
        >
          {atrasado ? <AlertTriangle size={12} aria-hidden /> : <Calendar size={12} aria-hidden />}
          {rotuloPrazo(dias)}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-marca-cinza">
          {marcaCor && (
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: marcaCor }} aria-hidden />
          )}
          {campanhaNome && <span className="min-w-0 truncate">{campanhaNome}</span>}
          <span>· {etapaTitulo}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={onDispensar}
        aria-label="Dispensar"
        title="Dispensar (some até amanhã)"
        className="shrink-0 rounded-marca p-1 text-marca-cinza opacity-0 transition hover:bg-marca-branco hover:text-marca-azulEscuro focus-visible:opacity-100 group-hover:opacity-100"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}
