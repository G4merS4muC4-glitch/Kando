"use client";

import { useEffect, useState } from "react";
import { Play, Pause, User } from "lucide-react";
import { useBoard } from "@/lib/store";
import { formatarRelogio, tempoTrabalhadoMs } from "@/lib/apontamentos";
import type { TimerAtivo } from "@/lib/types";
import BadgeTipo from "@/components/BadgeTipo";

/**
 * Cartao (so leitura) do timer de um COLEGA rodando agora, no mesmo design do
 * "Projeto atual": mostra o nome da pessoa, o conteudo e a contagem ao vivo. Nao
 * tem controles (so o dono do timer controla o proprio). O tempo e calculado por
 * diferenca, entao acompanha em tempo real (com o realtime atualizando pausas etc.).
 */
export default function CartaoTimerColega({ timer }: { timer: TimerAtivo }) {
  const { cardPorId, campanhaPorId, marcaPorId } = useBoard();
  const pausado = Boolean(timer.pausadoEm);

  const [agoraMs, setAgoraMs] = useState(() => (typeof window !== "undefined" ? Date.now() : 0));
  useEffect(() => {
    setAgoraMs(Date.now());
    if (pausado) return;
    const id = window.setInterval(() => setAgoraMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [pausado, timer.inicio]);

  const card = cardPorId(timer.cardId);
  const camp = card ? campanhaPorId(card.campanhaId) : undefined;
  const marca = camp ? marcaPorId(camp.marca) : undefined;
  const vivoMs = tempoTrabalhadoMs(timer, agoraMs || Date.now());

  return (
    <div className="relative overflow-hidden rounded-marca border border-marca-cinza/30 bg-white p-4 shadow-card">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {card && <BadgeTipo tipo={card.tipo} tamanho="pequeno" />}
          {marca && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-marca-cinza">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: marca.cor }} aria-hidden />
              {marca.nome}
            </span>
          )}
        </div>
        <span className="flex min-w-0 shrink items-center gap-1 truncate text-[11px] font-semibold text-marca-azulEscuro">
          <User size={12} aria-hidden /> {timer.autorNome}
        </span>
      </div>

      <h3 className="line-clamp-2 text-base font-bold leading-snug text-marca-azulEscuro">
        {card?.titulo || "Conteúdo"}
      </h3>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-marca bg-marca-branco p-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-marca-cinza">
            <span className="relative flex h-2 w-2" aria-hidden>
              {!pausado && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-marca-laranja/60" />
              )}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${pausado ? "bg-marca-cinza" : "bg-marca-laranja"}`}
              />
            </span>
            {pausado ? "Pausado" : "Trabalhando agora"}
          </p>
          <p className="font-mono text-2xl font-bold tabular-nums text-marca-azulEscuro">
            {formatarRelogio(vivoMs)}
          </p>
        </div>
        <span className="shrink-0 text-marca-laranja" aria-hidden>
          {pausado ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
        </span>
      </div>
    </div>
  );
}
