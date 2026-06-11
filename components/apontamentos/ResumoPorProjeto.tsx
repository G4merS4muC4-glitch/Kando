"use client";

import { useMemo } from "react";
import { FolderKanban, Users } from "lucide-react";
import { useBoard } from "@/lib/store";
import type { Marca, RegistroTempo } from "@/lib/types";
import { formatarDuracao, totalPorAutor, totalPorCard } from "@/lib/apontamentos";

/** Mostra so o nome (antes do @) quando o autor for um e-mail. */
function nomeCurto(nome: string): string {
  if (!nome) return "Sem nome";
  return nome.includes("@") ? nome.split("@")[0] : nome;
}

/** Horas por projeto (maior para menor) e por pessoa, com barra de proporcao. */
export default function ResumoPorProjeto({ registros }: { registros: RegistroTempo[] }) {
  const { cardPorId, campanhaPorId, marcaPorId } = useBoard();

  const porProjeto = useMemo(() => {
    const tot = totalPorCard(registros);
    return [...tot.entries()]
      .map(([cardId, ms]) => {
        const card = cardPorId(cardId);
        const marca: Marca | undefined = card ? campanhaPorId(card.campanhaId)?.marca : undefined;
        return {
          cardId,
          ms,
          titulo: card?.titulo || "Card removido",
          cor: marcaPorId(marca ?? "").cor,
        };
      })
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 12);
  }, [registros, cardPorId, campanhaPorId, marcaPorId]);

  const porPessoa = useMemo(() => totalPorAutor(registros), [registros]);

  const maxProjeto = porProjeto[0]?.ms ?? 0;
  const maxPessoa = porPessoa[0]?.ms ?? 0;

  return (
    <div className="rounded-marca border border-marca-cinza/30 bg-white p-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-marca-azulEscuro">
        <FolderKanban size={16} aria-hidden /> Horas por projeto
      </p>
      {porProjeto.length === 0 ? (
        <p className="rounded-marca bg-marca-branco px-3 py-5 text-center text-xs text-marca-cinza">
          Sem horas no período.
        </p>
      ) : (
        <div className="space-y-2">
          {porProjeto.map((p) => (
            <div key={p.cardId}>
              <div className="mb-0.5 flex items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate font-medium text-marca-preto">{p.titulo}</span>
                <span className="shrink-0 font-semibold text-marca-azulEscuro">
                  {formatarDuracao(p.ms)}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-marca-branco">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${maxProjeto > 0 ? Math.max(3, (p.ms / maxProjeto) * 100) : 0}%`,
                    backgroundColor: p.cor,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Por pessoa */}
      {porPessoa.length > 0 && (
        <>
          <p className="mb-2 mt-4 flex items-center gap-1.5 text-sm font-bold text-marca-azulEscuro">
            <Users size={16} aria-hidden /> Horas por pessoa
          </p>
          <div className="space-y-2">
            {porPessoa.map((p) => (
              <div key={p.autorId}>
                <div className="mb-0.5 flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate font-medium text-marca-preto">
                    {nomeCurto(p.nome)}
                  </span>
                  <span className="shrink-0 font-semibold text-marca-azulEscuro">
                    {formatarDuracao(p.ms)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-marca-branco">
                  <div
                    className="h-full rounded-full bg-marca-azulEscuro"
                    style={{ width: `${maxPessoa > 0 ? Math.max(3, (p.ms / maxPessoa) * 100) : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
