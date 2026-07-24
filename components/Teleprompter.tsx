"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Play,
  Pause,
  RotateCcw,
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
  Maximize,
  Minimize,
  Link2,
  Gamepad2,
  MonitorSmartphone,
  MonitorUp,
} from "lucide-react";
import {
  useControleTeleprompter,
  usePresencaGlobalTeleprompter,
  type ControleTeleprompter,
  type ModoTela,
  type PresencaTela,
} from "@/lib/teleprompterAoVivo";
import { gerarId } from "@/lib/util";

const CHAVE_PAPEL = "kando:tp-papel";
const CHAVE_CONFIG = "kando:tp-config"; // ultima velocidade/tamanho/espelho do aparelho

// Escala de velocidade bem ampla (px por quadro): de bem devagar (0.01) a bem rapido.
const VEL_MIN = 0.01;
const VEL_MAX = 20;
const FONTE_MIN = 20;
const FONTE_MAX = 100;

// Controle remoto: quantos caracteres por segundo cada unidade de velocidade
// representa (avanco por frase, independente do tamanho da tela). Calibrado para
// que a velocidade padrao (1.4) fique numa narracao confortavel (~12 car/s).
const CARACT_POR_VEL = 8.5;
// Onde fica a "linha de leitura" na tela de exibicao (fracao da altura, do topo).
// A frase atual e trazida para esta altura quando o remoto comanda.
const LINHA_LEITURA = 0.42;

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
      const modo: ModoTela = p.modo === "exibir" ? "exibir" : p.modo === "remoto" ? "remoto" : "controle";
      return {
        nome: typeof p.nome === "string" && p.nome.trim() ? p.nome : "Controle",
        modo,
      };
    }
  } catch {
    // ignora
  }
  return { nome: "Controle", modo: "controle" };
}

/** Nome padrao de cada modo (usado ao trocar de papel). */
function nomePadrao(modo: ModoTela): string {
  return modo === "exibir" ? "Teleprompter" : modo === "remoto" ? "Controle remoto" : "Controle";
}

/** Le a ultima config salva neste aparelho (velocidade, fonte e espelho). */
function lerConfig(): { velocidade: number; tamanho: number; espelhoH: boolean } {
  const padrao = {
    velocidade: 1.4,
    tamanho: typeof window !== "undefined" && window.innerWidth < 640 ? 30 : 44,
    espelhoH: false,
  };
  if (typeof window === "undefined") return padrao;
  try {
    const bruto = window.localStorage.getItem(CHAVE_CONFIG);
    if (bruto) {
      const p = JSON.parse(bruto) as { velocidade?: unknown; tamanho?: unknown; espelhoH?: unknown };
      return {
        velocidade:
          typeof p.velocidade === "number"
            ? Math.min(VEL_MAX, Math.max(VEL_MIN, p.velocidade))
            : padrao.velocidade,
        tamanho:
          typeof p.tamanho === "number"
            ? Math.min(FONTE_MAX, Math.max(FONTE_MIN, Math.round(p.tamanho)))
            : padrao.tamanho,
        espelhoH: Boolean(p.espelhoH),
      };
    }
  } catch {
    // ignora
  }
  return padrao;
}

/** Elemento atualmente em tela cheia (com prefixo webkit para Safari/iPad). */
function elementoTelaCheia(): Element | null {
  const d = document as Document & { webkitFullscreenElement?: Element | null };
  return document.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

/** Pede tela cheia de verdade (esconde as barras do navegador no tablet/celular). */
function pedirTelaCheia(el: HTMLElement): void {
  const e = el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
  if (el.requestFullscreen) void el.requestFullscreen().catch(() => {});
  else if (e.webkitRequestFullscreen) void e.webkitRequestFullscreen();
}

function sairTelaCheia(): void {
  const d = document as Document & { webkitExitFullscreen?: () => Promise<void> | void };
  if (document.exitFullscreen) void document.exitFullscreen().catch(() => {});
  else if (d.webkitExitFullscreen) void d.webkitExitFullscreen();
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
  modoInicial,
  titulo = "",
  escopoGlobal = null,
}: {
  texto: string;
  onFechar: () => void;
  cardId?: string | null;
  // Quando informado, abre ja neste modo (ex: "remoto" pelo botao de controle
  // remoto), ignorando o papel salvo neste aparelho.
  modoInicial?: ModoTela;
  // Nome curto do conteudo (para identificar o projeto nas outras telas).
  titulo?: string;
  // Escopo da presenca global (id da organizacao). Quando presente, habilita
  // "trocar o roteiro em todas as telas abertas" entre projetos diferentes.
  escopoGlobal?: string | null;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const idRef = useRef<string>("");
  if (!idRef.current) idRef.current = gerarId();
  const meuId = idRef.current;

  const [telaCheia, setTelaCheia] = useState(false);
  // "Acompanhar a guia": esta tela desliza suavemente ate a posicao de quem rola,
  // extrapolando o movimento entre as atualizacoes (dead reckoning) para nao pular.
  const [seguir, setSeguir] = useState(false);
  const guiaPctRef = useRef(0); // ultima posicao relativa recebida da guia
  const guiaVelRef = useRef(0); // velocidade relativa da guia (fracao por ms)
  const guiaQuandoRef = useRef(0); // quando chegou (extrapolar e detectar ausencia)
  const [suportaTelaCheia] = useState(() => {
    if (typeof document === "undefined") return false;
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: unknown };
    return typeof el.requestFullscreen === "function" || typeof el.webkitRequestFullscreen === "function";
  });

  const papelInicial = useRef(
    modoInicial
      ? { nome: nomePadrao(modoInicial), modo: modoInicial }
      : lerPapel()
  );
  const [nome, setNome] = useState(papelInicial.current.nome);
  const [modo, setModo] = useState<ModoTela>(papelInicial.current.modo);
  const [painelTelas, setPainelTelas] = useState(false);

  // Ultima config salva neste aparelho (persiste entre teleprompters do dia).
  const configInicial = useRef(lerConfig());
  const [tocando, setTocando] = useState(false);
  const [tamanho, setTamanho] = useState(configInicial.current.tamanho);
  const [velocidade, setVelocidade] = useState(configInicial.current.velocidade); // px por quadro
  const [espelhoH, setEspelhoH] = useState(configInicial.current.espelhoH);
  const [saltoToken, setSaltoToken] = useState(0);
  // Texto em edicao dos campos numericos (velocidade/tamanho). Enquanto o usuario
  // digita, o campo mostra o texto cru (deixa digitar ponto e valores parciais);
  // ao sair do campo (blur) volta a refletir o valor ja limitado.
  const [velTexto, setVelTexto] = useState<string | null>(null);
  const [tamTexto, setTamTexto] = useState<string | null>(null);

  const tocandoRef = useRef(tocando);
  const velocidadeRef = useRef(velocidade);
  const tamanhoRef = useRef(tamanho);
  const pctPendenteRef = useRef(0);

  const remoto = modo === "remoto";
  const remotoRef = useRef(remoto);
  remotoRef.current = remoto;

  // --- Controle remoto: posicao por FRASE (fb = fracao de bloco, 0..N) ---
  // fb: frase "atual" mostrada no remoto (e comandada nas telas). cpRef: posicao
  // em caracteres (avanco continuo do play). Nas telas de exibicao, guardamos a
  // posicao recebida do remoto para deslizar suave ate a frase certa.
  const [fb, setFb] = useState(0);
  const fbRef = useRef(0);
  const cpRef = useRef(0);
  const remFbRef = useRef(0);
  const remVelRef = useRef(0);
  const remQuandoRef = useRef(0);
  const guiaRemotoRef = useRef(false);

  // Telas de exibicao: nos DOM de cada bloco (para medir onde cada frase esta) e
  // os topos absolutos medidos (usados para centralizar a frase comandada).
  const blocosDomRef = useRef<(HTMLElement | null)[]>([]);
  const toposRef = useRef<number[]>([]);
  const pendFbRef = useRef<number | null>(null);
  const [saltoFbToken, setSaltoFbToken] = useState(0);

  // Troca de projeto AO VIVO: quando outra tela manda (ou esta manda para as
  // outras) "rodar este roteiro", passamos a usar este card/texto no lugar do
  // que veio por prop, sem desmontar nada. null = usa o conteudo original.
  const [troca, setTroca] = useState<{ cardId: string; texto: string; titulo: string } | null>(null);
  const cardAtivo = troca ? troca.cardId : cardId;
  const textoAtivo = troca ? troca.texto : texto;
  const tituloAtivo = troca ? troca.titulo : titulo;
  const cardAtivoRef = useRef(cardAtivo);
  cardAtivoRef.current = cardAtivo;
  const [msgTroca, setMsgTroca] = useState<string | null>(null);
  const msgTrocaTimer = useRef<number | null>(null);

  const blocos = useMemo(() => dividirRoteiro(textoAtivo), [textoAtivo]);
  const totalFrases = blocos.length;

  // Peso (em caracteres) de cada bloco, para o avanco por frase do remoto
  // respeitar frases longas/curtas. cum[i] = caracteres antes do bloco i.
  const medidas = useMemo(() => {
    const chars = blocos.map((b) => Math.max(6, b.conteudo.trim().length));
    const cum: number[] = [];
    let acc = 0;
    for (const c of chars) {
      cum.push(acc);
      acc += c;
    }
    return { chars, cum, total: Math.max(1, acc) };
  }, [blocos]);

  // Posicao em caracteres -> fracao de bloco (fb, 0..N).
  const fbDeCp = useCallback(
    (cp: number): number => {
      const { chars, cum, total } = medidas;
      const n = chars.length;
      if (n === 0) return 0;
      const x = Math.min(total, Math.max(0, cp));
      for (let i = 0; i < n; i++) {
        if (x < cum[i] + chars[i] || i === n - 1) return i + (x - cum[i]) / chars[i];
      }
      return n;
    },
    [medidas]
  );

  // Fracao de bloco (fb) -> posicao em caracteres.
  const cpDeFb = useCallback(
    (f: number): number => {
      const { chars, cum, total } = medidas;
      const n = chars.length;
      if (n === 0) return 0;
      const i = Math.min(Math.max(0, Math.floor(f)), n - 1);
      const frac = Math.min(1, Math.max(0, f - i));
      return Math.min(total, cum[i] + frac * chars[i]);
    },
    [medidas]
  );

  // --- Telas de exibicao: medir onde cada frase esta e centralizar a comandada ---
  // Mede o topo absoluto de cada bloco (dentro do conteudo rolavel). O ultimo
  // valor extra e o fim do ultimo bloco (para interpolar ate o fim).
  const recomputarTopos = useCallback(() => {
    const el = areaRef.current;
    if (!el) return;
    const ra = el.getBoundingClientRect();
    const base = el.scrollTop;
    const nodes = blocosDomRef.current;
    const arr: number[] = [];
    for (let i = 0; i < totalFrases; i++) {
      const node = nodes[i];
      if (node) arr.push(node.getBoundingClientRect().top - ra.top + base);
      else arr.push(arr.length ? arr[arr.length - 1] : 0);
    }
    const ultimo = nodes[totalFrases - 1];
    if (ultimo) {
      const r = ultimo.getBoundingClientRect();
      arr.push(r.top - ra.top + base + r.height);
    } else {
      arr.push(el.scrollHeight);
    }
    toposRef.current = arr;
  }, [totalFrases]);

  // Fracao de bloco (fb) -> scrollTop que traz a frase para a linha de leitura.
  const alvoScrollDeFb = useCallback((f: number): number => {
    const el = areaRef.current;
    const topos = toposRef.current;
    if (!el) return 0;
    if (topos.length < 2) return el.scrollTop;
    const n = topos.length - 1; // numero de blocos
    const fc = Math.min(n, Math.max(0, f));
    const i = Math.min(Math.floor(fc), n - 1);
    const frac = fc - i;
    const y = topos[i] + (topos[i + 1] - topos[i]) * frac;
    const off = el.clientHeight * LINHA_LEITURA;
    const max = Math.max(0, el.scrollHeight - el.clientHeight);
    return Math.min(max, Math.max(0, y - off));
  }, []);

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
    if (!c.tocando) guiaVelRef.current = 0; // guia parou: congela a extrapolacao
    guiaRemotoRef.current = Boolean(c.remoto); // a guia atual e um controle remoto?
    velocidadeRef.current = c.velocidade;
    setVelocidade(c.velocidade);
    tamanhoRef.current = c.tamanho;
    setTamanho(c.tamanho);
    if (c.saltar) {
      if (typeof c.fbSaltar === "number") {
        // Salto por FRASE (vindo do remoto): a tela centraliza esta frase.
        pendFbRef.current = c.fbSaltar;
        fbRef.current = c.fbSaltar;
        setFb(c.fbSaltar);
        setSaltoFbToken((t) => t + 1);
      } else {
        pctPendenteRef.current = c.posicaoPct;
        setSaltoToken((t) => t + 1);
      }
    }
  }, []);

  const aoComandoModo = useCallback((m: ModoTela) => setModo(m), []);

  const aoReceberPosicao = useCallback((pct: number, vel: number) => {
    guiaPctRef.current = pct;
    guiaVelRef.current = vel;
    guiaQuandoRef.current = Date.now();
  }, []);

  // Posicao por FRASE vinda do remoto: a tela desliza suave ate essa frase.
  const aoReceberPosicaoRemota = useCallback((f: number, vel: number) => {
    guiaRemotoRef.current = true;
    remFbRef.current = f;
    remVelRef.current = vel;
    remQuandoRef.current = Date.now();
    if (remotoRef.current) {
      // Se ESTA tela tambem e um remoto (raro), acompanha o preview do outro.
      fbRef.current = f;
      setFb(f);
    }
  }, []);

  // Troca de projeto recebida (de outra tela): recarrega este teleprompter no
  // novo card/texto e volta ao comeco, sem desmontar.
  const aoTrocar = useCallback((novoCard: string, novoTexto: string, novoTitulo: string) => {
    if (!novoCard || novoCard === cardAtivoRef.current) return; // ja estou neste projeto
    setTroca({ cardId: novoCard, texto: novoTexto, titulo: novoTitulo });
    tocandoRef.current = false;
    setTocando(false);
    guiaRemotoRef.current = false;
    fbRef.current = 0;
    setFb(0);
    cpRef.current = 0;
    const el = areaRef.current;
    if (el) el.scrollTop = 0;
    setMsgTroca(novoTitulo?.trim() ? novoTitulo : "Novo roteiro");
    if (msgTrocaTimer.current) window.clearTimeout(msgTrocaTimer.current);
    msgTrocaTimer.current = window.setTimeout(() => setMsgTroca(null), 2600);
  }, []);

  const { enviarControle, comandarModo, enviarPosicao, enviarPosicaoRemota, telas, ativo } =
    useControleTeleprompter(cardAtivo, {
      meuId,
      nome,
      modo,
      aoReceberControle,
      aoComandoModo,
      aoReceberPosicao,
      aoReceberPosicaoRemota,
    });

  // Presenca GLOBAL (entre projetos): permite "rodar este roteiro em todas as
  // telas abertas" sem ir em cada aparelho.
  const { telasGlobais, enviarTroca } = usePresencaGlobalTeleprompter(escopoGlobal, {
    meuId,
    cardId: cardAtivo,
    titulo: tituloAtivo,
    modo,
    aoTrocar,
  });

  // Outras telas de teleprompter abertas em OUTRO projeto (candidatas a trocar).
  const telasOutroProjeto = useMemo(
    () => telasGlobais.filter((t) => t.id !== meuId && t.cardId && t.cardId !== (cardAtivo ?? "")),
    [telasGlobais, meuId, cardAtivo]
  );

  // Pergunta uma vez, ao abrir, se quer levar este roteiro para as telas que
  // ja estao abertas em outro projeto. So no aparelho que controla (nao na tela
  // limpa) e enquanto nao trocou nesta sessao.
  const [popupTroca, setPopupTroca] = useState(false);
  const jaPerguntouTroca = useRef(false);
  useEffect(() => {
    if (modo === "exibir" || troca) return;
    if (jaPerguntouTroca.current) return;
    if (telasOutroProjeto.length > 0) {
      jaPerguntouTroca.current = true;
      setPopupTroca(true);
    }
  }, [telasOutroProjeto.length, modo, troca]);

  const trocarEmTodas = useCallback(() => {
    if (cardAtivoRef.current) enviarTroca(cardAtivoRef.current, textoAtivo, tituloAtivo);
    setPopupTroca(false);
  }, [enviarTroca, textoAtivo, tituloAtivo]);

  // Limpa o timer do aviso de troca ao desmontar.
  useEffect(
    () => () => {
      if (msgTrocaTimer.current) window.clearTimeout(msgTrocaTimer.current);
    },
    []
  );

  // Salva o papel deste aparelho (para reabrir ja na funcao certa).
  useEffect(() => {
    try {
      window.localStorage.setItem(CHAVE_PAPEL, JSON.stringify({ nome, modo }));
    } catch {
      // ignora
    }
  }, [nome, modo]);

  // Persiste a ultima config (velocidade, fonte, espelho): o proximo roteiro do
  // dia ja abre com os mesmos ajustes, sem precisar refazer.
  useEffect(() => {
    try {
      window.localStorage.setItem(
        CHAVE_CONFIG,
        JSON.stringify({ velocidade, tamanho, espelhoH })
      );
    } catch {
      // ignora
    }
  }, [velocidade, tamanho, espelhoH]);

  const transmitir = useCallback(
    (extra: Partial<ControleTeleprompter>) => {
      enviarControle({
        tocando: tocandoRef.current,
        velocidade: velocidadeRef.current,
        tamanho: tamanhoRef.current,
        posicaoPct: pctAtual(),
        saltar: false,
        remoto: remotoRef.current,
        ...extra,
      });
    },
    [enviarControle, pctAtual]
  );

  useEffect(() => {
    if (saltoToken === 0) return;
    aplicarPct(pctPendenteRef.current);
  }, [saltoToken, aplicarPct]);

  // Salto por FRASE recebido do remoto: centraliza a frase (ate parado).
  useEffect(() => {
    if (saltoFbToken === 0 || pendFbRef.current === null) return;
    const el = areaRef.current;
    if (el) el.scrollTop = alvoScrollDeFb(pendFbRef.current);
  }, [saltoFbToken, alvoScrollDeFb]);

  // Telas de exibicao: remede os topos das frases quando o layout muda
  // (texto, fonte, tela cheia, redimensionamento). Sem isso o "seguir por
  // frase" centralizaria a frase errada.
  useEffect(() => {
    if (remoto) return; // o remoto nao renderiza o texto
    recomputarTopos();
    const el = areaRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", recomputarTopos);
      return () => window.removeEventListener("resize", recomputarTopos);
    }
    const ro = new ResizeObserver(() => recomputarTopos());
    ro.observe(el);
    window.addEventListener("resize", recomputarTopos);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recomputarTopos);
    };
  }, [remoto, blocos, tamanho, telaCheia, espelhoH, recomputarTopos]);

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
      if (!Number.isFinite(v)) return;
      const nv = Math.min(VEL_MAX, Math.max(VEL_MIN, +v.toFixed(2)));
      velocidadeRef.current = nv;
      setVelocidade(nv);
      transmitir({});
    },
    [transmitir]
  );

  const mudarTamanho = useCallback(
    (t: number) => {
      if (!Number.isFinite(t)) return;
      const nt = Math.min(FONTE_MAX, Math.max(FONTE_MIN, Math.round(t)));
      tamanhoRef.current = nt;
      setTamanho(nt);
      transmitir({});
    },
    [transmitir]
  );

  // Controle remoto: vai para a frase `f` (fracao de bloco) e manda as telas
  // centralizarem essa frase. Mantem a posicao em caracteres coerente.
  const irParaFb = useCallback(
    (f: number) => {
      const alvo = Math.min(totalFrases, Math.max(0, f));
      fbRef.current = alvo;
      setFb(alvo);
      cpRef.current = cpDeFb(alvo);
      transmitir({ saltar: true, fbSaltar: alvo });
    },
    [totalFrases, cpDeFb, transmitir]
  );

  const reiniciar = useCallback(() => {
    tocandoRef.current = false;
    setTocando(false);
    if (remotoRef.current) {
      irParaFb(0);
      return;
    }
    aplicarPct(0);
    transmitir({ posicaoPct: 0, saltar: true });
  }, [aplicarPct, transmitir, irParaFb]);

  const pular = useCallback(
    (dir: number) => {
      if (remotoRef.current) {
        // No remoto, avanca/retrocede uma FRASE inteira.
        const alvo = dir > 0 ? Math.floor(fbRef.current) + 1 : Math.ceil(fbRef.current) - 1;
        irParaFb(alvo);
        return;
      }
      const el = areaRef.current;
      if (!el) return;
      const max = Math.max(1, el.scrollHeight - el.clientHeight);
      const novo = Math.min(1, Math.max(0, (el.scrollTop + dir * el.clientHeight * 0.45) / max));
      el.scrollTop = novo * max;
      transmitir({ posicaoPct: novo, saltar: true });
    },
    [transmitir, irParaFb]
  );

  const sincronizar = useCallback(() => {
    transmitir({ posicaoPct: pctAtual(), saltar: true });
  }, [transmitir, pctAtual]);

  const definirPapel = useCallback((novoNome: string, novoModo: ModoTela) => {
    setNome(novoNome);
    setModo(novoModo);
  }, []);

  const alternarTelaCheia = useCallback(() => {
    if (elementoTelaCheia()) sairTelaCheia();
    else if (containerRef.current) pedirTelaCheia(containerRef.current);
  }, []);

  // Acompanha entrar/sair da tela cheia (inclusive quando o usuario usa o gesto/Esc).
  useEffect(() => {
    const aoMudar = () => setTelaCheia(Boolean(elementoTelaCheia()));
    document.addEventListener("fullscreenchange", aoMudar);
    document.addEventListener("webkitfullscreenchange", aoMudar);
    return () => {
      document.removeEventListener("fullscreenchange", aoMudar);
      document.removeEventListener("webkitfullscreenchange", aoMudar);
    };
  }, []);

  // Fecha com Esc (em captura, para nao fechar tambem o modal por baixo).
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        e.preventDefault();
        if (popupTroca) setPopupTroca(false);
        else if (painelTelas) setPainelTelas(false);
        else if (elementoTelaCheia()) sairTelaCheia(); // Esc so sai da tela cheia
        else onFechar();
      }
    }
    window.addEventListener("keydown", aoTeclar, true);
    return () => window.removeEventListener("keydown", aoTeclar, true);
  }, [onFechar, painelTelas, popupTroca]);

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  // Loop unico:
  // - "Acompanhar" ligado e recebendo a guia -> desliza suavemente ate a posicao
  //   relativa dela (easing), sem rolar sozinho (sem tranco, tolera tamanhos diferentes).
  // - Senao, se estiver tocando -> rola sozinho na velocidade compartilhada e, se NAO
  //   estiver acompanhando, transmite a propria posicao (~4x/s) para quem acompanha.
  // - Se a guia some (sem posicao ha >1.2s), quem acompanha volta a rolar sozinho.
  useEffect(() => {
    if (remoto) return; // o controle remoto nao rola texto (tem seu proprio loop)
    if (!tocando && !seguir) return;
    let raf = 0;
    let ultimoEnvio = 0;
    let envPct = pctAtual(); // posicao no ultimo envio (guia)
    let envT = Date.now();
    let velSuave = 0; // velocidade relativa suavizada (guia)
    const passo = () => {
      const el = areaRef.current;
      if (el) {
        const agoraMs = Date.now();
        const dtGuia = agoraMs - guiaQuandoRef.current;
        const recebendoGuia = dtGuia < 1200;
        const dtRem = agoraMs - remQuandoRef.current;
        if (guiaRemotoRef.current) {
          // A guia e um controle remoto: seguimos a FRASE (independe do tamanho
          // da tela). Nunca rolamos sozinhos aqui.
          if (dtRem < 1500) {
            const dtPred = Math.min(dtRem, 400);
            const fbAlvo = remFbRef.current + remVelRef.current * dtPred;
            const alvo = alvoScrollDeFb(fbAlvo);
            const delta = alvo - el.scrollTop;
            // Salto grande (trocar de frase / scrub): vai direto; senao desliza.
            el.scrollTop += Math.abs(delta) > el.clientHeight ? delta : delta * 0.18;
          }
        } else if (seguir && recebendoGuia) {
          // Extrapola a posicao da guia (posicao + velocidade) e desliza ate ela.
          // Continua suave mesmo recebendo poucas atualizacoes e em telas diferentes.
          const max = Math.max(1, el.scrollHeight - el.clientHeight);
          const dtPred = Math.min(dtGuia, 500); // nao extrapola alem de meio segundo
          const alvoPct = Math.min(1, Math.max(0, guiaPctRef.current + guiaVelRef.current * dtPred));
          const alvo = alvoPct * max;
          const delta = alvo - el.scrollTop;
          // Salto grande (sincronizar/pular): vai direto; senao desliza suave.
          el.scrollTop += Math.abs(delta) > el.clientHeight ? delta : delta * 0.2;
        } else if (tocando) {
          el.scrollTop += velocidade;
          if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
            tocandoRef.current = false;
            setTocando(false);
            return;
          }
          // A guia transmite posicao + velocidade relativa (para quem acompanha extrapolar).
          if (!seguir && agoraMs - ultimoEnvio > 120) {
            const max = Math.max(1, el.scrollHeight - el.clientHeight);
            const pctNow = Math.min(1, Math.max(0, el.scrollTop / max));
            const dt = agoraMs - envT;
            if (dt > 0) {
              const velNova = (pctNow - envPct) / dt;
              velSuave = velSuave * 0.5 + velNova * 0.5; // suaviza ruido
            }
            enviarPosicao(pctNow, velSuave);
            envPct = pctNow;
            envT = agoraMs;
            ultimoEnvio = agoraMs;
          }
        }
      }
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [remoto, tocando, seguir, velocidade, enviarPosicao, pctAtual, alvoScrollDeFb]);

  // Controle remoto: avanco por FRASE ao longo do tempo. Anda em "caracteres"
  // (frases longas demoram mais), converte para fracao de bloco e transmite a
  // posicao para as telas seguirem. A velocidade controla o ritmo; o tamanho da
  // tela nao importa. Ao chegar no fim, pausa.
  useEffect(() => {
    if (!remoto || !tocando) return;
    let raf = 0;
    let ultimoT = Date.now();
    let ultimoEnvio = 0;
    let envFb = fbRef.current;
    let envT = Date.now();
    const passo = () => {
      const agora = Date.now();
      const dt = agora - ultimoT;
      ultimoT = agora;
      const cps = velocidadeRef.current * CARACT_POR_VEL;
      cpRef.current = Math.min(medidas.total, cpRef.current + (cps * dt) / 1000);
      const nfb = fbDeCp(cpRef.current);
      fbRef.current = nfb;
      setFb(nfb);
      if (agora - ultimoEnvio > 90) {
        const dtE = agora - envT;
        const vel = dtE > 0 ? (nfb - envFb) / dtE : 0;
        enviarPosicaoRemota(nfb, vel);
        envFb = nfb;
        envT = agora;
        ultimoEnvio = agora;
      }
      if (cpRef.current >= medidas.total) {
        tocandoRef.current = false;
        setTocando(false);
        enviarPosicaoRemota(nfb, 0);
        transmitir({});
        return;
      }
      raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [remoto, tocando, medidas.total, fbDeCp, enviarPosicaoRemota, transmitir]);

  const limpa = modo === "exibir";
  const outras = telas.filter((t) => t.id !== meuId);
  const tamMarca = Math.max(13, Math.round(tamanho * 0.4)); // etiqueta menor que a fala
  const btn = "rounded-marca bg-white/10 text-white transition hover:bg-white/20 active:bg-white/30";
  // Botoes flutuantes redondos com leve animacao ao tocar.
  const fab =
    "flex items-center justify-center rounded-full bg-white/12 text-white transition-transform duration-100 hover:bg-white/20 active:scale-90";
  const fabSec =
    "flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-transform duration-100 hover:bg-white/20 active:scale-90";

  // Preenchimento das barras liquidas (0..100%) conforme o valor atual.
  const pctVel = ((velocidade - VEL_MIN) / (VEL_MAX - VEL_MIN)) * 100;
  const pctFonte = ((tamanho - FONTE_MIN) / (FONTE_MAX - FONTE_MIN)) * 100;
  const fundoSlider = (p: number) =>
    `linear-gradient(to right, #FA611E 0%, #FA611E ${p}%, rgba(255,255,255,0.18) ${p}%, rgba(255,255,255,0.18) 100%)`;

  // Controle remoto: frase atual e vizinhas (para o preview) + posicao na barra.
  const iAtual = totalFrases > 0 ? Math.min(totalFrases - 1, Math.max(0, Math.floor(fb))) : 0;
  const fracAtual = Math.min(1, Math.max(0, fb - iAtual));
  const pctFrase = totalFrases > 0 ? (fb / totalFrases) * 100 : 0;
  const noFim = totalFrases > 0 && fb >= totalFrases - 0.001;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[60] flex flex-col bg-[#0b0d12] text-white animate-fadeIn"
    >
      {/* Controles flutuantes na parte de baixo (preferencia do usuario). */}
      {!limpa && !remoto && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center p-3">
          <div className="pointer-events-auto w-full max-w-xl rounded-2xl border border-white/10 bg-black/50 p-3 shadow-2xl backdrop-blur-md">
            {/* Acoes secundarias */}
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {cardId && (
                  <button
                    type="button"
                    onClick={() => setPainelTelas(true)}
                    title="Telas conectadas"
                    className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white transition-transform duration-100 hover:bg-white/20 active:scale-90"
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
                  onClick={reiniciar}
                  title="Reiniciar do topo"
                  aria-label="Reiniciar do topo"
                  className={fabSec}
                >
                  <RotateCcw size={16} aria-hidden />
                </button>
                {telasOutroProjeto.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPopupTroca(true)}
                    title="Rodar este roteiro em todas as telas abertas"
                    aria-label="Rodar em todas as telas"
                    className={`relative ${fabSec}`}
                  >
                    <MonitorUp size={16} aria-hidden />
                    <span className="absolute -right-1 -top-1 rounded-full bg-marca-laranja px-1 text-[10px] font-bold text-white">
                      {telasOutroProjeto.length}
                    </span>
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setEspelhoH((e) => !e)}
                  aria-pressed={espelhoH}
                  title="Espelho para o vidro do teleprompter"
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-100 active:scale-90 ${
                    espelhoH ? "bg-marca-laranja text-white" : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  <FlipHorizontal size={16} aria-hidden />
                </button>
                {suportaTelaCheia && (
                  <button
                    type="button"
                    onClick={alternarTelaCheia}
                    title={telaCheia ? "Sair da tela cheia" : "Tela cheia (esconde as barras)"}
                    aria-label={telaCheia ? "Sair da tela cheia" : "Tela cheia"}
                    className={fabSec}
                  >
                    {telaCheia ? <Minimize size={16} aria-hidden /> : <Maximize size={16} aria-hidden />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => definirPapel("Controle remoto", "remoto")}
                  title="Virar controle remoto de bolso (so a frase + barra)"
                  aria-label="Virar controle remoto"
                  className={fabSec}
                >
                  <Gamepad2 size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => definirPapel("Teleprompter", "exibir")}
                  title="Deixar esta tela limpa (so o texto)"
                  aria-label="Deixar a tela limpa"
                  className={fabSec}
                >
                  <MonitorPlay size={16} aria-hidden />
                </button>
                <button type="button" onClick={onFechar} title="Fechar" aria-label="Fechar" className={fabSec}>
                  <X size={16} aria-hidden />
                </button>
              </div>
            </div>

            {/* Transporte: voltar, rolar/pausar (grande), avancar, reiniciar */}
            <div className="mb-3 flex items-center justify-center gap-3 sm:gap-4">
              <button
                type="button"
                onClick={() => pular(-1)}
                title="Voltar um trecho"
                aria-label="Voltar um trecho"
                className={`${fab} h-12 w-12`}
              >
                <SkipBack size={22} aria-hidden />
              </button>
              <button
                type="button"
                onClick={alternarTocando}
                aria-label={tocando ? "Pausar" : "Rolar"}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-marca-laranja text-white shadow-lg transition-transform duration-100 hover:brightness-110 active:scale-95"
              >
                {tocando ? <Pause size={30} aria-hidden /> : <Play size={30} aria-hidden className="ml-0.5" />}
              </button>
              <button
                type="button"
                onClick={() => pular(1)}
                title="Avançar um trecho"
                aria-label="Avançar um trecho"
                className={`${fab} h-12 w-12`}
              >
                <SkipForward size={22} aria-hidden />
              </button>
            </div>

            {/* Acompanhar a guia: esta tela espelha a posicao de quem esta rolando. */}
            {cardId && ativo && (
              <div className="mb-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => setSeguir((s) => !s)}
                  aria-pressed={seguir}
                  title={
                    seguir
                      ? "Acompanhando a guia (rola junto, suave)"
                      : "Acompanhar a tela que esta rolando"
                  }
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-transform duration-100 active:scale-90 ${
                    seguir ? "bg-marca-verde text-white" : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  <Link2 size={15} aria-hidden />
                  {seguir ? "Acompanhando" : "Acompanhar a guia"}
                </button>
              </div>
            )}

            {/* Barras liquidas: velocidade e tamanho da fonte (escala fluida).
                Ao lado, um campo com o numero para ajustar/digitar direto. */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Turtle size={18} aria-hidden className="shrink-0 text-white/55" />
                <input
                  type="range"
                  min={VEL_MIN}
                  max={VEL_MAX}
                  step={0.01}
                  value={velocidade}
                  onChange={(e) => mudarVelocidade(parseFloat(e.target.value))}
                  aria-label="Velocidade"
                  className="tp-slider flex-1"
                  style={{ background: fundoSlider(pctVel) }}
                />
                <Rabbit size={18} aria-hidden className="shrink-0 text-white/55" />
                <input
                  type="number"
                  min={VEL_MIN}
                  max={VEL_MAX}
                  step={0.01}
                  value={velTexto ?? String(velocidade)}
                  onChange={(e) => {
                    setVelTexto(e.target.value);
                    const n = parseFloat(e.target.value);
                    if (Number.isFinite(n)) mudarVelocidade(n);
                  }}
                  onBlur={() => setVelTexto(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                  aria-label="Velocidade (número)"
                  className="tp-num shrink-0"
                />
              </div>
              <div className="flex items-center gap-3">
                <Type size={14} aria-hidden className="shrink-0 text-white/55" />
                <input
                  type="range"
                  min={FONTE_MIN}
                  max={FONTE_MAX}
                  step={2}
                  value={tamanho}
                  onChange={(e) => mudarTamanho(parseInt(e.target.value, 10))}
                  aria-label="Tamanho da fonte"
                  className="tp-slider flex-1"
                  style={{ background: fundoSlider(pctFonte) }}
                />
                <Type size={22} aria-hidden className="shrink-0 text-white/55" />
                <input
                  type="number"
                  min={FONTE_MIN}
                  max={FONTE_MAX}
                  step={1}
                  value={tamTexto ?? String(tamanho)}
                  onChange={(e) => {
                    setTamTexto(e.target.value);
                    const n = parseInt(e.target.value, 10);
                    if (Number.isFinite(n)) mudarTamanho(n);
                  }}
                  onBlur={() => setTamTexto(null)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                  aria-label="Tamanho da fonte (número)"
                  className="tp-num shrink-0"
                />
              </div>
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
          {suportaTelaCheia && (
            <button
              type="button"
              onClick={alternarTelaCheia}
              title={telaCheia ? "Sair da tela cheia" : "Tela cheia"}
              className={`${btn} p-2`}
              aria-label={telaCheia ? "Sair da tela cheia" : "Tela cheia"}
            >
              {telaCheia ? <Minimize size={18} aria-hidden /> : <Maximize size={18} aria-hidden />}
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
          (evita pausar sem querer enquanto o ator le). O controle remoto nao
          mostra o texto rolando (tem seu proprio painel). */}
      {!remoto && (
      <div
        ref={areaRef}
        onClick={limpa ? undefined : alternarTocando}
        className={`flex-1 overflow-y-auto overscroll-contain px-5 sm:px-16 ${
          limpa ? "py-12 sm:py-16" : "cursor-pointer pt-12 pb-[250px] sm:pt-16"
        }`}
      >
        <div className="mx-auto max-w-4xl" style={{ transform: `scaleX(${espelhoH ? -1 : 1})` }}>
          {/* Folga de rolagem no topo: o texto comeca mais para o meio da tela,
              com espaco livre acima, em vez de colado no topo (melhor para gravar). */}
          <div className="h-[42vh]" aria-hidden />
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
                  ref={(n) => {
                    blocosDomRef.current[i] = n;
                  }}
                  className="mb-1 mt-6 block text-center font-bold uppercase tracking-widest first:mt-0"
                  style={{ fontSize: `${tamMarca}px`, color: "#EC1313", lineHeight: 1.2 }}
                >
                  {b.conteudo}
                </span>
              ) : (
                <p
                  key={i}
                  ref={(n) => {
                    blocosDomRef.current[i] = n;
                  }}
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
      )}

      {/* Indicador discreto do controle ao vivo (no topo, ja que os controles
          agora ficam embaixo). So no modo controle. */}
      {!limpa && !remoto && (
        <div className="pointer-events-none absolute top-2 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-center">
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

      {/* ============================ CONTROLE REMOTO ============================
          Painel de bolso: mostra so a frase atual (com as vizinhas esmaecidas),
          uma barra arrastavel na linha do tempo do texto e os botoes. Comanda as
          telas de exibicao POR FRASE, entao acompanha igual em qualquer tamanho
          de tela. Funciona em retrato e em paisagem (celular deitado / laptop). */}
      {remoto && (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Barra superior */}
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 sm:px-5">
            <div className="flex min-w-0 items-center gap-2">
              <MonitorSmartphone size={18} className="shrink-0 text-marca-laranja" aria-hidden />
              <span className="truncate text-sm font-bold">Controle remoto</span>
              {ativo && (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-marca-verde/15 px-2 py-0.5 text-[11px] font-semibold text-marca-verde">
                  <Radio size={11} aria-hidden />
                  <span className="hidden sm:inline">ao vivo</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {telasOutroProjeto.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPopupTroca(true)}
                  title="Rodar este roteiro em todas as telas abertas"
                  aria-label="Rodar em todas as telas"
                  className={`relative ${fabSec}`}
                >
                  <MonitorUp size={16} aria-hidden />
                  <span className="absolute -right-1 -top-1 rounded-full bg-marca-laranja px-1 text-[10px] font-bold text-white">
                    {telasOutroProjeto.length}
                  </span>
                </button>
              )}
              {cardId && (
                <button
                  type="button"
                  onClick={() => setPainelTelas(true)}
                  title="Telas conectadas"
                  aria-label="Telas conectadas"
                  className={`relative ${fabSec}`}
                >
                  <Users size={16} aria-hidden />
                  {ativo && telas.length > 0 && (
                    <span className="absolute -right-1 -top-1 rounded-full bg-marca-verde px-1 text-[10px] font-bold text-white">
                      {telas.length}
                    </span>
                  )}
                </button>
              )}
              {suportaTelaCheia && (
                <button
                  type="button"
                  onClick={alternarTelaCheia}
                  title={telaCheia ? "Sair da tela cheia" : "Tela cheia"}
                  aria-label={telaCheia ? "Sair da tela cheia" : "Tela cheia"}
                  className={fabSec}
                >
                  {telaCheia ? <Minimize size={16} aria-hidden /> : <Maximize size={16} aria-hidden />}
                </button>
              )}
              <button
                type="button"
                onClick={() => definirPapel("Controle", "controle")}
                title="Ver o texto completo nesta tela"
                aria-label="Ver o texto completo"
                className={fabSec}
              >
                <Sliders size={16} aria-hidden />
              </button>
              <button type="button" onClick={onFechar} title="Fechar" aria-label="Fechar" className={fabSec}>
                <X size={16} aria-hidden />
              </button>
            </div>
          </div>

          {/* Miolo: preview da frase + painel de comandos. Em tela baixa (celular
              deitado) os dois ficam lado a lado; senao empilhados. */}
          <div className="flex min-h-0 flex-1 flex-col baixo:flex-row">
            {/* Preview: frase anterior (esmaecida), atual (grande) e proxima */}
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-5 py-4 text-center sm:px-10">
              {totalFrases === 0 ? (
                <p className="text-white/50">Sem roteiro para exibir.</p>
              ) : (
                <>
                  <p className="line-clamp-2 max-w-2xl text-sm text-white/25 sm:text-lg">
                    {iAtual > 0 ? blocos[iAtual - 1].conteudo : ""}
                  </p>
                  <div className="w-full max-w-2xl">
                    <p
                      className={`leading-snug ${
                        blocos[iAtual].tipo === "marca"
                          ? "text-xl font-bold uppercase tracking-widest text-marca-vermelho sm:text-3xl"
                          : "text-2xl font-bold text-white sm:text-4xl"
                      }`}
                    >
                      {blocos[iAtual].conteudo}
                    </p>
                    <div className="mx-auto mt-3.5 h-1 w-36 overflow-hidden rounded-full bg-white/12">
                      <div
                        className="h-full rounded-full bg-marca-laranja transition-[width] duration-100"
                        style={{ width: `${fracAtual * 100}%` }}
                      />
                    </div>
                  </div>
                  <p className="line-clamp-2 max-w-2xl text-sm text-white/25 sm:text-lg">
                    {iAtual < totalFrases - 1
                      ? blocos[iAtual + 1].conteudo
                      : noFim
                        ? "Fim do texto"
                        : ""}
                  </p>
                </>
              )}
            </div>

            {/* Comandos: barra arrastavel + transporte + velocidade/fonte */}
            <div className="shrink-0 border-t border-white/10 bg-black/30 px-4 py-3.5 backdrop-blur-md baixo:w-[380px] baixo:overflow-y-auto baixo:border-l baixo:border-t-0 sm:px-6">
              <div className="mx-auto flex max-w-xl flex-col gap-3.5">
                {/* Barra da linha do tempo (arrastavel: volta e avanca) */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-white/55">
                    <span>
                      Frase {Math.min(iAtual + 1, totalFrases)} de {totalFrases}
                    </span>
                    <span>{Math.round(pctFrase)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(0.001, totalFrases)}
                    step={0.001}
                    value={fb}
                    onChange={(e) => irParaFb(parseFloat(e.target.value))}
                    disabled={totalFrases === 0}
                    aria-label="Posição no texto"
                    className="tp-slider w-full disabled:opacity-40"
                    style={{ background: fundoSlider(pctFrase) }}
                  />
                </div>

                {/* Transporte */}
                <div className="flex items-center justify-center gap-3 sm:gap-4">
                  <button
                    type="button"
                    onClick={reiniciar}
                    title="Reiniciar do começo"
                    aria-label="Reiniciar do começo"
                    className={`${fab} h-10 w-10`}
                  >
                    <RotateCcw size={18} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => pular(-1)}
                    title="Frase anterior"
                    aria-label="Frase anterior"
                    className={`${fab} h-12 w-12`}
                  >
                    <SkipBack size={22} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={alternarTocando}
                    aria-label={tocando ? "Pausar" : "Iniciar"}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-marca-laranja text-white shadow-lg transition-transform duration-100 hover:brightness-110 active:scale-95"
                  >
                    {tocando ? <Pause size={30} aria-hidden /> : <Play size={30} aria-hidden className="ml-0.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => pular(1)}
                    title="Próxima frase"
                    aria-label="Próxima frase"
                    className={`${fab} h-12 w-12`}
                  >
                    <SkipForward size={22} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEspelhoH((e) => !e)}
                    aria-pressed={espelhoH}
                    title="Espelho para o vidro do teleprompter"
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition-transform duration-100 active:scale-90 ${
                      espelhoH ? "bg-marca-laranja text-white" : "bg-white/12 text-white hover:bg-white/20"
                    }`}
                  >
                    <FlipHorizontal size={18} aria-hidden />
                  </button>
                </div>

                {/* Velocidade e tamanho da fonte (valem para as telas) */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-3">
                    <Turtle size={18} aria-hidden className="shrink-0 text-white/55" />
                    <input
                      type="range"
                      min={VEL_MIN}
                      max={VEL_MAX}
                      step={0.01}
                      value={velocidade}
                      onChange={(e) => mudarVelocidade(parseFloat(e.target.value))}
                      aria-label="Velocidade"
                      className="tp-slider flex-1"
                      style={{ background: fundoSlider(pctVel) }}
                    />
                    <Rabbit size={18} aria-hidden className="shrink-0 text-white/55" />
                    <input
                      type="number"
                      min={VEL_MIN}
                      max={VEL_MAX}
                      step={0.01}
                      value={velTexto ?? String(velocidade)}
                      onChange={(e) => {
                        setVelTexto(e.target.value);
                        const n = parseFloat(e.target.value);
                        if (Number.isFinite(n)) mudarVelocidade(n);
                      }}
                      onBlur={() => setVelTexto(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                      aria-label="Velocidade (número)"
                      className="tp-num shrink-0"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Type size={14} aria-hidden className="shrink-0 text-white/55" />
                    <input
                      type="range"
                      min={FONTE_MIN}
                      max={FONTE_MAX}
                      step={2}
                      value={tamanho}
                      onChange={(e) => mudarTamanho(parseInt(e.target.value, 10))}
                      aria-label="Tamanho da fonte"
                      className="tp-slider flex-1"
                      style={{ background: fundoSlider(pctFonte) }}
                    />
                    <Type size={22} aria-hidden className="shrink-0 text-white/55" />
                    <input
                      type="number"
                      min={FONTE_MIN}
                      max={FONTE_MAX}
                      step={1}
                      value={tamTexto ?? String(tamanho)}
                      onChange={(e) => {
                        setTamTexto(e.target.value);
                        const n = parseInt(e.target.value, 10);
                        if (Number.isFinite(n)) mudarTamanho(n);
                      }}
                      onBlur={() => setTamTexto(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      }}
                      aria-label="Tamanho da fonte (número)"
                      className="tp-num shrink-0"
                    />
                  </div>
                </div>

                {!ativo && (
                  <p className="text-center text-[11px] text-white/40">
                    Abra o teleprompter em outra tela (no card) para comandá-la daqui.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Aviso breve: esta tela acabou de ser trocada para outro projeto. */}
      {msgTroca && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-marca-laranja px-4 py-2 text-sm font-semibold text-white shadow-lg animate-slideUp">
          <MonitorUp size={15} aria-hidden /> Trocado para {msgTroca}
        </div>
      )}

      {/* Popup: rodar este roteiro em todas as telas abertas em outro projeto. */}
      {popupTroca && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-4 animate-fadeIn"
          onClick={() => setPopupTroca(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-marca bg-white text-marca-preto shadow-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 bg-marca-azulEscuro px-4 py-3 text-white">
              <MonitorUp size={16} aria-hidden />
              <h2 className="text-sm font-bold">Rodar em todas as telas?</h2>
            </div>
            <div className="space-y-3 px-4 py-4">
              <p className="text-sm text-marca-preto">
                {telasOutroProjeto.length === 1
                  ? "Há 1 tela de teleprompter aberta"
                  : `Há ${telasOutroProjeto.length} telas de teleprompter abertas`}{" "}
                em outro projeto. Trocar {telasOutroProjeto.length === 1 ? "ela" : "todas"} para{" "}
                <span className="font-bold">
                  {tituloAtivo?.trim() ? `"${tituloAtivo}"` : "este roteiro"}
                </span>{" "}
                agora?
              </p>
              <p className="text-xs text-marca-cinza">
                O texto muda na hora em cada aparelho, sem precisar mexer nas outras telas.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPopupTroca(false)}
                  className="flex-1 rounded-marca border border-marca-cinza/40 px-3 py-2 text-sm font-semibold text-marca-azulEscuro transition hover:bg-marca-branco"
                >
                  Agora não
                </button>
                <button
                  type="button"
                  onClick={trocarEmTodas}
                  className="flex-1 rounded-marca bg-marca-laranja px-3 py-2 text-sm font-bold text-white transition hover:brightness-95"
                >
                  Sim, trocar tudo
                </button>
              </div>
            </div>
          </div>
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
                  <BotaoPapel ativo={remoto} onClick={() => definirPapel("Controle remoto", "remoto")}>
                    Controle remoto
                  </BotaoPapel>
                  <BotaoPapel
                    ativo={!limpa && !remoto && nome === "Ator"}
                    onClick={() => definirPapel("Ator", "controle")}
                  >
                    Ator
                  </BotaoPapel>
                  <BotaoPapel
                    ativo={!limpa && !remoto && nome === "Cinegrafista"}
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
  const ehRemoto = tela.modo === "remoto";
  const rotulo = limpa ? "Tela limpa" : ehRemoto ? "Controle remoto" : "Controle";
  return (
    <div className="flex items-center gap-2 rounded-marca border border-marca-cinza/30 bg-white p-2">
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-marca text-white ${
          limpa ? "bg-marca-azulEscuro" : ehRemoto ? "bg-marca-azulClaro" : "bg-marca-laranja"
        }`}
      >
        {limpa ? (
          <MonitorPlay size={15} aria-hidden />
        ) : ehRemoto ? (
          <MonitorSmartphone size={15} aria-hidden />
        ) : (
          <Sliders size={15} aria-hidden />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-marca-preto">{tela.nome}</span>
        <span className="block text-[11px] text-marca-cinza">{rotulo}</span>
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
