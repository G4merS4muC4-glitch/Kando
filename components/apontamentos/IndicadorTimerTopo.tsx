"use client";

import { useEffect, useState } from "react";
import { Timer, Square, Play, AlertTriangle } from "lucide-react";
import { useBoard } from "@/lib/store";
import { useApontamentos } from "@/lib/apontamentosProvider";
import { corridoMs, formatarRelogio, formatarDuracao } from "@/lib/apontamentos";
import ModalIniciarTimer from "./ModalIniciarTimer";

const LIMITE_LONGO_MS = 8 * 3_600_000; // acima disso, sugere ajustar o termino

/**
 * Indicador de timer fixo no topo, visivel em qualquer pagina.
 * Rodando: pilula laranja com o card e o tempo correndo (calculado por
 * diferenca entre inicio e agora; sobreviver a fechar a aba). Parado: botao
 * discreto para iniciar.
 */
export default function IndicadorTimerTopo() {
  const { timerAtivo, pararTimer } = useApontamentos();
  const { cardPorId } = useBoard();

  const [montado, setMontado] = useState(false);
  const [agoraMs, setAgoraMs] = useState(0);
  const [iniciarAberto, setIniciarAberto] = useState(false);
  const [ajustarAberto, setAjustarAberto] = useState(false);

  useEffect(() => setMontado(true), []);

  // Atualiza o relogio a cada segundo enquanto houver timer (so para exibir).
  useEffect(() => {
    if (!timerAtivo) return;
    setAgoraMs(Date.now());
    const id = window.setInterval(() => setAgoraMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [timerAtivo]);

  // Antes de montar no cliente, mostra so o botao de iniciar (evita divergencia
  // de hidratacao por causa do relogio).
  if (!montado || !timerAtivo) {
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

  const card = cardPorId(timerAtivo.cardId);
  const ms = corridoMs(timerAtivo.inicio, agoraMs);
  const longo = ms > LIMITE_LONGO_MS;

  function aoParar() {
    if (longo) setAjustarAberto(true);
    else pararTimer();
  }

  return (
    <>
      <div
        className="flex items-center gap-2 rounded-marca bg-marca-laranja px-2.5 py-1.5 text-white shadow-sm"
        title={card?.titulo || "Card removido"}
      >
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        <span className="hidden max-w-[160px] truncate text-sm font-semibold sm:inline">
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
          className="ml-0.5 flex items-center gap-1 rounded-marca bg-white/20 px-2 py-1 text-xs font-bold transition hover:bg-white/30"
        >
          <Square size={13} fill="currentColor" aria-hidden />
          <span className="hidden sm:inline">Parar</span>
        </button>
      </div>

      {ajustarAberto && (
        <ModalAjustarParada
          inicioISO={timerAtivo.inicio}
          tituloCard={card?.titulo || "Card removido"}
          onFechar={() => setAjustarAberto(false)}
        />
      )}
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
 */
function ModalAjustarParada({
  inicioISO,
  tituloCard,
  onFechar,
}: {
  inicioISO: string;
  tituloCard: string;
  onFechar: () => void;
}) {
  const { ajustarEPararTimer, pararTimer } = useApontamentos();
  const [fim, setFim] = useState(() => paraInputLocal(new Date().toISOString()));
  const [erro, setErro] = useState<string | null>(null);

  const inicioMs = new Date(inicioISO).getTime();
  const fimMs = new Date(fim).getTime();
  const previa = Number.isFinite(fimMs) && fimMs > inicioMs ? formatarDuracao(fimMs - inicioMs) : null;

  function salvar() {
    if (!Number.isFinite(fimMs) || fimMs <= inicioMs) {
      setErro("O término precisa ser depois do início.");
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
