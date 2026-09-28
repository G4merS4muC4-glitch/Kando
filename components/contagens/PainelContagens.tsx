"use client";

import { useEffect, useState } from "react";
import { Hourglass, Pencil, Pin, PinOff, Plus } from "lucide-react";
import { useBoard } from "@/lib/store";
import { useContagens } from "@/lib/contagensProvider";
import type { Contagem } from "@/lib/types";
import {
  formatarRestante,
  formatarRestanteLongo,
  progressoPct,
  restanteMs,
  rotuloAlvo,
  urgenciaDe,
  URGENCIAS,
} from "@/lib/contagens";
import ModalContagem from "./ModalContagem";

/**
 * Bloco de contagens regressivas: a lista de prazos da organizacao, com quanto
 * falta ao vivo (dias, horas e minutos), o dia/hora em que vence e a barra que
 * enche conforme a data chega. O alfinete escolhe qual prazo fica no card
 * flutuante deste aparelho, visivel em qualquer tela do painel.
 */
export default function PainelContagens() {
  const { contagens, contagemFixada, fixar, pronto } = useContagens();
  const { cardPorId } = useBoard();
  const [agoraMs, setAgoraMs] = useState(0);
  const [modal, setModal] = useState<Contagem | "novo" | null>(null);

  // Relogio por segundo. Comeca em 0 (igual no servidor) e so anda depois de
  // montar, para nao dar diferenca de hidratacao.
  useEffect(() => {
    setAgoraMs(Date.now());
    const id = window.setInterval(() => setAgoraMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="rounded-marca border border-marca-cinza/30 bg-white p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-marca-azulEscuro">
          <Hourglass size={16} aria-hidden /> Contagem regressiva
        </h2>
        <button
          type="button"
          onClick={() => setModal("novo")}
          className="flex items-center gap-1 rounded-marca bg-marca-laranja px-2.5 py-1.5 text-xs font-bold text-white transition hover:brightness-95"
          title="Criar um prazo para acompanhar"
        >
          <Plus size={14} aria-hidden /> Nova
        </button>
      </div>

      {!pronto || agoraMs === 0 ? (
        <p className="py-6 text-center text-xs text-marca-cinza">Carregando prazos...</p>
      ) : contagens.length === 0 ? (
        <p className="rounded-marca bg-marca-branco px-3 py-6 text-center text-xs text-marca-cinza">
          Nenhum prazo em contagem. Crie um para ver quantos dias, horas e minutos faltam.
        </p>
      ) : (
        <ul className="space-y-2">
          {contagens.map((c) => {
            const falta = restanteMs(c.alvo, agoraMs);
            const urgencia = urgenciaDe(falta);
            const cor = URGENCIAS[urgencia].cor;
            const pct = progressoPct(c.criadoEm, c.alvo, agoraMs);
            const card = c.cardId ? cardPorId(c.cardId) : undefined;
            const naTela = contagemFixada?.id === c.id;
            return (
              <li
                key={c.id}
                className="group relative flex items-start gap-2 rounded-marca border border-marca-cinza/30 bg-white p-2.5 transition hover:border-marca-cinza/60 hover:shadow-card"
              >
                <span
                  className="mt-0.5 h-10 w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: cor }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-marca-preto" title={c.titulo}>
                    {c.titulo}
                  </p>
                  <p
                    className="mt-0.5 text-lg font-bold tabular-nums"
                    style={{ color: cor }}
                    aria-label={
                      falta < 0
                        ? `Passou ${formatarRestanteLongo(falta)} do prazo`
                        : `Faltam ${formatarRestanteLongo(falta)}`
                    }
                  >
                    {falta < 0 ? `Venceu há ${formatarRestante(falta)}` : formatarRestante(falta)}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-marca-cinza">
                    Vence {rotuloAlvo(c.alvo, agoraMs)}
                    {card ? ` · ${card.titulo || "Sem título"}` : ""}
                  </p>
                  <div
                    className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-marca-cinza/20"
                    role="progressbar"
                    aria-valuenow={Math.round(pct)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Quanto do prazo já passou"
                  >
                    <span
                      className="block h-full rounded-full transition-[width] duration-500 ease-suave"
                      style={{ width: `${pct}%`, backgroundColor: cor }}
                    />
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => fixar(naTela ? null : c.id)}
                    aria-pressed={naTela}
                    aria-label={naTela ? "Tirar da tela" : "Mostrar na tela"}
                    title={naTela ? "Tirar da tela" : "Mostrar na tela (card flutuante)"}
                    className={`rounded-marca p-1.5 transition ${
                      naTela
                        ? "bg-marca-laranja/10 text-marca-laranja"
                        : "text-marca-cinza hover:bg-marca-branco hover:text-marca-azulEscuro"
                    }`}
                  >
                    {naTela ? <Pin size={14} aria-hidden /> : <PinOff size={14} aria-hidden />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setModal(c)}
                    aria-label="Ajustar prazo"
                    title="Ajustar ou excluir"
                    className="rounded-marca p-1.5 text-marca-cinza transition hover:bg-marca-branco hover:text-marca-azulEscuro"
                  >
                    <Pencil size={14} aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {modal !== null && (
        <ModalContagem
          contagem={modal === "novo" ? undefined : modal}
          onFechar={() => setModal(null)}
        />
      )}
    </div>
  );
}
