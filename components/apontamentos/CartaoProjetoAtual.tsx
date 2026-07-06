"use client";

import { useEffect, useState } from "react";
import { Play, Pause, Square, Flag, Calendar, AlertTriangle, Maximize2 } from "lucide-react";
import { CANAIS, PRIORIDADES } from "@/lib/config";
import { useBoard } from "@/lib/store";
import { useApontamentos } from "@/lib/apontamentosProvider";
import { formatarRelogio, tempoTrabalhadoMs, formatarDuracao } from "@/lib/apontamentos";
import type { CardConteudo } from "@/lib/types";
import { formatarData, prazoVencido } from "@/lib/util";
import BadgeTipo from "@/components/BadgeTipo";

/**
 * Card em destaque do "Projeto atual" no Painel: o conteudo em produção mais
 * prioritario (ou o que estiver com o timer rodando). Mostra os detalhes e um
 * cronometro grande: inicia com um toque e, enquanto roda, mostra a contagem ao
 * vivo junto com o total ja registrado no card.
 */
export default function CartaoProjetoAtual({
  card,
  onAbrir,
}: {
  card: CardConteudo;
  onAbrir: (id: string) => void;
}) {
  const { campanhaPorId, marcaPorId, etapaPorId, etapaPostado } = useBoard();
  const { timerAtivo, iniciarTimer, pararTimer, alternarPausa, totalMsDoCard } = useApontamentos();

  const timandoEste = timerAtivo?.cardId === card.id;
  const pausado = timandoEste && Boolean(timerAtivo?.pausadoEm);

  // Relogio por segundo enquanto ESTE card corre (so para exibir; o tempo real e
  // por diferenca). Init preguicoso com Date.now() para nao piscar "0:00" no
  // primeiro quadro; quando pausado atualiza uma vez e para (o valor congela).
  const [agoraMs, setAgoraMs] = useState(() => (typeof window !== "undefined" ? Date.now() : 0));
  useEffect(() => {
    if (!timandoEste) return;
    setAgoraMs(Date.now());
    if (pausado) return;
    const id = window.setInterval(() => setAgoraMs(Date.now()), 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timandoEste, pausado, timerAtivo?.inicio]);

  const camp = campanhaPorId(card.campanhaId);
  const marca = camp ? marcaPorId(camp.marca) : undefined;
  const prio = card.prioridade ? PRIORIDADES[card.prioridade] : null;
  const vencido = prazoVencido(card.dataPublicacao, card.etapa, etapaPostado.id);
  const totalMs = totalMsDoCard(card.id);
  const vivoMs = timandoEste && timerAtivo ? tempoTrabalhadoMs(timerAtivo, agoraMs) : 0;

  return (
    <div className="relative overflow-hidden rounded-marca border border-marca-cinza/30 bg-white p-4 shadow-card">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <BadgeTipo tipo={card.tipo} tamanho="pequeno" />
          {prio && (
            <span
              className="inline-flex items-center gap-1 rounded-marca px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
              style={{ backgroundColor: prio.cor }}
            >
              <Flag size={10} aria-hidden /> {prio.label}
            </span>
          )}
          {marca && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-marca-cinza">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: marca.cor }} aria-hidden />
              {marca.nome}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onAbrir(card.id)}
          title="Abrir detalhes"
          className="flex shrink-0 items-center gap-1 rounded-marca border border-marca-cinza/40 px-2 py-1 text-xs font-semibold text-marca-azulEscuro transition hover:border-marca-azulEscuro hover:bg-marca-branco"
        >
          <Maximize2 size={13} aria-hidden /> <span className="hidden sm:inline">Abrir</span>
        </button>
      </div>

      <h3 className="text-base font-bold leading-snug text-marca-azulEscuro">
        {card.titulo || "Sem título"}
      </h3>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-marca-cinza">
        {camp && <span className="min-w-0 truncate">{camp.nome}</span>}
        <span>· {etapaPorId(card.etapa).titulo}</span>
        {card.dataPublicacao && (
          <span
            className={`inline-flex items-center gap-1 ${vencido ? "font-semibold" : ""}`}
            style={vencido ? { color: "#EC1313" } : undefined}
          >
            {vencido ? <AlertTriangle size={11} aria-hidden /> : <Calendar size={11} aria-hidden />}
            {formatarData(card.dataPublicacao)}
          </span>
        )}
        {card.canais.length > 0 && (
          <span className="inline-flex items-center gap-1">
            {card.canais.map((canal) => {
              const IconeCanal = CANAIS[canal].icone;
              return (
                <IconeCanal
                  key={canal}
                  size={12}
                  style={{ color: CANAIS[canal].cor }}
                  aria-label={CANAIS[canal].label}
                />
              );
            })}
          </span>
        )}
      </div>

      {card.briefing?.trim() && (
        <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-xs leading-relaxed text-marca-preto">
          {card.briefing}
        </p>
      )}

      {/* Cronometro */}
      <div className="mt-3 flex items-center justify-between gap-3 rounded-marca bg-marca-branco p-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-marca-cinza">
            {timandoEste ? (pausado ? "Pausado" : "Rodando agora") : "Cronômetro"}
          </p>
          {timandoEste ? (
            <>
              <p className="font-mono text-2xl font-bold tabular-nums text-marca-azulEscuro">
                {formatarRelogio(vivoMs)}
              </p>
              {totalMs > 0 && (
                <p className="text-[11px] text-marca-cinza">
                  Total registrado: {formatarDuracao(totalMs)}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-marca-cinza">
              Total registrado:{" "}
              <strong className="text-marca-azulEscuro">{formatarDuracao(totalMs)}</strong>
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {timandoEste ? (
            <>
              <button
                type="button"
                onClick={alternarPausa}
                aria-label={pausado ? "Retomar" : "Pausar"}
                title={pausado ? "Retomar" : "Pausar"}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-marca-cinza/40 text-marca-azulEscuro transition hover:bg-white active:scale-90"
              >
                {pausado ? (
                  <Play size={16} fill="currentColor" aria-hidden />
                ) : (
                  <Pause size={16} fill="currentColor" aria-hidden />
                )}
              </button>
              <button
                type="button"
                onClick={pararTimer}
                className="flex items-center gap-1.5 rounded-marca bg-marca-azulEscuro px-3 py-2 text-sm font-bold text-white transition hover:brightness-110 active:scale-95"
              >
                <Square size={14} fill="currentColor" aria-hidden /> Parar
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => iniciarTimer(card.id)}
              className="flex items-center gap-1.5 rounded-marca bg-marca-laranja px-3.5 py-2 text-sm font-bold text-white transition hover:brightness-95 active:scale-95"
            >
              <Play size={15} fill="currentColor" aria-hidden /> Iniciar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
