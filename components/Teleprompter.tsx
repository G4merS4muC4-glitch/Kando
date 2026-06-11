"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Minus,
  Plus,
  Rabbit,
  Turtle,
  FlipHorizontal,
  Type,
  SkipBack,
  SkipForward,
  Radio,
} from "lucide-react";
import { useControleTeleprompter, type ControleTeleprompter } from "@/lib/teleprompterAoVivo";

/**
 * Teleprompter em tela cheia para o roteiro.
 * Texto grande e legivel, auto-scroll com velocidade ajustavel, tamanho de
 * fonte e modo espelhado para o vidro. Quando recebe um `cardId`, ganha um
 * controle remoto AO VIVO compartilhado: play/pause, velocidade, fonte e posicao
 * sincronizam entre todas as telas abertas do mesmo card (aba principal e link
 * publico), nos dois sentidos. Qualquer tela controla; todas obedecem.
 */
export default function Teleprompter({
  texto,
  onFechar,
  cardId = null,
}: {
  texto: string;
  onFechar: () => void;
  cardId?: string | null;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const [tocando, setTocando] = useState(false);
  // Fonte menor por padrao no celular (cabe mais palavra por linha).
  const [tamanho, setTamanho] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 640 ? 30 : 44
  );
  const [velocidade, setVelocidade] = useState(1.4); // px por quadro
  // Espelho para o vidro do teleprompter (local: cada tela escolhe o seu).
  const [espelhoH, setEspelhoH] = useState(false);
  // Token que dispara a aplicacao de um salto de posicao recebido (apos o render).
  const [saltoToken, setSaltoToken] = useState(0);

  // Espelhos do estado para montar o snapshot de controle sem closure velha.
  const tocandoRef = useRef(tocando);
  const velocidadeRef = useRef(velocidade);
  const tamanhoRef = useRef(tamanho);
  const pctPendenteRef = useRef(0);

  /** Posicao relativa atual (0..1), tolerante a telas de tamanhos diferentes. */
  const pctAtual = useCallback((): number => {
    const el = areaRef.current;
    if (!el) return 0;
    const max = Math.max(1, el.scrollHeight - el.clientHeight);
    return Math.min(1, Math.max(0, el.scrollTop / max));
  }, []);

  /** Pula para uma posicao relativa (0..1). */
  const aplicarPct = useCallback((pct: number) => {
    const el = areaRef.current;
    if (!el) return;
    const max = Math.max(0, el.scrollHeight - el.clientHeight);
    el.scrollTop = pct * max;
  }, []);

  // Recebe controle de outra tela: aplica estado e, em comando de posicao, salta.
  const aoReceberControle = useCallback((c: ControleTeleprompter) => {
    tocandoRef.current = c.tocando;
    setTocando(c.tocando);
    velocidadeRef.current = c.velocidade;
    setVelocidade(c.velocidade);
    tamanhoRef.current = c.tamanho;
    setTamanho(c.tamanho);
    if (c.saltar) {
      pctPendenteRef.current = c.posicaoPct;
      setSaltoToken((t) => t + 1); // aplica depois do render (fonte ja atualizada)
    }
  }, []);

  const { enviarControle, ativo } = useControleTeleprompter(cardId, aoReceberControle);

  /** Difunde o estado atual (play/pause/velocidade/fonte) para as outras telas. */
  const transmitir = useCallback(
    (extra: Partial<ControleTeleprompter>) => {
      enviarControle({
        tocando: tocandoRef.current,
        velocidade: velocidadeRef.current,
        tamanho: tamanhoRef.current,
        posicaoPct: pctAtual(),
        saltar: false,
        ...extra,
      });
    },
    [enviarControle, pctAtual]
  );

  // Aplica um salto de posicao recebido (apos o render que ja ajustou a fonte).
  useEffect(() => {
    if (saltoToken === 0) return;
    aplicarPct(pctPendenteRef.current);
  }, [saltoToken, aplicarPct]);

  // ----- Acoes locais (atualizam o estado E difundem) -----
  const definirTocando = useCallback(
    (v: boolean) => {
      tocandoRef.current = v;
      setTocando(v);
      transmitir({});
    },
    [transmitir]
  );

  const alternarTocando = useCallback(() => definirTocando(!tocandoRef.current), [definirTocando]);

  const mudarVelocidade = useCallback(
    (v: number) => {
      const nv = Math.min(6, Math.max(0.4, +v.toFixed(1)));
      velocidadeRef.current = nv;
      setVelocidade(nv);
      transmitir({});
    },
    [transmitir]
  );

  const mudarTamanho = useCallback(
    (t: number) => {
      const nt = Math.min(100, Math.max(20, t));
      tamanhoRef.current = nt;
      setTamanho(nt);
      transmitir({});
    },
    [transmitir]
  );

  const reiniciar = useCallback(() => {
    aplicarPct(0);
    tocandoRef.current = false;
    setTocando(false);
    transmitir({ posicaoPct: 0, saltar: true });
  }, [aplicarPct, transmitir]);

  /** Avanca (dir +1) ou volta (dir -1) cerca de meia tela, e leva as outras telas junto. */
  const pular = useCallback(
    (dir: number) => {
      const el = areaRef.current;
      if (!el) return;
      const max = Math.max(1, el.scrollHeight - el.clientHeight);
      const novo = Math.min(1, Math.max(0, (el.scrollTop + dir * el.clientHeight * 0.45) / max));
      el.scrollTop = novo * max;
      transmitir({ posicaoPct: novo, saltar: true });
    },
    [transmitir]
  );

  /** Alinha todas as telas a posicao desta. */
  const sincronizar = useCallback(() => {
    transmitir({ posicaoPct: pctAtual(), saltar: true });
  }, [transmitir, pctAtual]);

  // Fecha com Esc (em captura, para nao fechar tambem o modal por baixo).
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        e.preventDefault();
        onFechar();
      }
    }
    window.addEventListener("keydown", aoTeclar, true);
    return () => window.removeEventListener("keydown", aoTeclar, true);
  }, [onFechar]);

  // Bloqueia o scroll do corpo enquanto o teleprompter esta aberto.
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  // Loop de auto-scroll (cada tela rola sozinha; a velocidade e compartilhada).
  useEffect(() => {
    if (!tocando) return;
    let raf = 0;
    const passo = () => {
      const el = areaRef.current;
      if (el) {
        el.scrollTop += velocidade;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
          tocandoRef.current = false;
          setTocando(false);
          return;
        }
      }
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [tocando, velocidade]);

  const botaoIcone =
    "rounded-marca bg-white/10 p-2 text-white transition hover:bg-white/20 active:bg-white/30";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0b0d12] text-white animate-fadeIn">
      {/* Barra de controles (compacta e com quebra de linha no celular) */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2 sm:px-5 sm:py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={alternarTocando}
            className="flex items-center gap-2 rounded-marca bg-marca-laranja px-4 py-2 text-sm font-bold text-white transition hover:brightness-95"
          >
            {tocando ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
            {tocando ? "Pausar" : "Rolar"}
          </button>
          {/* Voltar / avancar (leva as outras telas junto) */}
          <button type="button" onClick={() => pular(-1)} title="Voltar um trecho" className={botaoIcone} aria-label="Voltar um trecho">
            <SkipBack size={16} aria-hidden />
          </button>
          <button type="button" onClick={() => pular(1)} title="Avançar um trecho" className={botaoIcone} aria-label="Avançar um trecho">
            <SkipForward size={16} aria-hidden />
          </button>
          <button type="button" onClick={reiniciar} title="Reiniciar do topo" className={botaoIcone}>
            <RotateCcw size={16} aria-hidden />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-3">
          {/* Indicador + sincronizar (so quando o controle ao vivo esta ligado) */}
          {ativo && (
            <button
              type="button"
              onClick={sincronizar}
              title="Sincronizar as outras telas com esta posição"
              className="flex items-center gap-1.5 rounded-marca bg-white/10 px-2.5 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              <Radio size={15} className="text-marca-verde" aria-hidden />
              <span className="hidden sm:inline">Sincronizar</span>
            </button>
          )}

          {/* Velocidade */}
          <div className="flex items-center gap-1">
            <Turtle size={16} aria-hidden className="hidden text-white/60 sm:block" />
            <button
              type="button"
              onClick={() => mudarVelocidade(velocidade - 0.4)}
              className={botaoIcone}
              aria-label="Diminuir velocidade"
            >
              <Minus size={14} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => mudarVelocidade(velocidade + 0.4)}
              className={botaoIcone}
              aria-label="Aumentar velocidade"
            >
              <Plus size={14} aria-hidden />
            </button>
            <Rabbit size={16} aria-hidden className="hidden text-white/60 sm:block" />
          </div>

          {/* Tamanho da fonte */}
          <div className="flex items-center gap-1">
            <Type size={15} aria-hidden className="text-white/60" />
            <button
              type="button"
              onClick={() => mudarTamanho(tamanho - 4)}
              className={botaoIcone}
              aria-label="Diminuir fonte"
            >
              <Minus size={14} aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => mudarTamanho(tamanho + 4)}
              className={botaoIcone}
              aria-label="Aumentar fonte"
            >
              <Plus size={14} aria-hidden />
            </button>
          </div>

          {/* Espelho para o vidro do teleprompter (local; nao sincroniza) */}
          <button
            type="button"
            onClick={() => setEspelhoH((e) => !e)}
            aria-pressed={espelhoH}
            title="Espelho para o vidro do teleprompter: no vidro o texto le normal, do começo ao fim"
            className={`flex items-center gap-1.5 rounded-marca px-2.5 py-2 text-sm font-semibold transition ${
              espelhoH ? "bg-marca-laranja text-white" : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <FlipHorizontal size={16} aria-hidden />
            <span className="hidden sm:inline">Espelho</span>
          </button>

          <button
            type="button"
            onClick={onFechar}
            className="flex items-center gap-1.5 rounded-marca bg-white/10 px-3 py-2 text-sm font-semibold transition hover:bg-white/20"
          >
            <X size={16} aria-hidden />
            <span className="hidden sm:inline">Fechar</span>
          </button>
        </div>
      </div>

      {/* Texto do roteiro. Tocar na area rola/pausa (pratico no celular). */}
      <div
        ref={areaRef}
        onClick={alternarTocando}
        className="flex-1 cursor-pointer overflow-y-auto overscroll-contain px-5 py-12 sm:px-16 sm:py-16"
      >
        <div className="mx-auto max-w-4xl" style={{ transform: `scaleX(${espelhoH ? -1 : 1})` }}>
          <p
            className="whitespace-pre-wrap text-center font-semibold"
            style={{ fontSize: `${tamanho}px`, lineHeight: 1.5 }}
          >
            {texto.trim() || "Sem roteiro para exibir."}
          </p>
          {/* Espaco extra ao final para o texto poder rolar ate sair da tela. */}
          <div className="h-[60vh]" aria-hidden />
        </div>
      </div>

      {/* Dicas discretas */}
      <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-center">
        {espelhoH && (
          <p className="rounded-marca bg-white/10 px-3 py-1 text-[11px] font-medium text-white/75">
            Espelho para o vidro: as letras saem invertidas aqui, mas no vidro o texto lê normal, do
            começo ao fim.
          </p>
        )}
        {ativo ? (
          <p className="flex items-center gap-1 text-[11px] text-white/45">
            <Radio size={11} className="text-marca-verde" aria-hidden /> Controle ao vivo: play, velocidade e posição valem para todas as telas
          </p>
        ) : (
          <p className="text-[11px] text-white/40">Toque na tela para rolar ou pausar</p>
        )}
      </div>
    </div>
  );
}
