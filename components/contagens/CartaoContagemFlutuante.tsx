"use client";

import { useEffect, useState } from "react";
import {
  AlarmClock,
  ChevronDown,
  ChevronUp,
  Hourglass,
  Pencil,
  Plus,
  X,
} from "lucide-react";
import { useContagens } from "@/lib/contagensProvider";
import {
  formatarContagem,
  formatarRestante,
  formatarRestanteLongo,
  progressoPct,
  restanteMs,
  rotuloAlvo,
  urgenciaDe,
  URGENCIAS,
} from "@/lib/contagens";
import { ALTURA_PILULA, useArrasteCartao } from "@/lib/useArrasteCartao";
import TituloRolante from "@/components/TituloRolante";
import ModalContagem from "./ModalContagem";

const POS_KEY = "kando:contagem-pos"; // posicao do card, por aparelho
const BASE_TOPO = 80; // distancia do topo na posicao padrao (abaixo do cabecalho)
const MAX_NA_LISTA = 4; // outros prazos mostrados na abinha

/**
 * Card de prazo flutuante: a contagem regressiva fixada neste aparelho, sobre
 * qualquer pagina. Mesma pilula de vidro liquido do timer (arrastavel, com
 * inercia), trocando o cronometro que sobe pelo que desce: dias, horas e minutos
 * que faltam, com os segundos correndo na reta final.
 *
 * A cor acompanha a urgencia: azul no prazo, laranja faltando menos de um dia e
 * vermelho quando venceu. A abinha mostra o prazo por extenso, a barra de
 * progresso e os proximos prazos (clicar troca o que fica na tela).
 */
export default function CartaoContagemFlutuante() {
  const { contagens, contagemFixada, fixar } = useContagens();

  const [agoraMs, setAgoraMs] = useState(() => (typeof window !== "undefined" ? Date.now() : 0));
  const [aberto, setAberto] = useState(false);
  const [modalAberto, setModalAberto] = useState<"novo" | "editar" | null>(null);

  const arraste = useArrasteCartao({
    chave: POS_KEY,
    padrao: { right: 16, top: BASE_TOPO },
    revalidarEm: contagemFixada?.id,
  });

  // Relogio por segundo (so para exibir; o que falta e sempre por diferenca).
  const temFixada = Boolean(contagemFixada);
  useEffect(() => {
    if (!temFixada) return;
    setAgoraMs(Date.now());
    const id = window.setInterval(() => setAgoraMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [temFixada]);

  if (!arraste.montado || !contagemFixada) return null;

  const falta = restanteMs(contagemFixada.alvo, agoraMs);
  const urgencia = urgenciaDe(falta);
  const vencida = falta < 0;
  const pulsa = urgencia === "vencida" || urgencia === "critica" || urgencia === "urgente";
  const pct = progressoPct(contagemFixada.criadoEm, contagemFixada.alvo, agoraMs);
  const outras = contagens.filter((c) => c.id !== contagemFixada.id).slice(0, MAX_NA_LISTA);

  const classePilula =
    urgencia === "vencida"
      ? "tp-solido-vermelho"
      : urgencia === "critica" || urgencia === "urgente"
        ? "tp-solido-laranja"
        : "tp-solido-azul";

  const paraCima = arraste.abrirParaCima(BASE_TOPO);

  const Painel = (
    <div
      className={`absolute left-0 right-0 ${
        paraCima ? "bottom-full mb-2" : "top-full mt-2"
      } tp-glass tp-glass-claro ${arraste.arrastando ? "tp-glass-elevado" : ""} animate-fadeIn`}
    >
      <div className="relative z-10 space-y-2.5 p-3">
        {/* Prazo por extenso + barra que enche conforme a data chega */}
        <div>
          <p className="text-xs font-bold text-marca-azulEscuro">
            {vencida
              ? `Passou ${formatarRestanteLongo(falta)} do prazo`
              : `Faltam ${formatarRestanteLongo(falta)}`}
          </p>
          <p className="mt-0.5 text-[11px] text-marca-cinza">
            Vence {rotuloAlvo(contagemFixada.alvo, agoraMs)}
          </p>
          <div
            className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-marca-cinza/25"
            role="progressbar"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Quanto do prazo já passou"
          >
            <span
              className="block h-full rounded-full transition-[width] duration-500 ease-suave"
              style={{ width: `${pct}%`, backgroundColor: URGENCIAS[urgencia].cor }}
            />
          </div>
        </div>

        {/* Outros prazos: clicar troca o que fica na tela */}
        {outras.length > 0 && (
          <div className="space-y-1 border-t border-marca-cinza/25 pt-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-marca-cinza">
              Próximos prazos
            </p>
            {outras.map((c) => {
              const f = restanteMs(c.alvo, agoraMs);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => fixar(c.id)}
                  title="Mostrar este prazo na tela"
                  className="flex w-full items-center gap-2 rounded-marca px-1.5 py-1 text-left transition hover:bg-white/70"
                >
                  <span
                    className="h-4 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: URGENCIAS[urgenciaDe(f)].cor }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-marca-preto">
                    {c.titulo}
                  </span>
                  <span className="shrink-0 text-[11px] font-bold tabular-nums text-marca-cinza">
                    {f < 0 ? `-${formatarRestante(f)}` : formatarRestante(f)}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Acoes */}
        <div className="flex items-center gap-2 border-t border-marca-cinza/25 pt-2">
          <button
            type="button"
            onClick={() => setModalAberto("editar")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-marca border border-marca-cinza/40 bg-white/80 px-2 py-1.5 text-xs font-semibold text-marca-azulEscuro transition hover:border-marca-laranja"
          >
            <Pencil size={13} aria-hidden /> Ajustar
          </button>
          <button
            type="button"
            onClick={() => setModalAberto("novo")}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-marca bg-marca-laranja px-2 py-1.5 text-xs font-bold text-white transition hover:brightness-95"
          >
            <Plus size={13} aria-hidden /> Novo prazo
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div
        ref={arraste.cartaoRef}
        style={arraste.estilo}
        onPointerDown={arraste.aoPressionar}
        onClickCapture={arraste.aoClicarCaptura}
        className="fixed z-40 w-72 max-w-[calc(100vw-1rem)] cursor-grab select-none active:cursor-grabbing"
      >
        <div
          ref={arraste.interiorRef}
          className="relative transition-[transform] duration-200 ease-suave will-change-transform"
        >
          {aberto && Painel}

          <div className={`${classePilula} ${arraste.arrastando ? "tp-glass-elevado" : ""}`}>
            <div
              style={{ textShadow: "0 1px 3px rgba(0,0,0,0.35)" }}
              className="relative z-10 flex items-center gap-1.5 px-3 py-1.5 text-white"
            >
              <span className="relative flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden>
                {pulsa && (
                  <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-white/60" />
                )}
                {vencida ? (
                  <AlarmClock size={15} className="relative" />
                ) : (
                  <Hourglass size={14} className="relative" />
                )}
              </span>
              <TituloRolante texto={contagemFixada.titulo} />
              <span
                className="shrink-0 font-mono text-sm font-bold tabular-nums"
                aria-label={
                  vencida
                    ? `Passou ${formatarRestanteLongo(falta)} do prazo`
                    : `Faltam ${formatarRestanteLongo(falta)}`
                }
              >
                {formatarContagem(falta)}
              </span>

              {/* Abrir/fechar a abinha de detalhes */}
              <button
                type="button"
                onClick={() => setAberto((v) => !v)}
                aria-label={aberto ? "Recolher detalhes do prazo" : "Abrir detalhes do prazo"}
                aria-expanded={aberto}
                title={aberto ? "Recolher" : "Ver detalhes e outros prazos"}
                className="relative flex shrink-0 items-center justify-center rounded-full p-1.5 text-white transition hover:bg-white/20 active:scale-90"
              >
                {aberto ? (
                  <ChevronDown size={16} aria-hidden />
                ) : (
                  <ChevronUp size={16} aria-hidden />
                )}
                {!aberto && outras.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold text-marca-azulEscuro">
                    {outras.length}
                  </span>
                )}
              </button>

              {/* Tirar da tela (o prazo continua na lista, em Horas) */}
              <button
                type="button"
                onClick={() => fixar(null)}
                aria-label="Tirar este prazo da tela"
                title="Tirar da tela (continua salvo em Horas)"
                className="flex shrink-0 items-center justify-center rounded-full bg-white/25 p-1.5 transition hover:bg-white/35 active:scale-90"
              >
                <X size={14} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>

      {modalAberto && (
        <ModalContagem
          contagem={modalAberto === "editar" ? contagemFixada : undefined}
          onFechar={() => setModalAberto(null)}
        />
      )}
    </>
  );
}
