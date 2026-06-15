"use client";

import { useState } from "react";
import { Timer, Square, AlertTriangle } from "lucide-react";
import { useApontamentos } from "@/lib/apontamentosProvider";
import { formatarDuracao } from "@/lib/apontamentos";
import ModalIniciarTimer from "./ModalIniciarTimer";

/**
 * Botao de iniciar timer, fixo no topo e visivel em qualquer pagina. Quando ha
 * um timer rodando, quem assume e o card de tempo flutuante (CartaoTimerFlutuante),
 * entao aqui nao mostramos nada para nao duplicar o indicador.
 */
export default function IndicadorTimerTopo() {
  const { timerAtivo } = useApontamentos();
  const [iniciarAberto, setIniciarAberto] = useState(false);

  // Rodando: o card flutuante assume o controle; o topo nao mostra a pilula.
  if (timerAtivo) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIniciarAberto(true)}
        className="flex items-center gap-1.5 rounded-marca border border-white/25 px-2.5 py-1.5 text-sm font-semibold text-white/85 transition hover:bg-white/10 hover:text-white"
        title="Iniciar timer"
      >
        <Timer size={16} aria-hidden />
        <span className="hidden md:inline">Iniciar</span>
      </button>
      {iniciarAberto && <ModalIniciarTimer onFechar={() => setIniciarAberto(false)} />}
    </>
  );
}

/** Converte ISO para o valor de um input datetime-local (horario local). */
function paraInputLocal(iso: string): string {
  const d = new Date(iso);
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

/**
 * Aparece ao parar um timer que rodou tempo demais (ex.: esquecido a noite).
 * Permite confirmar "agora" ou corrigir o horario de termino antes de gravar.
 * Exportado para ser reaproveitado pela faixa de timer do mobile.
 */
export function ModalAjustarParada({
  inicioISO,
  tituloCard,
  pausaMs = 0,
  onFechar,
}: {
  inicioISO: string;
  tituloCard: string;
  pausaMs?: number; // tempo pausado, descontado do que sera gravado
  onFechar: () => void;
}) {
  const { ajustarEPararTimer, pararTimer } = useApontamentos();
  const [fim, setFim] = useState(() => paraInputLocal(new Date().toISOString()));
  const [erro, setErro] = useState<string | null>(null);

  const inicioMs = new Date(inicioISO).getTime();
  const fimMs = new Date(fim).getTime();
  const trabalhadoMs = Number.isFinite(fimMs) ? fimMs - inicioMs - pausaMs : NaN;
  const previa = trabalhadoMs > 0 ? formatarDuracao(trabalhadoMs) : null;

  function salvar() {
    if (!Number.isFinite(fimMs) || fimMs <= inicioMs) {
      setErro("O término precisa ser depois do início.");
      return;
    }
    if (trabalhadoMs <= 0) {
      setErro("Com a pausa descontada, o tempo trabalhado fica zerado. Ajuste o término.");
      return;
    }
    ajustarEPararTimer(new Date(fim).toISOString());
    onFechar();
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-marca-preto/50 p-4 animate-fadeIn"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label="Ajustar término do timer"
    >
      <div
        className="w-full max-w-sm rounded-marca bg-white p-5 shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="flex items-center gap-2 text-base font-bold text-marca-azulEscuro">
          <AlertTriangle size={18} className="text-marca-laranja" aria-hidden /> Timer longo
        </h2>
        <p className="mt-1.5 text-sm text-marca-cinza">
          O timer de <strong>{tituloCard}</strong> rodou por muito tempo. Confirme o término para
          não distorcer as horas.
        </p>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
            Término
          </span>
          <input
            type="datetime-local"
            value={fim}
            onChange={(e) => {
              setFim(e.target.value);
              setErro(null);
            }}
            className="w-full rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 text-sm text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
          />
        </label>
        {previa && <p className="mt-1.5 text-xs text-marca-cinza">Duração: {previa}.</p>}
        {erro && <p className="mt-1.5 text-sm font-semibold text-marca-vermelho">{erro}</p>}

        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              pararTimer();
              onFechar();
            }}
            className="rounded-marca px-3 py-2 text-sm font-semibold text-marca-cinza transition hover:text-marca-azulEscuro"
          >
            Usar agora
          </button>
          <button
            type="button"
            onClick={salvar}
            className="flex items-center gap-1.5 rounded-marca bg-marca-laranja px-4 py-2 text-sm font-bold text-white transition hover:brightness-95"
          >
            <Square size={14} fill="currentColor" aria-hidden /> Salvar término
          </button>
        </div>
      </div>
    </div>
  );
}
