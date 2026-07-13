"use client";

import { X } from "lucide-react";
import { checkpointsComDuracao, horaLocal, formatarDuracao } from "@/lib/apontamentos";
import type { Checkpoint } from "@/lib/types";

/** Cor do horario + estilo do texto conforme o tipo do marcador. */
function estiloDe(tipo: Checkpoint["tipo"], ehPausa: boolean): { cor: string; classe: string } {
  if (ehPausa || tipo === "pausa") return { cor: "#8790AB", classe: "italic text-marca-cinza" };
  if (tipo === "etapa") return { cor: "#044B8C", classe: "font-medium text-marca-azulEscuro" };
  if (tipo === "tarefa") return { cor: "#16A34A", classe: "font-medium text-marca-verdeEscuro" };
  return { cor: "#FA611E", classe: "text-marca-preto" };
}

/**
 * Linha do tempo de uma sessao: os checkpoints (notas, pausas, trocas de etapa e
 * tarefas concluidas) com o horario e quanto durou cada trecho. Reaproveitada na
 * edicao do registro (com remover) e na linha do tempo completa do projeto (so leitura).
 */
export default function ListaCheckpoints({
  checkpoints,
  fim,
  onRemover,
}: {
  checkpoints: Checkpoint[];
  fim: string; // ISO do fim da sessao (para calcular a duracao do ultimo trecho)
  onRemover?: (id: string) => void;
}) {
  const itens = checkpointsComDuracao(checkpoints, fim);
  if (itens.length === 0) return null;
  return (
    <ul className="space-y-0.5 rounded-marca border border-marca-cinza/30 bg-marca-branco p-2">
      {itens.map((cp) => {
        const e = estiloDe(cp.tipo, cp.ehPausa);
        return (
          <li
            key={cp.id}
            className="group/cp flex items-start gap-2 rounded px-1 py-0.5 text-sm hover:bg-white"
          >
            <span
              className="mt-px shrink-0 font-mono text-[11px] font-semibold tabular-nums"
              style={{ color: e.cor }}
            >
              {horaLocal(cp.em)}
            </span>
            <span className={`min-w-0 flex-1 break-words ${e.classe}`}>{cp.texto}</span>
            {!cp.ehPausa && cp.ateMs > 0 && (
              <span className="shrink-0 text-[11px] text-marca-cinza">{formatarDuracao(cp.ateMs)}</span>
            )}
            {onRemover && (
              <button
                type="button"
                onClick={() => onRemover(cp.id)}
                aria-label="Remover checkpoint"
                title="Remover"
                className="shrink-0 rounded p-0.5 text-marca-cinza opacity-0 transition hover:text-marca-vermelho focus-visible:opacity-100 group-hover/cp:opacity-100"
              >
                <X size={13} aria-hidden />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
