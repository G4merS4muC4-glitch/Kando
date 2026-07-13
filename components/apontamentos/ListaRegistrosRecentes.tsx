"use client";

import { useEffect, useMemo, useState } from "react";
import { History, Timer } from "lucide-react";
import { useBoard } from "@/lib/store";
import type { Marca, RegistroTempo, TimerAtivo } from "@/lib/types";
import { corridoMs, formatarRelogio } from "@/lib/apontamentos";
import CardRegistro from "./CardRegistro";

/**
 * Coluna lateral de registros recentes (mais novos primeiro). O timer em
 * andamento aparece destacado no topo, com o tempo correndo.
 */
export default function ListaRegistrosRecentes({
  registros,
  timerAtivo,
  onAbrir,
}: {
  registros: RegistroTempo[];
  timerAtivo: TimerAtivo | null;
  onAbrir: (reg: RegistroTempo) => void;
}) {
  const { cardPorId, campanhaPorId } = useBoard();

  const marcaDoCard = (cardId: string): Marca | undefined => {
    const card = cardPorId(cardId);
    return card ? campanhaPorId(card.campanhaId)?.marca : undefined;
  };

  const recentes = useMemo(
    () => [...registros].sort((a, b) => (a.atualizadoEm < b.atualizadoEm ? 1 : -1)).slice(0, 40),
    [registros]
  );

  return (
    <div className="rounded-marca border border-marca-cinza/30 bg-white p-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-marca-azulEscuro">
        <History size={16} aria-hidden /> Registros recentes
      </p>

      {timerAtivo && <TimerCorrendo timer={timerAtivo} titulo={cardPorId(timerAtivo.cardId)?.titulo} />}

      {/* Caixa com rolagem: mostra ~5 por vez (mais novo primeiro) em vez de uma
          fila infinita empilhada. */}
      <div className="mt-2 max-h-[22rem] space-y-2 overflow-y-auto pr-1">
        {recentes.length === 0 && !timerAtivo ? (
          <p className="rounded-marca bg-marca-branco px-3 py-6 text-center text-xs text-marca-cinza">
            Nenhuma hora apontada ainda. Use o timer no topo.
          </p>
        ) : (
          recentes.map((r) => (
            <CardRegistro
              key={r.id}
              registro={r}
              card={cardPorId(r.cardId)}
              marca={marcaDoCard(r.cardId)}
              onAbrir={onAbrir}
            />
          ))
        )}
      </div>
    </div>
  );
}

/** Cartao do timer em andamento (tempo correndo, calculado por diferenca). */
function TimerCorrendo({ timer, titulo }: { timer: TimerAtivo; titulo?: string }) {
  const [agoraMs, setAgoraMs] = useState(0);
  useEffect(() => {
    setAgoraMs(Date.now());
    const id = window.setInterval(() => setAgoraMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-2 rounded-marca border border-marca-laranja bg-marca-laranja/5 p-2.5">
      <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-marca-laranja/60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-marca-laranja" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-marca-preto">
          {titulo || "Card removido"}
        </span>
        <span className="flex items-center gap-1 text-[11px] font-semibold text-marca-laranja">
          <Timer size={11} aria-hidden /> Em andamento
        </span>
      </span>
      <span className="font-mono text-sm font-bold tabular-nums text-marca-azulEscuro">
        {agoraMs ? formatarRelogio(corridoMs(timer.inicio, agoraMs)) : "..."}
      </span>
    </div>
  );
}
