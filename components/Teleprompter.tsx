"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Users,
  MonitorPlay,
  Sliders,
} from "lucide-react";
import {
  useControleTeleprompter,
  type ControleTeleprompter,
  type ModoTela,
  type PresencaTela,
} from "@/lib/teleprompterAoVivo";
import { gerarId } from "@/lib/util";

const CHAVE_PAPEL = "kando:tp-papel";

type BlocoRoteiro = { tipo: "marca" | "texto"; conteudo: string };

/**
 * Divide o roteiro em blocos para o teleprompter. Uma linha que comeca com "-"
 * e e curta (ex: -hook, -problema, -cta) vira um marcador de secao (pequeno, em
 * vermelho); o resto e a fala normal. O texto continua um so no campo de edicao;
 * isto e apenas a leitura/estilo.
 */
function ehMarcador(linha: string): string | null {
  const t = linha.trim();
  const m = /^-\s*(\S[^\n]{0,23})$/.exec(t); // "-rotulo" curto, sem virar fala
  if (!m) return null;
  const rotulo = m[1].trim();
  if (!rotulo || /[.!?,;:]$/.test(rotulo)) return null; // evita pegar uma frase
  return rotulo;
}

function dividirRoteiro(texto: string): BlocoRoteiro[] {
  const blocos: BlocoRoteiro[] = [];
  let buffer: string[] = [];
  const despejar = () => {
    const conteudo = buffer.join("\n");
    if (conteudo.trim()) blocos.push({ tipo: "texto", conteudo });
    buffer = [];
  };
  texto.split("\n").forEach((linha) => {
    const rotulo = ehMarcador(linha);
    if (rotulo !== null) {
      despejar();
      blocos.push({ tipo: "marca", conteudo: rotulo });
    } else {
      buffer.push(linha);
    }
  });
  despejar();
  return blocos;
}

/** Le o papel salvo neste aparelho (nome + modo da tela). */
function lerPapel(): { nome: string; modo: ModoTela } {
  if (typeof window === "undefined") return { nome: "Controle", modo: "controle" };
  try {
    const bruto = window.localStorage.getItem(CHAVE_PAPEL);
    if (bruto) {
      const p = JSON.parse(bruto) as { nome?: unknown; modo?: unknown };
      return {
        nome: typeof p.nome === "string" && p.nome.trim() ? p.nome : "Controle",
        modo: p.modo === "exibir" ? "exibir" : "controle",
      };
    }
  } catch {
    // ignora
  }
  return { nome: "Controle", modo: "controle" };
}

/**
 * Teleprompter em tela cheia com controle remoto AO VIVO compartilhado por card.
 * Cada tela aberta escolhe um papel: "Teleprompter (tela limpa)" mostra so o
 * texto rolando, e "Ator"/"Cinegrafista" mostram botoes grandes para controlar
 * tudo em tempo real (play/pause, velocidade, fonte, avancar/voltar, sincronizar).
 * Da para ver quais telas estao abertas e deixar uma delas limpa a distancia.
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
  const idRef = useRef<string>("");
  if (!idRef.current) idRef.current = gerarId();
  const meuId = idRef.current;

  const papelInicial = useRef(lerPapel());
  const [nome, setNome] = useState(papelInicial.current.nome);
  const [modo, setModo] = useState<ModoTela>(papelInicial.current.modo);
  const [painelTelas, setPainelTelas] = useState(false);

  const [tocando, setTocando] = useState(false);
  const [tamanho, setTamanho] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 640 ? 30 : 44
  );
  const [velocidade, setVelocidade] = useState(1.4); // px por quadro
  const [espelhoH, setEspelhoH] = useState(false);
  const [saltoToken, setSaltoToken] = useState(0);

  const tocandoRef = useRef(tocando);
  const velocidadeRef = useRef(velocidade);
  const tamanhoRef = useRef(tamanho);
  const pctPendenteRef = useRef(0);

  const pctAtual = useCallback((): number => {
    const el = areaRef.current;
    if (!el) return 0;
    const max = Math.max(1, el.scrollHeight - el.clientHeight);
    return Math.min(1, Math.max(0, el.scrollTop / max));
  }, []);

  const aplicarPct = useCallback((pct: number) => {
    const el = areaRef.current;
    if (!el) return;
    const max = Math.max(0, el.scrollHeight - el.clientHeight);
    el.scrollTop = pct * max;
  }, []);

  const aoReceberControle = useCallback((c: ControleTeleprompter) => {
    tocandoRef.current = c.tocando;
    setTocando(c.tocando);
    velocidadeRef.current = c.velocidade;
    setVelocidade(c.velocidade);
    tamanhoRef.current = c.tamanho;
    setTamanho(c.tamanho);
    if (c.saltar) {
      pctPendenteRef.current = c.posicaoPct;
      setSaltoToken((t) => t + 1);
    }
  }, []);

  const aoComandoModo = useCallback((m: ModoTela) => setModo(m), []);

  const { enviarControle, comandarModo, telas, ativo } = useControleTeleprompter(cardId, {
    meuId,
    nome,
    modo,
    aoReceberControle,
    aoComandoModo,
  });

  // Salva o papel deste aparelho (para reabrir ja na funcao certa).
  useEffect(() => {
    try {
      window.localStorage.setItem(CHAVE_PAPEL, JSON.stringify({ nome, modo }));
    } catch {
      // ignora
    }
  }, [nome, modo]);

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

  useEffect(() => {
    if (saltoToken === 0) return;
    aplicarPct(pctPendenteRef.current);
  }, [saltoToken, aplicarPct]);

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

  const sincronizar = useCallback(() => {
    transmitir({ posicaoPct: pctAtual(), saltar: true });
  }, [transmitir, pctAtual]);

  const definirPapel = useCallback((novoNome: string, novoModo: ModoTela) => {
    setNome(novoNome);
    setModo(novoModo);
  }, []);

  // Fecha com Esc (em captura, para nao fechar tambem o modal por baixo).
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        e.preventDefault();
        if (painelTelas) setPainelTelas(false);
        else onFechar();
      }
    }
    window.addEventListener("keydown", aoTeclar, true);
    return () => window.removeEventListener("keydown", aoTeclar, true);
  }, [onFechar, painelTelas]);

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

  const limpa = modo === "exibir";
  const outras = telas.filter((t) => t.id !== meuId);
  const blocos = useMemo(() => dividirRoteiro(texto), [texto]);
  const tamMarca = Math.max(13, Math.round(tamanho * 0.4)); // etiqueta menor que a fala
  const btn = "rounded-marca bg-white/10 text-white transition hover:bg-white/20 active:bg-white/30";

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0b0d12] text-white animate-fadeIn">
      {/* Barra de controles: so no modo controle (no modo limpa fica oculta). */}
      {!limpa && (
        <div className="flex flex-col gap-2 border-b border-white/10 px-3 py-2 sm:px-5 sm:py-3">
          {/* Linha principal: botoes grandes para o ator/cinegrafista. */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => pular(-1)}
              title="Voltar um trecho"
              aria-label="Voltar um trecho"
              className={`${btn} p-3`}
            >
              <SkipBack size={24} aria-hidden />
            </button>
            <button
              type="button"
              onClick={alternarTocando}
              className="flex flex-1 items-center justify-center gap-2 rounded-marca bg-marca-laranja px-5 py-3.5 text-lg font-bold text-white transition hover:brightness-95"
            >
              {tocando ? <Pause size={26} aria-hidden /> : <Play size={26} aria-hidden />}
              {tocando ? "Pausar" : "Rolar"}
            </button>
            <button
              type="button"
              onClick={() => pular(1)}
              title="Avançar um trecho"
              aria-label="Avançar um trecho"
              className={`${btn} p-3`}
            >
              <SkipForward size={24} aria-hidden />
            </button>
          </div>

          {/* Linha secundaria: velocidade, fonte e demais acoes. */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              {/* Velocidade com valor visivel */}
              <div className="flex items-center gap-1.5">
                <Turtle size={18} aria-hidden className="text-white/60" />
                <button
                  type="button"
                  onClick={() => mudarVelocidade(velocidade - 0.4)}
                  className={`${btn} p-2.5`}
                  aria-label="Diminuir velocidade"
                >
                  <Minus size={18} aria-hidden />
                </button>
                <span className="w-8 text-center text-sm font-bold tabular-nums">
                  {velocidade.toFixed(1)}
                </span>
                <button
                  type="button"
                  onClick={() => mudarVelocidade(velocidade + 0.4)}
                  className={`${btn} p-2.5`}
                  aria-label="Aumentar velocidade"
                >
                  <Plus size={18} aria-hidden />
                </button>
                <Rabbit size={18} aria-hidden className="text-white/60" />
              </div>

              {/* Fonte */}
              <div className="flex items-center gap-1.5">
                <Type size={16} aria-hidden className="text-white/60" />
                <button
                  type="button"
                  onClick={() => mudarTamanho(tamanho - 4)}
                  className={`${btn} p-2.5`}
                  aria-label="Diminuir fonte"
                >
                  <Minus size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => mudarTamanho(tamanho + 4)}
                  className={`${btn} p-2.5`}
                  aria-label="Aumentar fonte"
                >
                  <Plus size={16} aria-hidden />
                </button>
              </div>

              <button type="button" onClick={reiniciar} title="Reiniciar do topo" className={`${btn} p-2.5`}>
                <RotateCcw size={18} aria-hidden />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {cardId && (
                <button
                  type="button"
                  onClick={() => setPainelTelas(true)}
                  title="Telas conectadas"
                  className="flex items-center gap-1.5 rounded-marca bg-white/10 px-2.5 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  <Users size={16} aria-hidden />
                  <span className="hidden sm:inline">Telas</span>
                  {ativo && telas.length > 0 && (
                    <span className="rounded-full bg-marca-verde px-1.5 text-xs font-bold text-white">
                      {telas.length}
                    </span>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={() => setEspelhoH((e) => !e)}
                aria-pressed={espelhoH}
                title="Espelho para o vidro do teleprompter"
                className={`flex items-center gap-1.5 rounded-marca px-2.5 py-2 text-sm font-semibold transition ${
                  espelhoH ? "bg-marca-laranja text-white" : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                <FlipHorizontal size={16} aria-hidden />
                <span className="hidden sm:inline">Espelho</span>
              </button>
              <button
                type="button"
                onClick={() => definirPapel("Teleprompter", "exibir")}
                title="Deixar esta tela limpa (so o texto)"
                className="flex items-center gap-1.5 rounded-marca bg-white/10 px-2.5 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                <MonitorPlay size={16} aria-hidden />
                <span className="hidden sm:inline">Tela limpa</span>
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
        </div>
      )}

      {/* No modo limpa: cluster discreto no canto (controles + fechar). */}
      {limpa && (
        <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5 opacity-25 transition hover:opacity-100 focus-within:opacity-100">
          {cardId && (
            <button
              type="button"
              onClick={() => setPainelTelas(true)}
              title="Telas conectadas"
              className={`${btn} p-2`}
              aria-label="Telas conectadas"
            >
              <Users size={18} aria-hidden />
            </button>
          )}
          <button
            type="button"
            onClick={() => definirPapel("Controle", "controle")}
            title="Mostrar os controles nesta tela"
            className={`${btn} p-2`}
            aria-label="Mostrar controles"
          >
            <Sliders size={18} aria-hidden />
          </button>
          <button
            type="button"
            onClick={onFechar}
            title="Fechar"
            className={`${btn} p-2`}
            aria-label="Fechar"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
      )}

      {/* Texto do roteiro. No modo controle, tocar rola/pausa; no modo limpa nao
          (evita pausar sem querer enquanto o ator le). */}
      <div
        ref={areaRef}
        onClick={limpa ? undefined : alternarTocando}
        className={`flex-1 overflow-y-auto overscroll-contain px-5 py-12 sm:px-16 sm:py-16 ${
          limpa ? "" : "cursor-pointer"
        }`}
      >
        <div className="mx-auto max-w-4xl" style={{ transform: `scaleX(${espelhoH ? -1 : 1})` }}>
          {blocos.length === 0 ? (
            <p
              className="whitespace-pre-wrap text-center font-semibold"
              style={{ fontSize: `${tamanho}px`, lineHeight: 1.5 }}
            >
              Sem roteiro para exibir.
            </p>
          ) : (
            blocos.map((b, i) =>
              b.tipo === "marca" ? (
                <span
                  key={i}
                  className="mb-1 mt-6 block text-center font-bold uppercase tracking-widest first:mt-0"
                  style={{ fontSize: `${tamMarca}px`, color: "#EC1313", lineHeight: 1.2 }}
                >
                  {b.conteudo}
                </span>
              ) : (
                <p
                  key={i}
                  className="whitespace-pre-wrap text-center font-semibold"
                  style={{ fontSize: `${tamanho}px`, lineHeight: 1.5 }}
                >
                  {b.conteudo}
                </p>
              )
            )
          )}
          <div className="h-[60vh]" aria-hidden />
        </div>
      </div>

      {/* Indicador discreto do controle ao vivo (so no modo controle). */}
      {!limpa && (
        <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-center">
          {espelhoH && (
            <p className="rounded-marca bg-white/10 px-3 py-1 text-[11px] font-medium text-white/75">
              Espelho para o vidro: no vidro o texto lê normal, do começo ao fim.
            </p>
          )}
          {ativo ? (
            <p className="flex items-center gap-1 text-[11px] text-white/45">
              <Radio size={11} className="text-marca-verde" aria-hidden /> Controle ao vivo: vale para todas as telas
            </p>
          ) : (
            <p className="text-[11px] text-white/40">Toque na tela para rolar ou pausar</p>
          )}
        </div>
      )}

      {/* Painel de telas conectadas */}
      {painelTelas && (
        <div
          className="absolute inset-0 z-20 flex items-start justify-center bg-black/60 p-4 animate-fadeIn"
          onClick={() => setPainelTelas(false)}
        >
          <div
            className="mt-4 w-full max-w-sm overflow-hidden rounded-marca bg-white text-marca-preto shadow-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 bg-marca-azulEscuro px-4 py-3 text-white">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <Users size={16} aria-hidden /> Telas conectadas {ativo ? `(${telas.length})` : ""}
              </h2>
              <button
                type="button"
                onClick={() => setPainelTelas(false)}
                aria-label="Fechar"
                className="rounded-marca p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-4 overflow-y-auto px-4 py-4">
              {/* Esta tela: papel + nome */}
              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-marca-azulEscuro">
                  Esta tela
                </p>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <BotaoPapel ativo={limpa} onClick={() => definirPapel("Teleprompter", "exibir")}>
                    Tela limpa
                  </BotaoPapel>
                  <BotaoPapel
                    ativo={!limpa && nome === "Ator"}
                    onClick={() => definirPapel("Ator", "controle")}
                  >
                    Ator
                  </BotaoPapel>
                  <BotaoPapel
                    ativo={!limpa && nome === "Cinegrafista"}
                    onClick={() => definirPapel("Cinegrafista", "controle")}
                  >
                    Cinegrafista
                  </BotaoPapel>
                </div>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  maxLength={24}
                  placeholder="Nome desta tela"
                  className="w-full rounded-marca border border-marca-cinza/40 px-2.5 py-1.5 text-sm text-marca-preto outline-none focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
                />
              </div>

              {/* Outras telas */}
              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-marca-azulEscuro">
                  Outras telas
                </p>
                {!ativo ? (
                  <p className="rounded-marca bg-marca-branco px-3 py-3 text-center text-xs text-marca-cinza">
                    Controle ao vivo disponível no site (com login). As telas conectadas aparecem aqui.
                  </p>
                ) : outras.length === 0 ? (
                  <p className="rounded-marca bg-marca-branco px-3 py-3 text-center text-xs text-marca-cinza">
                    Nenhuma outra tela aberta neste card ainda. Abra o teleprompter em outro aparelho.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {outras.map((t) => (
                      <LinhaTela key={t.id} tela={t} onComandar={comandarModo} />
                    ))}
                  </div>
                )}
              </div>

              {/* Sincronizar posicao */}
              {ativo && (
                <button
                  type="button"
                  onClick={() => {
                    sincronizar();
                    setPainelTelas(false);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-marca bg-marca-laranja px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-95"
                >
                  <Radio size={15} aria-hidden /> Sincronizar todas nesta posição
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BotaoPapel({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`rounded-marca border px-3 py-1.5 text-sm font-semibold transition ${
        ativo
          ? "border-transparent bg-marca-laranja text-white"
          : "border-marca-cinza/40 bg-white text-marca-cinza hover:text-marca-azulEscuro"
      }`}
    >
      {children}
    </button>
  );
}

function LinhaTela({
  tela,
  onComandar,
}: {
  tela: PresencaTela;
  onComandar: (alvoId: string, modo: ModoTela) => void;
}) {
  const limpa = tela.modo === "exibir";
  return (
    <div className="flex items-center gap-2 rounded-marca border border-marca-cinza/30 bg-white p-2">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-marca text-white ${
          limpa ? "bg-marca-azulEscuro" : "bg-marca-laranja"
        }`}
      >
        {limpa ? <MonitorPlay size={15} aria-hidden /> : <Sliders size={15} aria-hidden />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-marca-preto">{tela.nome}</span>
        <span className="block text-[11px] text-marca-cinza">
          {limpa ? "Tela limpa" : "Controle"}
        </span>
      </span>
      {limpa ? (
        <button
          type="button"
          onClick={() => onComandar(tela.id, "controle")}
          className="shrink-0 rounded-marca border border-marca-cinza/40 px-2.5 py-1.5 text-xs font-semibold text-marca-azulEscuro transition hover:bg-marca-branco"
        >
          Dar controle
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onComandar(tela.id, "exibir")}
          className="shrink-0 rounded-marca border border-marca-cinza/40 px-2.5 py-1.5 text-xs font-semibold text-marca-azulEscuro transition hover:bg-marca-branco"
        >
          Deixar limpa
        </button>
      )}
    </div>
  );
}
