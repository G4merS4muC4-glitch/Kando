"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  Square,
  AlertTriangle,
  CornerDownLeft,
  ChevronUp,
  ChevronDown,
  Pause,
  Play,
  Link2Off,
  History,
  List,
} from "lucide-react";
import { useBoard } from "@/lib/store";
import { useApontamentos } from "@/lib/apontamentosProvider";
import {
  SEM_PROJETO,
  formatarRelogio,
  horaLocal,
  tempoTrabalhadoMs,
  timerRecemEscolhido,
  tituloDoTimer,
} from "@/lib/apontamentos";
import { TIPOS, campanhaArquivada } from "@/lib/config";
import {
  cardsRecentes,
  indexarCards,
  sugerirCards,
  trechosDestacados,
  type SugestaoCard,
} from "@/lib/sugestaoCards";
import { ALTURA_PILULA, useArrasteCartao } from "@/lib/useArrasteCartao";
import type { TipoConteudo } from "@/lib/types";
import TituloRolante from "./TituloRolante";
import { ModalAjustarParada } from "./apontamentos/IndicadorTimerTopo";
import ModalIniciarTimer from "./apontamentos/ModalIniciarTimer";

const LIMITE_LONGO_MS = 8 * 3_600_000; // acima disso, sugere ajustar o termino
const POS_KEY = "kando:timer-pos"; // posicao do card, por aparelho
const BASE_INFERIOR = 96; // distancia do rodape na posicao padrao
const ESPERA_BLUR_MS = 150; // no toque, o blur vem antes do clique na sugestao

/**
 * Card de tempo flutuante (desktop e mobile). Aparece so quando ha um timer
 * rodando, no lugar da pilula do topo e da faixa do mobile. E feito em vidro
 * liquido (translucido, borda em gradiente, reflexo no topo e sombra dupla),
 * azul na pilula e claro no card de anotacoes.
 *
 * O timer pode rodar sem projeto: o que se escreve e Enter vira um ponto na
 * linha do tempo. Enquanto se digita, os cards com aquele nome aparecem num
 * balao acima do campo; clicar num deles faz o timer contar naquele card.
 *
 * O arraste (pressionar e mover em qualquer ponto, com inercia e inclinacao)
 * vem do hook useArrasteCartao, compartilhado com o card de prazo.
 */
export default function CartaoTimerFlutuante() {
  const {
    timerAtivo,
    registros,
    autor,
    iniciarTimer,
    vincularTimer,
    pararTimer,
    alternarPausa,
    adicionarCheckpoint,
  } = useApontamentos();
  const { cards, campanhas, cardPorId, campanhaPorId, marcaPorId, etapaPostado } = useBoard();

  const [agoraMs, setAgoraMs] = useState(() => (typeof window !== "undefined" ? Date.now() : 0));
  const [aberto, setAberto] = useState(true); // ja inicia aberto; da para recolher
  const [rascunho, setRascunho] = useState("");
  const [ajustarAberto, setAjustarAberto] = useState(false);
  const [listaAberta, setListaAberta] = useState(false); // todos os cards (modal)
  const [focado, setFocado] = useState(false);
  const [dispensado, setDispensado] = useState(false); // Esc fecha o balao ate digitar de novo
  const [realce, setRealce] = useState(-1); // sugestao marcada pelas setas (-1 = nenhuma)
  const inputRef = useRef<HTMLInputElement>(null);
  const blurRef = useRef<number | null>(null);

  const rodando = Boolean(timerAtivo);
  const inicio = timerAtivo?.inicio;
  const cardAtualId = timerAtivo?.cardId;
  const semProjeto = rodando && !cardAtualId;

  const arraste = useArrasteCartao({
    chave: POS_KEY,
    padrao: { right: 16, bottom: BASE_INFERIOR },
    revalidarEm: inicio,
  });

  // Relogio por segundo enquanto roda (so para exibir; o tempo real e por
  // diferenca). Depende da identidade do timer, nao do objeto.
  useEffect(() => {
    if (!rodando) return;
    setAgoraMs(Date.now());
    const id = window.setInterval(() => setAgoraMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [rodando, inicio]);

  // Recem-iniciado sem projeto (clicou em Iniciar): abre a abinha e ja foca o
  // campo, para escrever o que esta fazendo ou escolher o card.
  useEffect(() => {
    if (!semProjeto || !inicio || !arraste.montado) return;
    if (Date.now() - new Date(inicio).getTime() > 5000) return;
    setAberto(true);
    const id = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [semProjeto, inicio, arraste.montado]);

  // Parou o timer com o campo em foco: o campo some sem disparar o blur.
  useEffect(() => {
    if (rodando) return;
    setFocado(false);
    setRealce(-1);
  }, [rodando]);

  useEffect(
    () => () => {
      if (blurRef.current) window.clearTimeout(blurRef.current);
    },
    []
  );

  // Indice da busca: so monta com o campo em foco (nao pesa enquanto so roda).
  const indice = useMemo(
    () =>
      focado
        ? indexarCards({
            cards,
            campanhas: campanhas.map((c) => ({
              id: c.id,
              nome: c.nome,
              arquivada: campanhaArquivada(c.status),
            })),
            registros,
            autorId: autor.id,
            postadoId: etapaPostado.id,
            rotuloTipo: (t) => TIPOS[t].label,
          })
        : null,
    [focado, cards, campanhas, registros, autor.id, etapaPostado.id]
  );

  // Digitando: os cards que combinam. Campo vazio e sem projeto: os ultimos usados.
  const texto = rascunho.trim();
  const sugestoes = useMemo<SugestaoCard[]>(() => {
    if (!indice) return [];
    if (texto.length >= 2) {
      return sugerirCards(texto, indice, { excluirId: cardAtualId, agoraMs: Date.now() });
    }
    if (!texto && semProjeto) return cardsRecentes(indice, { excluirId: cardAtualId });
    return [];
  }, [indice, texto, semProjeto, cardAtualId]);

  if (!arraste.montado || !timerAtivo) return null;

  const card = cardPorId(timerAtivo.cardId);
  const titulo = tituloDoTimer(timerAtivo, card);
  const pausado = Boolean(timerAtivo.pausadoEm);
  const ms = tempoTrabalhadoMs(timerAtivo, agoraMs);
  const longo = ms > LIMITE_LONGO_MS;
  const checkpoints = timerAtivo.checkpoints ?? [];
  const pausaTotalMs =
    (timerAtivo.pausaMs ?? 0) +
    (timerAtivo.pausadoEm ? Math.max(0, agoraMs - new Date(timerAtivo.pausadoEm).getTime()) : 0);

  const balaoAberto = aberto && focado && !dispensado && sugestoes.length > 0;
  const realceValido = balaoAberto && realce < sugestoes.length ? realce : -1;
  // Rodou um tempo sem projeto: da para escolher se esse tempo tambem vai para o
  // card ("desde 09:02") ou se o card so conta daqui para frente (clique normal).
  const desde =
    semProjeto && !timerRecemEscolhido(timerAtivo, agoraMs) ? horaLocal(timerAtivo.inicio) : null;

  function aoParar() {
    if (longo) setAjustarAberto(true);
    else pararTimer();
  }

  function enviarCheckpoint() {
    const txt = rascunho.trim();
    if (!txt) return;
    adicionarCheckpoint(txt);
    setRascunho("");
    setRealce(-1);
  }

  /** O timer passa a contar no card sugerido (ver iniciarTimer/vincularTimer). */
  function escolher(s: SugestaoCard, desdeInicio: boolean) {
    // Frase com mais que o nome do card ("editando a capa do reel natal") fica
    // como nota do trecho; so o nome do card, nao.
    const nota = s.sobra ? rascunho.trim() : undefined;
    if (desdeInicio) vincularTimer(s.card.id, nota);
    else iniciarTimer(s.card.id, nota);
    setRascunho("");
    setRealce(-1);
    setDispensado(false);
    inputRef.current?.focus();
  }

  function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.nativeEvent.isComposing) return;
    const n = balaoAberto ? sugestoes.length : 0;
    if (e.key === "ArrowDown" && n > 0) {
      e.preventDefault();
      setRealce((i) => (i + 1 >= n ? 0 : i + 1));
    } else if (e.key === "ArrowUp" && n > 0) {
      e.preventDefault();
      setRealce((i) => (i <= 0 || i >= n ? n - 1 : i - 1));
    } else if (e.key === "Escape" && balaoAberto) {
      e.preventDefault();
      setDispensado(true);
      setRealce(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Enter so escolhe o card marcado com as setas (Shift+Enter: desde o
      // inicio); sem nada marcado, anota o ponto, como sempre.
      if (realceValido >= 0) escolher(sugestoes[realceValido], e.shiftKey && Boolean(desde));
      else enviarCheckpoint();
    }
  }

  function aoFocar() {
    if (blurRef.current) window.clearTimeout(blurRef.current);
    setFocado(true);
    setDispensado(false);
  }

  function aoDesfocar() {
    blurRef.current = window.setTimeout(() => {
      setFocado(false);
      setRealce(-1);
    }, ESPERA_BLUR_MS);
  }

  function linhaDoCard(s: SugestaoCard): string {
    const camp = campanhaPorId(s.card.campanhaId);
    return [camp?.nome, camp ? marcaPorId(camp.marca).nome : undefined, s.motivo]
      .filter(Boolean)
      .join(" · ");
  }

  const recentes = !texto;
  const cabecalho = recentes
    ? "Usados por último"
    : semProjeto
      ? "Vincular a um card"
      : "Trocar para outro card";
  const dicaItem = semProjeto
    ? desde
      ? "Contar neste card daqui para frente (o tempo sem projeto até agora fica salvo)"
      : "Contar neste card"
    : `Trocar para este card (o tempo em ${titulo} fica salvo)`;

  // Na posicao padrao o card fica em baixo: a abinha abre para cima.
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const paraCima = arraste.abrirParaCima(vh - BASE_INFERIOR - ALTURA_PILULA);
  // O balao e mais largo que o card: cresce para o lado de dentro da tela (na
  // posicao padrao, a direita, ele se estende para a esquerda).
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const cardNaDireita = arraste.pos ? arraste.pos.x + 144 > vw / 2 : true;

  // Abinha + balao numa coluna: o balao fica sempre do lado de fora (acima da
  // abinha quando ela abre para cima), sem cobrir a pilula.
  const Painel = (
    <div
      className={`absolute left-0 right-0 flex gap-2 ${
        paraCima ? "bottom-full mb-2 flex-col-reverse" : "top-full mt-2 flex-col"
      }`}
    >
      <div
        className={`tp-glass tp-glass-claro ${arraste.arrastando ? "tp-glass-elevado" : ""} animate-fadeIn`}
      >
        <div className="relative z-10 flex items-center gap-2 p-3 pb-1.5">
          <input
            ref={inputRef}
            type="text"
            value={rascunho}
            onChange={(e) => {
              setRascunho(e.target.value);
              setRealce(-1);
              setDispensado(false);
            }}
            onKeyDown={aoTeclar}
            onFocus={aoFocar}
            onBlur={aoDesfocar}
            placeholder="O que está fazendo agora?"
            aria-label="Anotar um checkpoint ou buscar um card"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={balaoAberto}
            aria-controls="timer-sugestoes"
            aria-activedescendant={realceValido >= 0 ? `timer-sug-${realceValido}` : undefined}
            className="min-w-0 flex-1 cursor-text select-text rounded-marca border border-marca-cinza/40 bg-white/90 px-2.5 py-1.5 text-sm text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
          />
          <button
            type="button"
            onClick={enviarCheckpoint}
            aria-label="Marcar checkpoint"
            title="Marcar checkpoint (Enter)"
            className="flex shrink-0 items-center justify-center rounded-full bg-marca-laranja p-2 text-white transition hover:brightness-95 active:scale-90"
          >
            <CornerDownLeft size={16} aria-hidden />
          </button>
        </div>

        {/* Onde o tempo esta contando e o atalho do lado */}
        <div className="relative z-10 flex items-center justify-between gap-2 px-3.5 pb-2 text-[11px] text-marca-cinza">
          {semProjeto ? (
            <>
              <span className="min-w-0 truncate">Sem projeto · digite um card</span>
              <button
                type="button"
                onClick={() => setListaAberta(true)}
                title="Escolher o card na lista completa"
                className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-marca-azulEscuro transition hover:bg-white/70"
              >
                <List size={12} aria-hidden /> Lista
              </button>
            </>
          ) : (
            <>
              <span className="min-w-0 truncate">Enter anota um ponto</span>
              <button
                type="button"
                onClick={() => iniciarTimer(SEM_PROJETO)}
                title="Parar de contar neste card e seguir sem projeto (o tempo aqui fica salvo)"
                className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-marca-azulEscuro transition hover:bg-white/70"
              >
                <Link2Off size={12} aria-hidden /> Soltar
              </button>
            </>
          )}
        </div>
      </div>

      {balaoAberto && (
        <BalaoSugestoes
          sugestoes={sugestoes}
          realce={realceValido}
          cabecalho={cabecalho}
          recentes={recentes}
          paraCima={paraCima}
          naDireita={cardNaDireita}
          desde={desde}
          dicaItem={dicaItem}
          linha={linhaDoCard}
          onEscolher={escolher}
          onVerTodos={() => setListaAberta(true)}
        />
      )}
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

          <div
            className={`tp-solido-azul ${pausado ? "tp-glass-pausado" : ""} ${
              arraste.arrastando ? "tp-glass-elevado" : ""
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
                onClick={() => {
                  setAberto((v) => !v);
                  setFocado(false);
                }}
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
          tituloCard={semProjeto ? "" : titulo}
          pausaMs={pausaTotalMs}
          onFechar={() => setAjustarAberto(false)}
        />
      )}
      {listaAberta && <ModalIniciarTimer onFechar={() => setListaAberta(false)} />}
    </>
  );
}

/** So o icone do tipo, na cor dele (o selo com o nome nao cabe no balao). */
function IconeTipo({ tipo }: { tipo: TipoConteudo }) {
  const conf = TIPOS[tipo];
  if (!conf) return null;
  const Icone = conf.icone;
  return (
    <span
      title={conf.label}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-white"
      style={{ backgroundColor: conf.cor }}
    >
      <Icone size={13} strokeWidth={2.4} aria-hidden />
    </span>
  );
}

/**
 * Balao com os cards que combinam com o que esta sendo digitado (ou os ultimos
 * usados, com o campo vazio). Clicar num card faz o timer contar nele; o chip
 * "desde 09:02" leva junto o tempo que ja rodou sem projeto.
 */
function BalaoSugestoes({
  sugestoes,
  realce,
  cabecalho,
  recentes,
  paraCima,
  naDireita,
  desde,
  dicaItem,
  linha,
  onEscolher,
  onVerTodos,
}: {
  sugestoes: SugestaoCard[];
  realce: number;
  cabecalho: string;
  recentes: boolean;
  paraCima: boolean;
  naDireita: boolean; // card na metade direita da tela: o balao cresce para a esquerda
  desde: string | null;
  dicaItem: string;
  linha: (s: SugestaoCard) => string;
  onEscolher: (s: SugestaoCard, desdeInicio: boolean) => void;
  onVerTodos: () => void;
}) {
  return (
    <div
      id="timer-sugestoes"
      role="listbox"
      aria-label={cabecalho}
      // Mantem o foco no campo (e o teclado do celular aberto) ao tocar no balao.
      onMouseDown={(e) => e.preventDefault()}
      className={`relative w-80 max-w-[calc(100vw-1rem)] rounded-2xl border border-marca-cinza/25 bg-white p-1.5 shadow-modal motion-safe:animate-surgir ${
        naDireita ? "self-end" : "self-start"
      }`}
    >
      {/* Rabinho do balao, apontando para o comeco do campo */}
      <span
        aria-hidden
        className={`absolute h-3 w-3 rotate-45 border-marca-cinza/25 bg-white ${
          naDireita ? "left-11" : "left-7"
        } ${paraCima ? "-bottom-1.5 border-b border-r" : "-top-1.5 border-l border-t"}`}
      />

      <p className="flex items-center gap-1 px-2 pb-1 pt-0.5 text-[10px] font-bold uppercase tracking-wide text-marca-cinza">
        {recentes && <History size={11} aria-hidden />}
        {cabecalho}
      </p>

      <div className="space-y-0.5">
        {sugestoes.map((s, i) => (
          <div
            key={s.card.id}
            id={`timer-sug-${i}`}
            role="option"
            aria-selected={i === realce}
            onClick={() => onEscolher(s, false)}
            title={dicaItem}
            className={`flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 transition ${
              i === realce ? "bg-marca-laranja/10 ring-1 ring-marca-laranja/40" : "hover:bg-marca-branco"
            }`}
          >
            <IconeTipo tipo={s.card.tipo} />
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-sm font-semibold leading-snug text-marca-preto">
                {trechosDestacados(s.titulo, s.destaques).map((t, j) =>
                  t.destaque ? (
                    <mark key={j} className="bg-transparent font-bold text-marca-laranja">
                      {t.txt}
                    </mark>
                  ) : (
                    <span key={j}>{t.txt}</span>
                  )
                )}
              </span>
              <span className="block truncate text-[11px] text-marca-cinza">{linha(s)}</span>
            </span>
            {desde && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEscolher(s, true);
                }}
                title={`Contar neste card desde ${desde} (início do timer), junto com o que já foi anotado`}
                className="shrink-0 rounded-full border border-marca-azulEscuro/25 px-2 py-0.5 text-[10px] font-bold text-marca-azulEscuro transition hover:border-marca-laranja hover:text-marca-laranja"
              >
                desde {desde}
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-1 flex items-center justify-between gap-2 border-t border-marca-cinza/15 px-2 pt-1.5 text-[10px] text-marca-cinza">
        <span className="hidden min-w-0 truncate espacoso:inline">
          {recentes ? "Digite para buscar · Enter só anota" : "↑↓ escolhe · Enter só anota"}
        </span>
        <button
          type="button"
          onClick={onVerTodos}
          className="ml-auto flex shrink-0 items-center gap-1 font-semibold text-marca-azulEscuro transition hover:text-marca-laranja"
        >
          <List size={11} aria-hidden /> Ver todos
        </button>
      </div>
    </div>
  );
}
