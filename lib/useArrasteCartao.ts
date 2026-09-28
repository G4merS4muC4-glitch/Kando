"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from "react";

/**
 * Arraste com inercia dos cards flutuantes (timer e contagem regressiva).
 *
 * O card INTEIRO e arrastavel (qualquer ponto, inclusive a caixa de texto):
 * arrastar = pressionar e mover; o card segue o cursor com inercia e inclina
 * para o lado conforme a direcao/forca do arraste, voltando ao lugar ao soltar.
 * Clique simples so age nos botoes; um clique num campo o foca (ai a selecao de
 * texto funciona normalmente). A posicao fica guardada no aparelho.
 */

export const MARGEM_CARTAO = 8; // folga das bordas da tela
export const ALTURA_PILULA = 44; // altura aproximada da pilula (para medir o espaco)
const ALTURA_BARRA = 72; // barra de navegacao inferior do mobile (~56 + safe area)
const LIMIAR_ARRASTE = 5; // px de movimento para virar arraste (e nao clique)

export interface Pos {
  x: number;
  y: number;
}

/**
 * Quanto reservar no rodape: a barra de navegacao inferior some no breakpoint
 * "espacoso" (desktop). Abaixo dele (celular), reservamos a altura dela para o
 * card nao parar em cima dos botoes de navegacao.
 */
export function reservaInferior(): number {
  if (typeof window === "undefined") return 0;
  const espacoso = window.matchMedia("(min-width: 640px) and (min-height: 500px)").matches;
  return espacoso ? 0 : ALTURA_BARRA;
}

export interface OpcoesArraste {
  chave: string; // localStorage: posicao deste card, por aparelho
  padrao: CSSProperties; // posicao inicial (ex.: { right: 16, bottom: 96 })
  larguraEstimada?: number; // usada antes de o card medir a si mesmo
  alturaEstimada?: number;
  // Valor que muda quando o card reaparece (ex.: o id do que ele mostra): faz a
  // posicao guardada ser reconferida contra a tela atual.
  revalidarEm?: string;
}

export interface ArrasteCartao {
  cartaoRef: RefObject<HTMLDivElement>; // container fixo (recebe a posicao)
  interiorRef: RefObject<HTMLDivElement>; // alvo da fisica (inclina/escala)
  montado: boolean; // ja rodou no cliente (evita erro de hidratacao)
  arrastando: boolean; // controla a sombra elevada
  pos: Pos | null; // null = ainda na posicao padrao
  estilo: CSSProperties; // aplique no container fixo
  aoPressionar: (e: PointerEvent<HTMLDivElement>) => void;
  aoClicarCaptura: (e: MouseEvent) => void;
  /**
   * Lado em que a abinha deve abrir: para cima quando ha mais espaco acima.
   * Congela durante o arraste, para nao pular de lado ao cruzar o meio da tela.
   */
  abrirParaCima: (topoPadrao: number) => boolean;
}

function lerPos(chave: string): Pos | null {
  if (typeof window === "undefined") return null;
  try {
    const cru = window.localStorage.getItem(chave);
    if (!cru) return null;
    const p = JSON.parse(cru) as Pos;
    if (typeof p?.x === "number" && typeof p?.y === "number") return p;
  } catch {
    // ignora posicao corrompida
  }
  return null;
}

export function useArrasteCartao(opcoes: OpcoesArraste): ArrasteCartao {
  const {
    chave,
    padrao,
    larguraEstimada = 288,
    alturaEstimada = ALTURA_PILULA,
    revalidarEm,
  } = opcoes;

  const [montado, setMontado] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const [viewport, setViewport] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const cartaoRef = useRef<HTMLDivElement>(null);
  const interiorRef = useRef<HTMLDivElement>(null);
  const arrastandoRef = useRef(false);
  const arrastouRef = useRef(false); // suprime o click logo apos um arraste
  const pressRef = useRef<{
    x0: number;
    y0: number;
    dx: number;
    dy: number;
    iniciou: boolean;
  } | null>(null);
  const alvoRef = useRef<Pos | null>(null); // para onde o cursor pede
  const segueRef = useRef<Pos | null>(null); // onde o card esta de fato (com inercia)
  const rafRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const paraCimaRef = useRef(true); // lado da abinha, congelado durante o arraste

  // Monta no cliente, restaura a posicao e acompanha o tamanho da tela.
  useEffect(() => {
    setMontado(true);
    setPos(lerPos(chave));
    const medir = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    medir();
    window.addEventListener("resize", medir);
    window.addEventListener("orientationchange", medir);
    return () => {
      window.removeEventListener("resize", medir);
      window.removeEventListener("orientationchange", medir);
    };
  }, [chave]);

  // Limpa listeners e animacao se o card sumir no meio de um arraste.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Mantem a posicao guardada dentro da tela ao aparecer ou ao redimensionar.
  // Durante o arraste nao roda (a fisica ja clampa), evitando reflow por frame.
  useEffect(() => {
    if (!montado || !pos || arrastandoRef.current) return;
    const el = cartaoRef.current;
    if (!el) return;
    const maxX = Math.max(MARGEM_CARTAO, window.innerWidth - el.offsetWidth - MARGEM_CARTAO);
    const maxY = Math.max(
      MARGEM_CARTAO,
      window.innerHeight - el.offsetHeight - reservaInferior() - MARGEM_CARTAO
    );
    const x = Math.min(Math.max(MARGEM_CARTAO, pos.x), maxX);
    const y = Math.min(Math.max(MARGEM_CARTAO, pos.y), maxY);
    if (x !== pos.x || y !== pos.y) setPos({ x, y });
  }, [montado, pos, viewport, revalidarEm]);

  // Limita a posicao a area visivel (reservando a barra inferior no mobile).
  function limitarPos(x: number, y: number): Pos {
    const el = cartaoRef.current;
    const w = el?.offsetWidth ?? larguraEstimada;
    const h = el?.offsetHeight ?? alturaEstimada;
    const maxX = Math.max(MARGEM_CARTAO, window.innerWidth - w - MARGEM_CARTAO);
    const maxY = Math.max(MARGEM_CARTAO, window.innerHeight - h - reservaInferior() - MARGEM_CARTAO);
    return {
      x: Math.min(Math.max(MARGEM_CARTAO, x), maxX),
      y: Math.min(Math.max(MARGEM_CARTAO, y), maxY),
    };
  }

  // Loop de fisica: o card persegue o alvo com inercia; a distancia que ele esta
  // atrasado vira a inclinacao (quanto mais rapido o arraste, mais ele balanca
  // para o lado). Para quando o card alcanca o alvo (fica reto).
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

  function aoMoverJanela(e: globalThis.PointerEvent) {
    const p = pressRef.current;
    if (!p) return;
    if (!p.iniciou) {
      if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < LIMIAR_ARRASTE) return;
      p.iniciou = true;
      arrastandoRef.current = true;
      setArrastando(true);
      // Nao abre teclado nem selecao no meio do arraste.
      const focado = document.activeElement;
      if (focado instanceof HTMLElement && cartaoRef.current?.contains(focado)) focado.blur();
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
        window.localStorage.setItem(chave, JSON.stringify(limite));
      } catch {
        // sem localStorage: a posicao apenas nao persiste
      }
    }
  }

  function aoPressionar(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    arrastouRef.current = false;
    const alvoEl = e.target as HTMLElement;
    // Campo ja focado: deixa a selecao/edicao de texto nativa (nao arrasta).
    const campo = alvoEl.closest("input, textarea");
    if (campo && document.activeElement === campo) return;
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
  function aoClicarCaptura(e: MouseEvent) {
    if (arrastouRef.current) {
      e.preventDefault();
      e.stopPropagation();
      arrastouRef.current = false;
    }
  }

  function abrirParaCima(topoPadrao: number): boolean {
    const vh = viewport.h || (typeof window !== "undefined" ? window.innerHeight : 800);
    const topo = pos ? pos.y : topoPadrao;
    const espacoAcima = topo - MARGEM_CARTAO;
    const espacoAbaixo = vh - (topo + alturaEstimada) - reservaInferior() - MARGEM_CARTAO;
    const live = espacoAcima >= espacoAbaixo;
    if (!arrastando) paraCimaRef.current = live;
    return arrastando ? paraCimaRef.current : live;
  }

  const estilo: CSSProperties = pos
    ? { left: pos.x, top: pos.y, touchAction: "none" }
    : { ...padrao, touchAction: "none" };

  return {
    cartaoRef,
    interiorRef,
    montado,
    arrastando,
    pos,
    estilo,
    aoPressionar,
    aoClicarCaptura,
    abrirParaCima,
  };
}
