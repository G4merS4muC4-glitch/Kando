"use client";

import { useEffect, useState } from "react";
import { Clock, Play } from "lucide-react";
import {
  duracaoMs,
  tempoTrabalhadoMs,
  formatarDuracao,
  horaLocal,
  diaDoRegistro,
} from "@/lib/apontamentos";
import { formatarData } from "@/lib/util";
import type { Checkpoint, RegistroTempo, TimerAtivo } from "@/lib/types";
import ListaCheckpoints from "./ListaCheckpoints";

interface Sessao {
  id: string;
  dia: string; // yyyy-mm-dd (pelo inicio)
  inicio: string;
  fim: string; // ISO (para a sessao em andamento, o "agora")
  ms: number; // tempo trabalhado
  nota?: string;
  autorNome: string;
  checkpoints: Checkpoint[];
  emAndamento: boolean;
}

/**
 * Linha do tempo COMPLETA do projeto/card: todas as sessoes (registros salvos + a
 * que estiver em andamento), agrupadas por dia, mais nova primeiro. Cada sessao
 * mostra horario, autor, duracao e os checkpoints (notas, pausas, trocas de etapa
 * e tarefas concluidas). Da a visao de tudo que ja foi trabalhado no projeto.
 */
export default function LinhaDoTempoProjeto({
  registros,
  timerAtivo,
}: {
  registros: RegistroTempo[];
  timerAtivo?: TimerAtivo;
}) {
  const [agoraMs, setAgoraMs] = useState(() => (typeof window !== "undefined" ? Date.now() : 0));
  useEffect(() => {
    if (!timerAtivo || timerAtivo.pausadoEm) return;
    setAgoraMs(Date.now());
    const id = window.setInterval(() => setAgoraMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [timerAtivo]);

  const sessoes: Sessao[] = [];
  if (timerAtivo) {
    sessoes.push({
      id: "andamento",
      dia: diaDoRegistro({ inicio: timerAtivo.inicio }),
      inicio: timerAtivo.inicio,
      fim: new Date(agoraMs || Date.now()).toISOString(),
      ms: tempoTrabalhadoMs(timerAtivo, agoraMs || Date.now()),
      nota: timerAtivo.nota,
      autorNome: timerAtivo.autorNome,
      checkpoints: timerAtivo.checkpoints ?? [],
      emAndamento: true,
    });
  }
  for (const r of registros) {
    sessoes.push({
      id: r.id,
      dia: diaDoRegistro(r),
      inicio: r.inicio,
      fim: r.fim,
      ms: duracaoMs(r),
      nota: r.nota,
      autorNome: r.autorNome,
      checkpoints: r.checkpoints ?? [],
      emAndamento: false,
    });
  }
  sessoes.sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime()); // mais novo primeiro
  const totalMs = sessoes.reduce((s, x) => s + x.ms, 0);

  if (sessoes.length === 0) {
    return (
      <p className="rounded-marca border border-dashed border-marca-cinza/40 px-3 py-6 text-center text-sm text-marca-cinza">
        Nenhum tempo registrado neste projeto ainda.
      </p>
    );
  }

  // Agrupa por dia mantendo a ordem (mais novo primeiro).
  const dias: { dia: string; itens: Sessao[] }[] = [];
  for (const s of sessoes) {
    const g = dias.find((d) => d.dia === s.dia);
    if (g) g.itens.push(s);
    else dias.push({ dia: s.dia, itens: [s] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-marca bg-marca-branco px-3 py-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-marca-azulEscuro">
          <Clock size={15} aria-hidden /> Tempo total no projeto
        </span>
        <span className="font-mono text-sm font-bold text-marca-azulEscuro">{formatarDuracao(totalMs)}</span>
      </div>

      {dias.map(({ dia, itens }) => (
        <div key={dia}>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-marca-cinza">
            {formatarData(dia)}
          </p>
          <div className="space-y-2">
            {itens.map((s) => (
              <div
                key={s.id}
                className={`rounded-marca border p-2.5 ${
                  s.emAndamento
                    ? "border-marca-laranja/60 bg-marca-laranja/5"
                    : "border-marca-cinza/25 bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-marca-preto">
                    {s.emAndamento && (
                      <Play size={11} className="text-marca-laranja" fill="currentColor" aria-hidden />
                    )}
                    {horaLocal(s.inicio)}
                    {s.emAndamento ? " · agora" : ` – ${horaLocal(s.fim)}`}
                  </span>
                  <span className="shrink-0 font-mono font-bold text-marca-azulEscuro">
                    {formatarDuracao(s.ms)}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-marca-cinza">
                  {s.autorNome}
                  {s.nota ? ` · ${s.nota}` : ""}
                </p>
                {s.checkpoints.length > 0 && (
                  <div className="mt-2">
                    <ListaCheckpoints checkpoints={s.checkpoints} fim={s.fim} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
