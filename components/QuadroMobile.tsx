"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Maximize2, CheckCircle2, RotateCcw, Timer, ArrowRight, Hand } from "lucide-react";
import { useBoard } from "@/lib/store";
import { useApontamentos } from "@/lib/apontamentosProvider";
import { usePressaoLonga } from "@/lib/usePressaoLonga";
import type { CardConteudo, Etapa } from "@/lib/types";
import { CardVisual } from "./Card";
import FolhaInferior from "./FolhaInferior";

const DICA_KEY = "kando:dica-segurar-card"; // a dica de "segure o card" some depois de usada

/**
 * Quadro no celular. As etapas viram abas (pilulas com o contador) e cada etapa e
 * uma pagina inteira, lado a lado, que se troca deslizando o dedo: e a rolagem com
 * encaixe do proprio navegador, entao e fluida e com inercia. Os cards ficam a
 * vista (nada de gaveta fechada). Tocar no card abre; segurar abre as acoes
 * rapidas (mover de etapa, postado, timer), no lugar do arrastar do desktop.
 */
export default function QuadroMobile({
  cards,
  onAbrir,
  onNovo,
}: {
  cards: CardConteudo[]; // ja filtrados pela busca e filtros
  onAbrir: (id: string) => void;
  onNovo: (etapa: Etapa) => void;
}) {
  const { etapas, etapaPostado } = useBoard();
  const trilhoRef = useRef<HTMLDivElement>(null);
  const abasRef = useRef<HTMLDivElement>(null);
  const [ativa, setAtiva] = useState(0);
  const [acoesId, setAcoesId] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; etapa: number } | null>(null);
  const [mostrarDica, setMostrarDica] = useState(false);
  const avisoTimer = useRef<number | null>(null);
  const posicionou = useRef(false);

  const porEtapa = useMemo(() => {
    const mapa = new Map<Etapa, CardConteudo[]>();
    etapas.forEach((e) => mapa.set(e.id, []));
    const primeira = etapas[0]?.id;
    cards.forEach((c) => (mapa.get(c.etapa) ?? mapa.get(primeira))?.push(c));
    return mapa;
  }, [cards, etapas]);

  // Abre na primeira etapa com conteudo que ainda nao foi publicado (onde esta o
  // trabalho), sem animar. So na primeira vez: depois, a pessoa navega.
  useEffect(() => {
    if (posicionou.current || etapas.length === 0) return;
    posicionou.current = true;
    const i = etapas.findIndex((e) => e.id !== etapaPostado.id && (porEtapa.get(e.id)?.length ?? 0) > 0);
    const alvo = i >= 0 ? i : 0;
    setAtiva(alvo);
    const trilho = trilhoRef.current;
    if (trilho) trilho.scrollLeft = alvo * trilho.clientWidth;
  }, [etapas, porEtapa, etapaPostado.id]);

  useEffect(() => {
    try {
      setMostrarDica(window.localStorage.getItem(DICA_KEY) !== "1");
    } catch {
      setMostrarDica(false);
    }
    return () => {
      if (avisoTimer.current) window.clearTimeout(avisoTimer.current);
    };
  }, []);

  // A aba ativa acompanha o dedo (a pagina mais visivel) e fica sempre a vista.
  function aoRolar() {
    const t = trilhoRef.current;
    if (!t || t.clientWidth === 0) return;
    const i = Math.round(t.scrollLeft / t.clientWidth);
    if (i !== ativa) setAtiva(i);
  }
  useEffect(() => {
    const aba = abasRef.current?.children[ativa] as HTMLElement | undefined;
    aba?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [ativa]);

  function irPara(i: number) {
    const t = trilhoRef.current;
    if (!t) return;
    t.scrollTo({ left: i * t.clientWidth, behavior: "smooth" });
  }

  function avisar(texto: string, etapa: number) {
    setAviso({ texto, etapa });
    if (avisoTimer.current) window.clearTimeout(avisoTimer.current);
    avisoTimer.current = window.setTimeout(() => setAviso(null), 3200);
  }

  function abrirAcoes(id: string) {
    setAcoesId(id);
    if (mostrarDica) {
      setMostrarDica(false);
      try {
        window.localStorage.setItem(DICA_KEY, "1");
      } catch {
        // sem localStorage: a dica so volta a aparecer
      }
    }
  }

  const cardAcoes = acoesId ? cards.find((c) => c.id === acoesId) : undefined;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Abas das etapas: tocar leva direto; deslizar o quadro tambem troca */}
      <div
        ref={abasRef}
        role="tablist"
        aria-label="Etapas do quadro"
        className="sem-barra flex shrink-0 gap-1.5 overflow-x-auto border-b border-marca-cinza/20 bg-white px-3 py-2"
      >
        {etapas.map((e, i) => {
          const qtd = porEtapa.get(e.id)?.length ?? 0;
          const sel = i === ativa;
          const postado = e.id === etapaPostado.id;
          return (
            <button
              key={e.id}
              type="button"
              role="tab"
              aria-selected={sel}
              onClick={() => irPara(i)}
              className={`pressionavel flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold transition-colors duration-200 ${
                sel
                  ? postado
                    ? "bg-marca-verde text-white shadow-card"
                    : "bg-marca-azulEscuro text-white shadow-card"
                  : qtd > 0
                    ? "bg-marca-branco text-marca-azulEscuro"
                    : "bg-marca-branco text-marca-cinza/70"
              }`}
            >
              <span className="whitespace-nowrap">{e.titulo}</span>
              <span
                className={`min-w-[1.25rem] rounded-full px-1.5 text-center text-[11px] leading-5 ${
                  sel ? "bg-white/20 text-white" : qtd > 0 ? "bg-marca-laranja text-white" : "bg-marca-cinza/15"
                }`}
              >
                {qtd}
              </span>
            </button>
          );
        })}
      </div>

      {/* Paginas lado a lado (uma por etapa), com encaixe */}
      <div
        ref={trilhoRef}
        onScroll={aoRolar}
        className="sem-barra flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain"
      >
        {etapas.map((e, i) => {
          const lista = porEtapa.get(e.id) ?? [];
          return (
            <section
              key={e.id}
              aria-label={e.titulo}
              // So contem a rolagem VERTICAL: o deslize lateral tem que chegar ao
              // trilho para trocar de etapa (overscroll-contain travaria os dois eixos).
              className="h-full w-full shrink-0 snap-start snap-always overflow-y-auto overscroll-y-contain px-3 pb-28 pt-3"
            >
              {e.descricao && <p className="mb-2 px-1 text-xs text-marca-cinza">{e.descricao}</p>}

              {mostrarDica && lista.length > 0 && i === ativa && (
                <p className="mb-2 flex items-center gap-1.5 rounded-full bg-marca-azulEscuro/5 px-3 py-1.5 text-[11px] font-semibold text-marca-azulEscuro animate-fadeIn">
                  <Hand size={13} aria-hidden /> Segure um card para mover de etapa, postar ou iniciar o timer
                </p>
              )}

              <div className="flex flex-col gap-2.5">
                {lista.map((card) => (
                  <CardSeguravel key={card.id} card={card} onAbrir={onAbrir} onSegurar={abrirAcoes} />
                ))}
              </div>

              {lista.length === 0 ? (
                <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-marca-branco text-marca-cinza">
                    <Plus size={24} aria-hidden />
                  </span>
                  <p className="text-sm text-marca-cinza">
                    Nada em <strong className="text-marca-azulEscuro">{e.titulo}</strong> por enquanto.
                  </p>
                  <button
                    type="button"
                    onClick={() => onNovo(e.id)}
                    className="pressionavel rounded-full bg-marca-laranja px-5 py-2.5 text-sm font-bold text-white shadow-card"
                  >
                    Criar conteúdo aqui
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onNovo(e.id)}
                  className="pressionavel mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-marca-cinza/30 px-3 py-3.5 text-sm font-semibold text-marca-cinza"
                >
                  <Plus size={16} aria-hidden /> Novo conteúdo em {e.titulo}
                </button>
              )}
            </section>
          );
        })}
      </div>

      {/* Aviso de "movido": some sozinho; "Ver" leva ate a etapa */}
      {aviso && (
        <div className="pointer-events-none absolute inset-x-3 bottom-4 z-20 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-marca-azulEscuro py-2 pl-4 pr-2 text-sm font-semibold text-white shadow-modal animate-subirSheet">
            <span className="min-w-0 truncate">{aviso.texto}</span>
            <button
              type="button"
              onClick={() => {
                irPara(aviso.etapa);
                setAviso(null);
              }}
              className="pressionavel shrink-0 rounded-full bg-white/15 px-3 py-1 text-xs font-bold"
            >
              Ver
            </button>
          </div>
        </div>
      )}

      {cardAcoes && (
        <AcoesDoCard
          card={cardAcoes}
          onFechar={() => setAcoesId(null)}
          onAbrir={() => {
            setAcoesId(null);
            onAbrir(cardAcoes.id);
          }}
          onMovido={(titulo, indice) => avisar(`Movido para ${titulo}`, indice)}
        />
      )}
    </div>
  );
}

/** Card do quadro no celular: toque abre, segurar abre as acoes. */
function CardSeguravel({
  card,
  onAbrir,
  onSegurar,
}: {
  card: CardConteudo;
  onAbrir: (id: string) => void;
  onSegurar: (id: string) => void;
}) {
  const pressao = usePressaoLonga(() => onSegurar(card.id));
  return (
    <CardVisual
      card={card}
      onAbrir={onAbrir}
      onClick={() => onAbrir(card.id)}
      {...pressao}
      className="pressionavel select-none [-webkit-touch-callout:none]"
    />
  );
}

/**
 * Acoes rapidas do card (folha de baixo): mover para qualquer etapa com um toque,
 * marcar como postado (ou reabrir), iniciar o timer nele ou abrir o card inteiro.
 */
function AcoesDoCard({
  card,
  onFechar,
  onAbrir,
  onMovido,
}: {
  card: CardConteudo;
  onFechar: () => void;
  onAbrir: () => void;
  onMovido: (tituloEtapa: string, indice: number) => void;
}) {
  const { etapas, etapaPostado, etapaPorId, moverCard, marcarPostado, reabrirCard } = useBoard();
  const { timerAtivo, iniciarTimer } = useApontamentos();
  const postado = card.etapa === etapaPostado.id;
  const timerAqui = timerAtivo?.cardId === card.id;

  function mover(etapa: Etapa) {
    if (etapa === card.etapa) return;
    if (etapa === etapaPostado.id) marcarPostado(card.id);
    else moverCard(card.id, etapa);
    const i = etapas.findIndex((e) => e.id === etapa);
    onMovido(etapaPorId(etapa).titulo, i);
    onFechar();
  }

  return (
    <FolhaInferior onFechar={onFechar} titulo={card.titulo || "Sem título"} subtitulo={`Em ${etapaPorId(card.etapa).titulo}`}>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-marca-cinza">Mover para</p>
      <div className="flex flex-col gap-1.5">
        {etapas.map((e) => {
          const aqui = e.id === card.etapa;
          const ehPostado = e.id === etapaPostado.id;
          return (
            <button
              key={e.id}
              type="button"
              disabled={aqui}
              onClick={() => mover(e.id)}
              className={`pressionavel flex items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
                aqui
                  ? "bg-marca-azulEscuro/[0.06] text-marca-cinza"
                  : ehPostado
                    ? "bg-marca-verdeClaro text-marca-verdeEscuro"
                    : "bg-marca-branco text-marca-azulEscuro"
              }`}
            >
              <span className="min-w-0 truncate">{e.titulo}</span>
              {aqui ? (
                <span className="shrink-0 text-[11px] font-bold uppercase tracking-wide">Está aqui</span>
              ) : (
                <ArrowRight size={16} className="shrink-0" aria-hidden />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <AcaoGrande icone={<Maximize2 size={20} aria-hidden />} onClick={onAbrir}>
          Abrir
        </AcaoGrande>
        {postado ? (
          <AcaoGrande
            icone={<RotateCcw size={20} aria-hidden />}
            onClick={() => {
              reabrirCard(card.id);
              onFechar();
            }}
          >
            Reabrir
          </AcaoGrande>
        ) : (
          <AcaoGrande icone={<CheckCircle2 size={20} aria-hidden />} destaque onClick={() => mover(etapaPostado.id)}>
            Postado
          </AcaoGrande>
        )}
        <AcaoGrande
          icone={<Timer size={20} aria-hidden />}
          disabled={timerAqui}
          onClick={() => {
            iniciarTimer(card.id);
            onFechar();
          }}
        >
          {timerAqui ? "Contando" : "Timer"}
        </AcaoGrande>
      </div>
    </FolhaInferior>
  );
}

function AcaoGrande({
  icone,
  children,
  onClick,
  destaque = false,
  disabled = false,
}: {
  icone: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  destaque?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`pressionavel flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3.5 text-xs font-bold transition disabled:opacity-50 ${
        destaque ? "bg-marca-verde text-white" : "bg-marca-branco text-marca-azulEscuro"
      }`}
    >
      {icone}
      {children}
    </button>
  );
}
