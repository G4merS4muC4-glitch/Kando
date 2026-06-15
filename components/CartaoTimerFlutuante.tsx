"use client";

import { useEffect, useRef, useState } from "react";
import {
  Square,
  AlertTriangle,
  CornerDownLeft,
  ChevronUp,
  ChevronDown,
  Pause,
  Play,
} from "lucide-react";
import { useBoard } from "@/lib/store";
import { useApontamentos } from "@/lib/apontamentosProvider";
import { formatarRelogio, tempoTrabalhadoMs } from "@/lib/apontamentos";
import { ModalAjustarParada } from "./apontamentos/IndicadorTimerTopo";

const LIMITE_LONGO_MS = 8 * 3_600_000; // acima disso, sugere ajustar o termino
const POS_KEY = "kando:timer-pos"; // posicao do card, por aparelho
const MARGEM = 8; // folga das bordas da tela
const ALTURA_PILULA = 44; // altura aproximada da pilula (para medir o espaco)
const ALTURA_BARRA = 72; // barra de navegacao inferior do mobile (~56 + safe area)
const LIMIAR_ARRASTE = 5; // px de movimento para virar arraste (e nao clique)

type Pos = { x: number; y: number };

function lerPos(): Pos | null {
  if (typeof window === "undefined") return null;
  try {
    const cru = window.localStorage.getItem(POS_KEY);
    if (!cru) return null;
    const p = JSON.parse(cru) as Pos;
    if (typeof p?.x === "number" && typeof p?.y === "number") return p;
  } catch {
    // ignora posicao corrompida
  }
  return null;
}

/**
 * Quanto reservar no rodape: a barra de navegacao inferior some no breakpoint
 * "espacoso" (desktop). Abaixo dele (celular), reservamos a altura dela para o
 * card nao parar em cima dos botoes de navegacao.
 */
function reservaInferior(): number {
  if (typeof window === "undefined") return 0;
  const espacoso = window.matchMedia("(min-width: 640px) and (min-height: 500px)").matches;
  return espacoso ? 0 : ALTURA_BARRA;
}

/**
 * Nome do projeto que desliza do inicio ao fim e volta, em loop, quando nao
 * cabe na largura disponivel. Se o aparelho pede menos movimento, fica parado
 * com reticencias (sem cortar no meio da palavra).
 */
function TituloRolante({ texto }: { texto: string }) {
  const contRef = useRef<HTMLDivElement>(null);
  const txtRef = useRef<HTMLSpanElement>(null);
  const [desloc, setDesloc] = useState(0);
  const [reduzido, setReduzido] = useState(false);

  useEffect(() => {
    const medir = () => {
      const c = contRef.current;
      const t = txtRef.current;
      if (!c || !t) return;
      const over = t.scrollWidth - c.clientWidth;
      setDesloc(over > 4 ? over : 0);
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [texto]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const aplicar = () => setReduzido(mq.matches);
    aplicar();
    mq.addEventListener?.("change", aplicar);
    return () => mq.removeEventListener?.("change", aplicar);
  }, []);

  const animar = desloc > 0 && !reduzido;
  // ~28px/s de leitura, ida e volta, com folga para as pausas em cada ponta.
  const dur = Math.max(7, Math.round((desloc / 28) * 2) + 4);

  return (
    <div ref={contRef} className="pointer-events-none min-w-0 flex-1 overflow-hidden">
      <span
        ref={txtRef}
        title={texto}
        className={`text-sm font-semibold ${
          animar ? "inline-block whitespace-nowrap tp-nome-rolante" : "block truncate"
        }`}
        style={
          animar
            ? ({
                "--tp-nome-desloc": `-${desloc}px`,
                "--tp-nome-dur": `${dur}s`,
              } as React.CSSProperties)
            : undefined
        }
      >
        {texto}
      </span>
    </div>
  );
}

/**
 * Card de tempo flutuante (desktop e mobile). Aparece so quando ha um timer
 * rodando, no lugar da pilula do topo e da faixa do mobile. E feito em vidro
 * liquido (translucido, borda em gradiente, reflexo no topo e sombra dupla),
 * laranja na pilula e claro no card de anotacoes.
 *
 * Interacao: o card INTEIRO e arrastavel (qualquer ponto, inclusive a caixa de
 * texto). Arrastar = pressionar e mover; o card segue o cursor com inercia e
 * inclina para o lado conforme a direcao/forca do arraste (volta ao lugar ao
 * soltar). Clique simples so age nos botoes; um clique no campo o foca (ai a
 * selecao de texto funciona normalmente). A posicao fica guardada no aparelho.
 */
export default function CartaoTimerFlutuante() {
  const { timerAtivo, pararTimer, alternarPausa, adicionarCheckpoint } = useApontamentos();
  const { cardPorId } = useBoard();

  const [montado, setMontado] = useState(false);
  const [agoraMs, setAgoraMs] = useState(() => (typeof window !== "undefined" ? Date.now() : 0));
  const [aberto, setAberto] = useState(true); // ja inicia aberto; da para recolher
  const [rascunho, setRascunho] = useState("");
  const [ajustarAberto, setAjustarAberto] = useState(false);
  const [arrastando, setArrastando] = useState(false); // controla a sombra elevada
  const [pos, setPos] = useState<Pos | null>(null);
  const [viewport, setViewport] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const cartaoRef = useRef<HTMLDivElement>(null);
  const interiorRef = useRef<HTMLDivElement>(null); // alvo da fisica (inclina/escala)
  const inputRef = useRef<HTMLInputElement>(null);
  const arrastandoRef = useRef(false);
  const arrastouRef = useRef(false); // suprime o click logo apos um arraste
  const pressRef = useRef<{ x0: number; y0: number; dx: number; dy: number; iniciou: boolean } | null>(
    null
  );
  const alvoRef = useRef<Pos | null>(null); // para onde o cursor pede
  const segueRef = useRef<Pos | null>(null); // onde o card esta de fato (com inercia)
  const rafRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const paraCimaRef = useRef(true); // lado da abinha, congelado durante o arraste

  // Monta no cliente, restaura a posicao e acompanha o tamanho da tela.
  useEffect(() => {
    setMontado(true);
    setPos(lerPos());
    const medir = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    medir();
    window.addEventListener("resize", medir);
    window.addEventListener("orientationchange", medir);
    return () => {
      window.removeEventListener("resize", medir);
      window.removeEventListener("orientationchange", medir);
    };
  }, []);

  // Limpa listeners e animacao se o card sumir no meio de um arraste.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Relogio por segundo enquanto roda (so para exibir; o tempo real e por
  // diferenca). Depende da identidade do timer, nao do objeto.
  const rodando = Boolean(timerAtivo);
  const inicio = timerAtivo?.inicio;
  useEffect(() => {
    if (!rodando) return;
    setAgoraMs(Date.now());
    const id = window.setInterval(() => setAgoraMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [rodando, inicio]);

  // Mantem a posicao guardada dentro da tela ao aparecer ou ao redimensionar.
  // Durante o arraste nao roda (a fisica ja clampa), evitando reflow por frame.
  useEffect(() => {
    if (!montado || !pos || arrastandoRef.current) return;
    const el = cartaoRef.current;
    if (!el) return;
    const maxX = Math.max(MARGEM, window.innerWidth - el.offsetWidth - MARGEM);
    const maxY = Math.max(MARGEM, window.innerHeight - el.offsetHeight - reservaInferior() - MARGEM);
    const x = Math.min(Math.max(MARGEM, pos.x), maxX);
    const y = Math.min(Math.max(MARGEM, pos.y), maxY);
    if (x !== pos.x || y !== pos.y) setPos({ x, y });
  }, [montado, pos, viewport, inicio]);

  // Limita a posicao a area visivel (reservando a barra inferior no mobile).
  function limitarPos(x: number, y: number): Pos {
    const el = cartaoRef.current;
    const w = el?.offsetWidth ?? 288;
    const h = el?.offsetHeight ?? ALTURA_PILULA;
    const maxX = Math.max(MARGEM, window.innerWidth - w - MARGEM);
    const maxY = Math.max(MARGEM, window.innerHeight - h - reservaInferior() - MARGEM);
    return { x: Math.min(Math.max(MARGEM, x), maxX), y: Math.min(Math.max(MARGEM, y), maxY) };
  }

  // Loop de fisica: o card persegue o alvo com inercia; a distancia que ele
  // esta "atrasado" vira a inclinacao (quanto mais rapido o arraste, mais ele
  // balanca para o lado). Para quando o card alcanca o alvo (fica reto).
  function loopFisica() {
    const alvo = alvoRef.current;
    const segue = segueRef.current;
    if (!alvo || !segue) return;
    segue.x += (alvo.x - segue.x) * 0.22;
    segue.y += (alvo.y - segue.y) * 0.22;
    const dx = alvo.x - segue.x;
    const dy = alvo.y - segue.y;
    setPos({ x: segue.x, y: segue.y });
    const ry = Math.max(-15, Math.min(15, dx * 0.45));
    const rx = Math.max(-15, Math.min(15, -dy * 0.45));
    if (interiorRef.current) {
      interiorRef.current.style.transform = `perspective(900px) rotateX(${rx.toFixed(
        2
      )}deg) rotateY(${ry.toFixed(2)}deg) scale(1.03)`;
    }
    rafRef.current = requestAnimationFrame(loopFisica);
  }

  function aoMoverJanela(e: PointerEvent) {
    const p = pressRef.current;
    if (!p) return;
    if (!p.iniciou) {
      if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < LIMIAR_ARRASTE) return;
      p.iniciou = true;
      arrastandoRef.current = true;
      setArrastando(true);
      inputRef.current?.blur(); // nao abre teclado/selecao no meio do arraste
      const r = cartaoRef.current?.getBoundingClientRect();
      const ini = r ? { x: r.left, y: r.top } : { x: 0, y: 0 };
      segueRef.current = { ...ini };
      alvoRef.current = { ...ini };
      if (interiorRef.current) interiorRef.current.style.transition = "none"; // responde na hora
      rafRef.current = requestAnimationFrame(loopFisica);
    }
    e.preventDefault(); // sem selecao de texto enquanto arrasta
    alvoRef.current = limitarPos(e.clientX - p.dx, e.clientY - p.dy);
  }

  function aoSoltarJanela() {
    const p = pressRef.current;
    pressRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    if (!p || !p.iniciou) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    arrastandoRef.current = false;
    setArrastando(false);
    arrastouRef.current = true; // o click que vem logo apos sera ignorado
    if (interiorRef.current) {
      interiorRef.current.style.transition = ""; // volta a transicao (assenta suave)
      interiorRef.current.style.transform = ""; // endireita
    }
    const finalPos = segueRef.current ?? alvoRef.current;
    if (finalPos) {
      const limite = limitarPos(finalPos.x, finalPos.y);
      setPos(limite);
      try {
        window.localStorage.setItem(POS_KEY, JSON.stringify(limite));
      } catch {
        // sem localStorage: a posicao apenas nao persiste
      }
    }
  }

  function aoPressionar(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    arrastouRef.current = false;
    const alvoEl = e.target as HTMLElement;
    // Campo ja focado: deixa a selecao/edicao de texto nativa (nao arrasta).
    if (alvoEl.closest("input") && inputRef.current && document.activeElement === inputRef.current) {
      return;
    }
    const el = cartaoRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    pressRef.current = {
      x0: e.clientX,
      y0: e.clientY,
      dx: e.clientX - r.left,
      dy: e.clientY - r.top,
      iniciou: false,
    };
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    window.addEventListener("pointermove", aoMoverJanela, { signal: ac.signal });
    window.addEventListener("pointerup", aoSoltarJanela, { signal: ac.signal });
    window.addEventListener("pointercancel", aoSoltarJanela, { signal: ac.signal });
  }

  // Depois de um arraste, o navegador dispara um "click" residual: ignoramos
  // para nao acionar botao sem querer.
  function aoClicarCaptura(e: React.MouseEvent) {
    if (arrastouRef.current) {
      e.preventDefault();
      e.stopPropagation();
      arrastouRef.current = false;
    }
  }

  function enviarCheckpoint() {
    const txt = rascunho.trim();
    if (!txt) return;
    adicionarCheckpoint(txt);
    setRascunho("");
  }

  if (!montado || !timerAtivo) return null;

  const card = cardPorId(timerAtivo.cardId);
  const titulo = card?.titulo || "Card removido";
  const pausado = Boolean(timerAtivo.pausadoEm);
  const ms = tempoTrabalhadoMs(timerAtivo, agoraMs);
  const longo = ms > LIMITE_LONGO_MS;
  const checkpoints = timerAtivo.checkpoints ?? [];
  const pausaTotalMs =
    (timerAtivo.pausaMs ?? 0) +
    (timerAtivo.pausadoEm ? Math.max(0, agoraMs - new Date(timerAtivo.pausadoEm).getTime()) : 0);

  function aoParar() {
    if (longo) setAjustarAberto(true);
    else pararTimer();
  }

  // Posicao: canto inferior direito por padrao; left/top depois de arrastar.
  const estilo: React.CSSProperties = pos
    ? { left: pos.x, top: pos.y, touchAction: "none" }
    : { right: 16, bottom: 96, touchAction: "none" };

  // Abre a abinha para o lado com mais espaco (para cima quando esta embaixo).
  const vh = viewport.h || (typeof window !== "undefined" ? window.innerHeight : 800);
  const topoPilula = pos ? pos.y : vh - 96 - ALTURA_PILULA;
  const espacoAcima = topoPilula - MARGEM;
  const espacoAbaixo = vh - (topoPilula + ALTURA_PILULA) - reservaInferior() - MARGEM;
  // Congela o lado da abinha durante o arraste, para nao pular de lado ao cruzar
  // o meio da tela (so recalcula quando nao esta arrastando).
  const paraCimaLive = espacoAcima >= espacoAbaixo;
  if (!arrastando) paraCimaRef.current = paraCimaLive;
  const paraCima = arrastando ? paraCimaRef.current : paraCimaLive;

  const Painel = (
    <div
      className={`absolute left-0 right-0 ${
        paraCima ? "bottom-full mb-2" : "top-full mt-2"
      } tp-glass tp-glass-claro ${arrastando ? "tp-glass-elevado" : ""} animate-fadeIn`}
    >
      <div className="relative z-10 flex items-center gap-2 p-3">
        <input
          ref={inputRef}
          type="text"
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              enviarCheckpoint();
            }
          }}
          placeholder="O que você está fazendo agora?"
          aria-label="Anotar um checkpoint"
          className="min-w-0 flex-1 cursor-text select-text rounded-marca border border-marca-cinza/40 bg-white/90 px-2.5 py-1.5 text-sm text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
        />
        <button
          type="button"
          onClick={enviarCheckpoint}
          disabled={rascunho.trim() === ""}
          aria-label="Marcar checkpoint"
          title="Marcar checkpoint (Enter)"
          className="flex shrink-0 items-center justify-center rounded-full bg-marca-laranja p-2 text-white transition hover:brightness-95 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CornerDownLeft size={16} aria-hidden />
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div
        ref={cartaoRef}
        style={estilo}
        onPointerDown={aoPressionar}
        onClickCapture={aoClicarCaptura}
        className="fixed z-40 w-72 max-w-[calc(100vw-1rem)] cursor-grab select-none active:cursor-grabbing"
      >
        <div
          ref={interiorRef}
          className="relative transition-[transform] duration-200 ease-suave will-change-transform"
        >
          {aberto && Painel}

          <div
            className={`tp-glass tp-glass-laranja ${pausado ? "tp-glass-pausado" : ""} ${
              arrastando ? "tp-glass-elevado" : ""
            }`}
          >
            <div
              style={{ textShadow: "0 1px 3px rgba(0,0,0,0.35)" }}
              className="relative z-10 flex items-center gap-1.5 px-3 py-1.5 text-white"
            >
              <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                {!pausado && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full bg-white ${
                    pausado ? "opacity-60" : ""
                  }`}
                />
              </span>
              <TituloRolante texto={titulo} />
              <span className="shrink-0 font-mono text-sm font-bold tabular-nums">
                {formatarRelogio(ms)}
              </span>
              {longo && (
                <AlertTriangle
                  size={14}
                  className="shrink-0 text-white"
                  aria-label="Timer rodando há muito tempo"
                />
              )}

              {/* Pausar / retomar */}
              <button
                type="button"
                onClick={alternarPausa}
                aria-label={pausado ? "Retomar timer" : "Pausar timer"}
                title={pausado ? "Retomar" : "Pausar"}
                className="flex shrink-0 items-center justify-center rounded-full p-1.5 text-white transition hover:bg-white/20 active:scale-90"
              >
                {pausado ? (
                  <Play size={16} fill="currentColor" aria-hidden />
                ) : (
                  <Pause size={16} fill="currentColor" aria-hidden />
                )}
              </button>

              {/* Abrir/fechar a abinha de checkpoints */}
              <button
                type="button"
                onClick={() => setAberto((v) => !v)}
                aria-label={aberto ? "Recolher anotações" : "Abrir anotações"}
                aria-expanded={aberto}
                title={aberto ? "Recolher anotações" : "Abrir anotações"}
                className="relative flex shrink-0 items-center justify-center rounded-full p-1.5 text-white transition hover:bg-white/20 active:scale-90"
              >
                {aberto ? (
                  <ChevronDown size={16} aria-hidden />
                ) : (
                  <ChevronUp size={16} aria-hidden />
                )}
                {!aberto && checkpoints.length > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold text-marca-laranja">
                    {checkpoints.length}
                  </span>
                )}
              </button>

              {/* Parar */}
              <button
                type="button"
                onClick={aoParar}
                aria-label="Parar timer"
                title="Parar timer"
                className="flex shrink-0 items-center gap-1 rounded-full bg-white/25 px-3 py-1.5 text-xs font-bold transition hover:bg-white/35 active:scale-90"
              >
                <Square size={13} fill="currentColor" aria-hidden />
                <span className="hidden sm:inline">Parar</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {ajustarAberto && (
        <ModalAjustarParada
          inicioISO={timerAtivo.inicio}
          tituloCard={titulo}
          pausaMs={pausaTotalMs}
          onFechar={() => setAjustarAberto(false)}
        />
      )}
    </>
  );
}
