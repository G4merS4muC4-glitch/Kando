"use client";

import { useEffect, useState } from "react";
import { Square, AlertTriangle } from "lucide-react";
import { useBoard } from "@/lib/store";
import { useApontamentos } from "@/lib/apontamentosProvider";
import { corridoMs, formatarRelogio } from "@/lib/apontamentos";
import { ModalAjustarParada } from "./apontamentos/IndicadorTimerTopo";

const LIMITE_LONGO_MS = 8 * 3_600_000; // acima disso, sugere ajustar o termino

/**
 * Faixa fina de timer ativo (somente mobile), logo acima da barra inferior.
 * E um indicador, nao uma aba: aparece so quando ha um timer rodando, mostrando
 * o projeto, o tempo correndo e o botao de parar. O tempo e calculado por
 * diferenca (inicio ate agora), entao sobrevive a fechar a aba. No desktop o
 * indicador continua no topo (este componente nao aparece).
 */
export default function FaixaTimerMobile() {
  const { timerAtivo, pararTimer } = useApontamentos();
  const { cardPorId } = useBoard();

  const [montado, setMontado] = useState(false);
  const [agoraMs, setAgoraMs] = useState(0);
  const [ajustarAberto, setAjustarAberto] = useState(false);

  useEffect(() => setMontado(true), []);

  useEffect(() => {
    if (!timerAtivo) return;
    setAgoraMs(Date.now());
    const id = window.setInterval(() => setAgoraMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [timerAtivo]);

  if (!montado || !timerAtivo) return null;

  const card = cardPorId(timerAtivo.cardId);
  const ms = corridoMs(timerAtivo.inicio, agoraMs);
  const longo = ms > LIMITE_LONGO_MS;

  function aoParar() {
    if (longo) setAjustarAberto(true);
    else pararTimer();
  }

  return (
    <>
      <div className="flex items-center gap-2 bg-marca-laranja px-3 py-2 text-white sm:hidden">
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        <span className="flex-1 truncate text-sm font-semibold">
          {card?.titulo || "Card removido"}
        </span>
        <span className="font-mono text-sm font-bold tabular-nums">{formatarRelogio(ms)}</span>
        {longo && (
          <AlertTriangle size={14} className="text-white/90" aria-label="Timer rodando há muito tempo" />
        )}
        <button
          type="button"
          onClick={aoParar}
          aria-label="Parar timer"
          className="flex shrink-0 items-center gap-1 rounded-marca bg-white/20 px-2.5 py-1.5 text-xs font-bold transition hover:bg-white/30"
        >
          <Square size={13} fill="currentColor" aria-hidden />
          Parar
        </button>
      </div>

      {ajustarAberto && (
        <ModalAjustarParada
          inicioISO={timerAtivo.inicio}
          tituloCard={card?.titulo || "Card removido"}
          onFechar={() => setAjustarAberto(false)}
        />
      )}
    </>
  );
}
