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

// O sino do topo (celular) so mostra o contador e pede para abrir: a central e a
// unica dona do estado e avisa o contador por evento (sem estado duplicado).
const EVENTO_CONTADOR = "kando:lembretes-contador";
const EVENTO_ABRIR = "kando:lembretes-abrir";
let ultimoContador = 0;

/** Sino de lembretes para o topo do celular (a central flutuante fica so no desktop). */
export function SinoLembretes() {
  const [urgentes, setUrgentes] = useState(ultimoContador);
  useEffect(() => {
    const aoMudar = (e: Event) => setUrgentes((e as CustomEvent<number>).detail);
    window.addEventListener(EVENTO_CONTADOR, aoMudar);
    setUrgentes(ultimoContador);
    return () => window.removeEventListener(EVENTO_CONTADOR, aoMudar);
  }, []);
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(EVENTO_ABRIR))}
      aria-label={`Lembretes${urgentes > 0 ? ` (${urgentes})` : ""}`}
      className="pressionavel relative flex h-10 w-10 items-center justify-center rounded-full text-white/90 transition hover:bg-white/10"
    >
      <Bell size={20} aria-hidden />
      {urgentes > 0 && (
        <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-marca-vermelho px-1 text-[10px] font-bold text-white ring-2 ring-marca-azulEscuro">
          {urgentes > 9 ? "9+" : urgentes}
        </span>
      )}
    </button>
  );
}

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

  // Avisa o sino do topo (celular) e atende o pedido dele para abrir a lista.
  useEffect(() => {
    ultimoContador = urgentes;
    window.dispatchEvent(new CustomEvent(EVENTO_CONTADOR, { detail: urgentes }));
  }, [urgentes]);
  useEffect(() => {
    const abrir = () => setAberto(true);
    window.addEventListener(EVENTO_ABRIR, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR, abrir);
  }, []);

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
      {/* Sino flutuante (canto inferior esquerdo, so no desktop: no celular ele
          fica no topo, sem cobrir o conteudo) */}
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label={`Notificações${urgentes > 0 ? ` (${urgentes})` : ""}`}
        title="Lembretes e prazos"
        className="fixed bottom-5 left-5 z-40 hidden h-12 w-12 items-center justify-center rounded-full bg-marca-azulEscuro text-white shadow-modal transition hover:brightness-110 active:scale-95 espacoso:flex"
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
            className="fixed inset-0 z-40 bg-marca-preto/40 animate-fadeIn espacoso:bg-transparent"
            onClick={() => setAberto(false)}
            aria-hidden
          />
          {/* Celular: folha que sobe do rodape. Desktop: painel acima do sino. */}
          <div className="fixed inset-x-0 bottom-0 z-50 overflow-hidden rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] shadow-modal animate-folhaSobe espacoso:inset-x-auto espacoso:bottom-20 espacoso:left-5 espacoso:w-[min(22rem,calc(100vw-2rem))] espacoso:rounded-marca espacoso:pb-0 espacoso:animate-fadeIn">
            <div className="flex justify-center bg-marca-azulEscuro pt-2 espacoso:hidden" aria-hidden>
              <span className="h-1 w-10 rounded-full bg-white/30" />
            </div>
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
        className="shrink-0 rounded-marca p-2 text-marca-cinza transition hover:bg-marca-branco hover:text-marca-azulEscuro focus-visible:opacity-100 espacoso:p-1 espacoso:opacity-0 espacoso:group-hover:opacity-100"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}
