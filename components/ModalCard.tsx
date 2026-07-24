"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Trash2,
  Check,
  Save,
  Copy,
  MonitorPlay,
  MonitorSmartphone,
  Send,
  RotateCcw,
  Clock,
  CheckCircle2,
  Share2,
  Timer,
  LayoutGrid,
  ListChecks,
  ClipboardList,
  Clapperboard,
  MessageSquareText,
  Lightbulb,
  Link2,
  Maximize2,
  Minimize2,
  Flag,
  type LucideIcon,
} from "lucide-react";
import {
  CANAIS,
  CANAIS_ORDEM,
  LIMITE_LEGENDA_PADRAO,
  PRIORIDADES,
  PRIORIDADES_ORDEM,
  TIPOS,
  TIPOS_ORDEM,
  campanhaArquivada,
} from "@/lib/config";
import { useBoard } from "@/lib/store";
import { useApontamentos } from "@/lib/apontamentosProvider";
import { formatarDuracao } from "@/lib/apontamentos";
import { useCanalTeleprompter, type ModoTela } from "@/lib/teleprompterAoVivo";
import type { Canal, CardConteudo, Etapa, Prioridade, TipoConteudo } from "@/lib/types";
import { agora, formatarData } from "@/lib/util";
import { criarProjetoVazio } from "@/lib/projeto";
import Teleprompter from "./Teleprompter";
import AbaProjeto from "./projeto/AbaProjeto";
import LinhaDoTempoProjeto, { type ServicoNaLinha } from "./apontamentos/LinhaDoTempoProjeto";
import ModalCompartilhar from "./ModalCompartilhar";
import SeletorData from "./SeletorData";
import SeletorHora from "./SeletorHora";
import SeletorOpcao from "./SeletorOpcao";

type Aba = "visao" | "projeto" | "briefing" | "roteiro" | "legenda" | "linha";

// Cada aba leva um icone para a troca ficar visual e intuitiva (pilulas no topo).
const ABAS: { id: Aba; rotulo: string; icone: LucideIcon }[] = [
  { id: "visao", rotulo: "Visão Geral", icone: LayoutGrid },
  { id: "briefing", rotulo: "Briefing", icone: ClipboardList },
  { id: "roteiro", rotulo: "Roteiro", icone: Clapperboard },
  { id: "legenda", rotulo: "Legenda", icone: MessageSquareText },
];

const inputClasse =
  "w-full rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 text-sm text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40";

/**
 * Modal de detalhe do card, com abas editaveis e salvamento automatico.
 * Cada alteracao e persistida na hora (via store); os botoes apenas
 * confirmam a acao para o usuario.
 */
export default function ModalCard({
  card,
  onFechar,
}: {
  card: CardConteudo;
  onFechar: () => void;
}) {
  const {
    cards,
    campanhas,
    marcas,
    etapas,
    etapaPostado,
    etapaPorId,
    campanhaPorId,
    atualizarCard,
    excluirCard,
    marcarPostado,
    reabrirCard,
  } = useBoard();
  const { iniciarTimer, totalMsDoCard, timerAtivo, registrosDoCard } = useApontamentos();
  // Canal ao vivo do teleprompter: recebe na hora o que o visitante digita no
  // link publico (e envia o que o time digita), nos dois sentidos.
  const { enviar: enviarTp } = useCanalTeleprompter(card.id, (texto) =>
    atualizarCard({ ...card, teleprompter: texto })
  );
  const [aba, setAba] = useState<Aba>("visao");
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [teleprompterAberto, setTeleprompterAberto] = useState(false);
  // Quando abre pelo botao "Controle remoto", ja entra nesse modo; pelo botao
  // "Teleprompter" respeita o papel salvo neste aparelho (undefined).
  const [modoTpInicial, setModoTpInicial] = useState<ModoTela | undefined>(undefined);
  const [copiado, setCopiado] = useState(false);
  const [copiadoTp, setCopiadoTp] = useState(false);
  const [copiadoLegenda, setCopiadoLegenda] = useState(false);
  const [compartilharAberto, setCompartilharAberto] = useState(false);
  // Maximizar: o card ocupa a tela inteira (visao completa). A preferencia fica
  // lembrada no aparelho, entao os proximos cards ja abrem do jeito escolhido.
  const [maximizado, setMaximizado] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("kando:card-maximizado") === "1";
    } catch {
      return false;
    }
  });
  function alternarMaximizado() {
    setMaximizado((m) => {
      const novo = !m;
      try {
        window.localStorage.setItem("kando:card-maximizado", novo ? "1" : "0");
      } catch {
        // sem localStorage: apenas nao lembra a preferencia
      }
      return novo;
    });
  }
  const tituloRef = useRef<HTMLInputElement>(null);
  // Botao "Salvar e fechar" flutuante no mobile: visivel enquanto rola; some
  // quando o rodape (com os outros dois botoes) aparece no fim do conteudo.
  const conteudoRef = useRef<HTMLDivElement>(null);
  const rodapeMobileRef = useRef<HTMLDivElement>(null);
  const [rodapeVisivel, setRodapeVisivel] = useState(false);

  // Bloqueia o scroll do fundo. Foca o titulo so no desktop (espacoso): no mobile,
  // focar abriria o teclado de cara, atrapalhando quem so quer ler/abrir o card
  // (roteiro, teleprompter). No celular o card abre sem foco nem teclado.
  useEffect(() => {
    const ehEspacoso =
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 640px) and (min-height: 500px)").matches;
    if (ehEspacoso) tituloRef.current?.focus();
    const overflowOriginal = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflowOriginal;
    };
  }, []);

  // Fecha com a tecla Esc.
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  // Observa o rodape do mobile: quando ele entra na tela (fim do conteudo), o
  // botao flutuante some e os tres botoes ficam juntos. Reconecta a cada troca
  // de aba (a altura muda) para a leitura ficar sempre correta.
  useEffect(() => {
    const alvo = rodapeMobileRef.current;
    if (!alvo) return;
    const obs = new IntersectionObserver(
      ([entrada]) => setRodapeVisivel(entrada.isIntersecting),
      { root: conteudoRef.current, threshold: 0.1 }
    );
    obs.observe(alvo);
    return () => obs.disconnect();
  }, [aba]);

  const ehProjeto = card.tipo === "projeto";
  // Roteiro e Teleprompter so fazem sentido em video: apenas Reels os mostra.
  const ehReels = card.tipo === "reels";
  // Servico e enxuto: sem briefing/roteiro/legenda; so a descricao, os projetos
  // cobertos e a linha do tempo (o timer dele conta em cada projeto coberto).
  const ehServico = card.tipo === "servico";

  // A aba Projeto so existe para cards do tipo projeto. Se o tipo mudar enquanto
  // a aba Projeto esta aberta, volta para a Visao Geral.
  useEffect(() => {
    if (aba === "projeto" && !ehProjeto) setAba("visao");
  }, [aba, ehProjeto]);

  // A aba Roteiro so existe em Reels. Se o tipo mudar com ela aberta, volta.
  useEffect(() => {
    if (aba === "roteiro" && !ehReels) setAba("visao");
  }, [aba, ehReels]);

  // Projeto nao precisa de Legenda (site, produto etc.). Se estiver nela, volta.
  useEffect(() => {
    if (aba === "legenda" && ehProjeto) setAba("visao");
  }, [aba, ehProjeto]);

  // Servico so tem Visao Geral e Linha do tempo. Se estiver noutra aba, volta.
  useEffect(() => {
    if (ehServico && (aba === "briefing" || aba === "roteiro" || aba === "legenda" || aba === "projeto")) {
      setAba("visao");
    }
  }, [ehServico, aba]);

  // Lista de abas: Projeto logo apos Visao Geral (so em projeto); Roteiro so em
  // Reels; Legenda em tudo menos projeto (que nao precisa de legenda).
  const abas: { id: Aba; rotulo: string; icone: LucideIcon }[] = ehServico
    ? [ABAS[0], { id: "linha" as Aba, rotulo: "Linha do tempo", icone: Clock }]
    : [
        ABAS[0], // Visao Geral
        ...(ehProjeto ? [{ id: "projeto" as Aba, rotulo: "Projeto", icone: ListChecks }] : []),
        ABAS[1], // Briefing
        ...(ehReels ? [ABAS[2]] : []), // Roteiro (so Reels)
        ...(ehProjeto ? [] : [ABAS[3]]), // Legenda (projeto nao precisa)
        { id: "linha" as Aba, rotulo: "Linha do tempo", icone: Clock }, // vale para todo card
      ];

  /**
   * Atualiza um campo e persiste imediatamente (auto-save).
   * A mesclagem usa sempre a versao mais recente do card vinda da store (fonte
   * unica de verdade), evitando sobrescrever mudancas feitas por outra origem
   * (por exemplo a etapa alterada por um arraste enquanto o modal esta aberto).
   */
  function atualizarCampo<K extends keyof CardConteudo>(campo: K, valor: CardConteudo[K]) {
    atualizarCard({ ...card, [campo]: valor });
  }

  /**
   * Troca a etapa pelo select, gerenciando o carimbo de postado igual as acoes
   * rapidas: ao entrar em "publicado" registra postadoEm; ao sair, limpa.
   */
  function mudarEtapa(nova: Etapa) {
    atualizarCard({
      ...card,
      etapa: nova,
      postadoEm: nova === etapaPostado.id ? (card.postadoEm ?? agora()) : undefined,
    });
  }

  /**
   * Troca o tipo. Ao virar projeto, garante as fases sugeridas (sem apagar um
   * projeto que ja exista, caso o usuario alterne os tipos de ida e volta).
   */
  function mudarTipo(tipo: TipoConteudo) {
    atualizarCard({
      ...card,
      tipo,
      projeto: tipo === "projeto" ? (card.projeto ?? criarProjetoVazio()) : card.projeto,
    });
  }

  /** Marca o card para o robo publicar no horario (Facebook e/ou Instagram). */
  function agendarAuto() {
    atualizarCard({ ...card, statusPub: "agendado", erroPub: undefined });
  }

  /** Cancela o agendamento automatico (volta ao estado normal). */
  function cancelarAuto() {
    atualizarCard({ ...card, statusPub: undefined, erroPub: undefined });
  }

  // Estabiliza o onFechar do teleprompter para nao recriar o listener de Esc.
  const fecharTeleprompter = useCallback(() => setTeleprompterAberto(false), []);

  /** Marca ou desmarca um canal. */
  function alternarCanal(canal: Canal) {
    const marcado = card.canais.includes(canal);
    const canais = marcado
      ? card.canais.filter((c) => c !== canal)
      : [...card.canais, canal];
    atualizarCampo("canais", canais);
  }

  function confirmarExclusao() {
    excluirCard(card.id);
    onFechar();
  }

  /** Copia o roteiro para a area de transferencia (util para teleprompter externo). */
  async function copiarRoteiro() {
    try {
      await navigator.clipboard.writeText(card.roteiro);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1800);
    } catch {
      // Navegador sem permissao de clipboard: ignora silenciosamente.
    }
  }

  /** Copia a legenda final para a area de transferencia (colar direto no post). */
  async function copiarLegenda() {
    try {
      await navigator.clipboard.writeText(card.legenda);
      setCopiadoLegenda(true);
      window.setTimeout(() => setCopiadoLegenda(false), 1800);
    } catch {
      // Navegador sem permissao de clipboard: ignora silenciosamente.
    }
  }

  /** Copia o texto do teleprompter (apenas as falas). */
  async function copiarTeleprompter() {
    try {
      await navigator.clipboard.writeText(card.teleprompter ?? "");
      setCopiadoTp(true);
      window.setTimeout(() => setCopiadoTp(false), 1800);
    } catch {
      // Navegador sem permissao de clipboard: ignora silenciosamente.
    }
  }

  /** Desfaz um ajuste de teleprompter feito por um link de compartilhamento. */
  function reverterTeleprompter() {
    atualizarCard({
      ...card,
      teleprompter: card.teleprompterAnterior ?? "",
      teleprompterAnterior: undefined,
      teleprompterAjustadoEm: undefined,
    });
  }

  const postado = card.etapa === etapaPostado.id;

  // Horas apontadas neste card e se o timer atual e dele.
  const totalCard = totalMsDoCard(card.id);
  const timerNesteCard = timerAtivo?.cardId === card.id;

  // Servico: candidatos a vincular (conteudos ativos, menos ele mesmo e outros
  // servicos) e a acao de marcar/desmarcar.
  const candidatosVinculo = ehServico
    ? cards.filter(
        (c) =>
          c.id !== card.id &&
          c.tipo !== "servico" &&
          !campanhaArquivada(campanhaPorId(c.campanhaId)?.status)
      )
    : [];
  function alternarVinculo(id: string) {
    const atual = card.cardsVinculados ?? [];
    const novo = atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id];
    atualizarCard({ ...card, cardsVinculados: novo });
  }
  // Para um card comum: servicos que o cobrem (entram na linha do tempo dele).
  const servicosDoCard: ServicoNaLinha[] = ehServico
    ? []
    : cards
        .filter((c) => c.tipo === "servico" && (c.cardsVinculados ?? []).includes(card.id))
        .map((s) => ({
          titulo: s.titulo || "Serviço",
          registros: registrosDoCard(s.id),
          timer: timerAtivo && timerAtivo.cardId === s.id ? timerAtivo : undefined,
        }));

  // Limite de caracteres da legenda conforme os canais marcados.
  const limiteLegenda = card.canais.length
    ? Math.min(...card.canais.map((c) => CANAIS[c].limiteLegenda))
    : LIMITE_LEGENDA_PADRAO;
  const totalLegenda = card.legenda.length;
  const legendaExcedida = totalLegenda > limiteLegenda;

  // Pre-condicoes para a publicacao automatica (Meta cuida so de FB e IG).
  const temCanalMeta = card.canais.some((c) => c === "facebook" || c === "instagram");
  const temMidia = (card.midiaUrl ?? "").trim() !== "";
  const temQuando = !!card.dataPublicacao && !!card.horaPublicacao;
  const podeAgendar = temCanalMeta && temMidia && temQuando;
  const faltam = [
    !temCanalMeta && "marque Facebook ou Instagram",
    !temMidia && "cole o link da mídia",
    !temQuando && "defina data e horário",
  ].filter(Boolean) as string[];

  // Acoes do rodape (compartilhar, excluir, salvar). Reaproveitadas no rodape
  // fixo do desktop e no fim do conteudo no mobile (onde rolam junto, sem comer
  // a tela). No mobile os botoes secundarios ficam so com o simbolo.
  const acoesEsquerda = (
    <div className="flex items-center gap-2">
      {!confirmandoExclusao && (
        <button
          type="button"
          onClick={() => setCompartilharAberto(true)}
          aria-label="Compartilhar"
          title="Compartilhar"
          className="flex items-center gap-1.5 rounded-marca border border-marca-cinza/40 px-3 py-2 text-sm font-semibold text-marca-azulEscuro transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-azulClaro"
        >
          <Share2 size={16} aria-hidden />
          <span className="hidden sm:inline">Compartilhar</span>
        </button>
      )}
      {confirmandoExclusao ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-marca-preto">Excluir este conteúdo?</span>
          <button
            type="button"
            onClick={confirmarExclusao}
            className="rounded-marca px-3 py-1.5 text-sm font-semibold text-white"
            style={{ backgroundColor: "#EC1313" }}
          >
            Confirmar
          </button>
          <button
            type="button"
            onClick={() => setConfirmandoExclusao(false)}
            className="rounded-marca px-3 py-1.5 text-sm font-semibold text-marca-cinza hover:text-marca-azulEscuro"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmandoExclusao(true)}
          aria-label="Excluir"
          title="Excluir"
          className="flex items-center gap-1.5 rounded-marca px-3 py-2 text-sm font-semibold text-marca-vermelho transition hover:bg-marca-vermelho/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-vermelho"
        >
          <Trash2 size={16} aria-hidden />
          <span className="hidden sm:inline">Excluir</span>
        </button>
      )}
    </div>
  );

  const acoesDireita = (
    <div className="flex items-center gap-2 sm:gap-3">
      <span className="hidden items-center gap-1 text-xs text-marca-cinza sm:flex">
        <Check size={13} aria-hidden /> Salvo automaticamente
      </span>
      <button
        type="button"
        onClick={onFechar}
        className="hidden rounded-marca px-4 py-2 text-sm font-semibold text-marca-cinza transition hover:text-marca-azulEscuro sm:block"
      >
        Fechar
      </button>
      <button
        type="button"
        onClick={onFechar}
        className="flex items-center gap-1.5 rounded-marca bg-marca-laranja px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-azulEscuro"
      >
        <Save size={16} aria-hidden />
        Salvar e fechar
      </button>
    </div>
  );

  return (
    <>
    <div
      className={`fixed inset-0 z-50 flex items-stretch justify-center bg-marca-preto/50 animate-fadeIn ${
        maximizado ? "p-0" : "p-0 espacoso:items-center espacoso:p-4"
      }`}
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhe do conteúdo: ${card.titulo || "sem título"}`}
    >
      <div
        className={`flex h-full w-full flex-col overflow-hidden bg-white shadow-modal ${
          maximizado
            ? "max-w-none rounded-none"
            : "espacoso:h-[660px] espacoso:max-h-[90vh] espacoso:max-w-2xl espacoso:rounded-marca"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecalho do modal */}
        <div className="flex items-center justify-between gap-3 bg-marca-azulEscuro px-5 py-4 text-white baixo:py-2.5">
          <div className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-marca"
              style={{ backgroundColor: TIPOS[card.tipo].cor }}
            >
              {(() => {
                const Icone = TIPOS[card.tipo].icone;
                return <Icone size={16} aria-hidden />;
              })()}
            </span>
            <div>
              <p className="text-xs uppercase tracking-wide text-white/70">
                {TIPOS[card.tipo].label}
              </p>
              <h2 className="max-w-[60vw] truncate text-base font-bold sm:max-w-md">
                {card.titulo || "Sem título"}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={alternarMaximizado}
              aria-label={maximizado ? "Restaurar tamanho" : "Maximizar (tela cheia)"}
              title={maximizado ? "Restaurar" : "Maximizar (tela cheia)"}
              className="hidden rounded-marca p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-laranja espacoso:block"
            >
              {maximizado ? <Minimize2 size={18} aria-hidden /> : <Maximize2 size={18} aria-hidden />}
            </button>
            <button
              type="button"
              onClick={onFechar}
              aria-label="Fechar"
              className="rounded-marca p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-laranja"
            >
              <X size={20} aria-hidden />
            </button>
          </div>
        </div>

        {/* Acao rapida de status: marcar como postado ou reabrir */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-marca-cinza/30 bg-white px-5 py-2.5 baixo:py-1.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
            Etapa
            <span
              className={`rounded-marca px-2 py-0.5 ${
                postado ? "bg-marca-verde text-white" : "bg-marca-azulEscuro/10 text-marca-azulEscuro"
              }`}
            >
              {etapaPorId(card.etapa).titulo}
            </span>
          </span>

          {postado ? (
            <button
              type="button"
              onClick={() => reabrirCard(card.id)}
              className="flex items-center gap-1.5 rounded-marca border border-marca-verde px-3 py-1.5 text-sm font-semibold text-marca-verdeEscuro transition hover:bg-marca-verdeClaro"
            >
              <RotateCcw size={15} aria-hidden />
              Reabrir
            </button>
          ) : (
            <button
              type="button"
              onClick={() => marcarPostado(card.id)}
              className="flex items-center gap-1.5 rounded-marca bg-marca-verde px-3 py-1.5 text-sm font-bold text-white transition hover:bg-marca-verdeEscuro"
            >
              <Send size={15} aria-hidden />
              Marcar como postado
            </button>
          )}
        </div>

        {/* Sugestao vinda de fora: quem mandou e a referencia */}
        {card.externo && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-marca-cinza/30 bg-[#F3EFFB] px-5 py-2 text-xs">
            <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: "#6D4FC0" }}>
              <Lightbulb size={14} aria-hidden /> Sugestão de {card.sugeridoPor || "visitante"}
            </span>
            {card.referenciaUrl && (
              <a
                href={card.referenciaUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-marca-azulClaro hover:underline"
              >
                <Link2 size={13} aria-hidden /> ver referência
              </a>
            )}
          </div>
        )}

        {/* Timer e total de horas apontadas neste card */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-marca-cinza/30 bg-white px-5 py-2 baixo:py-1">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-marca-cinza">
            <Timer size={14} aria-hidden />
            {totalCard > 0 ? `${formatarDuracao(totalCard)} apontadas` : "Sem horas apontadas"}
          </span>
          {timerNesteCard ? (
            <span className="flex items-center gap-1.5 rounded-marca bg-marca-laranja/10 px-3 py-1.5 text-sm font-semibold text-marca-laranja">
              <span className="relative flex h-2 w-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-marca-laranja/60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-marca-laranja" />
              </span>
              Timer em andamento
            </span>
          ) : (
            <button
              type="button"
              onClick={() => iniciarTimer(card.id)}
              className="flex items-center gap-1.5 rounded-marca border border-marca-cinza/40 px-3 py-1.5 text-sm font-semibold text-marca-azulEscuro transition hover:border-marca-laranja hover:text-marca-laranja"
            >
              <Timer size={15} aria-hidden /> Iniciar timer
            </button>
          )}
        </div>

        {/* Abas: pilulas com icone, rolaveis lateralmente. A ativa fica laranja
            preenchida (fica obvio onde voce esta e que da para trocar). */}
        <div
          className="flex gap-1.5 overflow-x-auto border-b border-marca-cinza/30 bg-marca-branco px-3 py-2 baixo:py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
        >
          {abas.map((a) => {
            const ativa = aba === a.id;
            const Icone = a.icone;
            return (
              <button
                key={a.id}
                type="button"
                role="tab"
                aria-selected={ativa}
                onClick={(e) => {
                  setAba(a.id);
                  // Garante que a aba tocada (inclusive a ultima) fique visivel.
                  e.currentTarget.scrollIntoView({
                    inline: "center",
                    block: "nearest",
                    behavior: "smooth",
                  });
                }}
                className={`flex shrink-0 items-center gap-1.5 rounded-marca px-3 py-2 text-sm font-semibold transition ${
                  ativa
                    ? "bg-marca-laranja text-white shadow-card"
                    : "text-marca-cinza hover:bg-white hover:text-marca-azulEscuro"
                }`}
              >
                <Icone size={15} aria-hidden />
                {a.rotulo}
              </button>
            );
          })}
        </div>

        {/* Conteudo das abas (altura fixa do modal: o miolo rola, o tamanho nao muda) */}
        <div ref={conteudoRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 baixo:py-2.5">
          {aba === "projeto" && ehProjeto && <AbaProjeto card={card} />}

          {aba === "visao" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo rotulo="Título" className="sm:col-span-2">
                <input
                  ref={tituloRef}
                  type="text"
                  value={card.titulo}
                  onChange={(e) => atualizarCampo("titulo", e.target.value)}
                  className={inputClasse}
                  placeholder="Título do conteúdo"
                />
              </Campo>

              <Campo rotulo="Campanha" className="sm:col-span-2">
                <SeletorOpcao
                  value={card.campanhaId}
                  onChange={(v) => atualizarCampo("campanhaId", v)}
                  grupos={marcas
                    .map((m) => ({
                      rotulo: m.nome,
                      opcoes: campanhas
                        .filter((c) => c.marca === m.id)
                        .map((c) => ({ valor: c.id, rotulo: c.nome })),
                    }))
                    .filter((g) => g.opcoes.length > 0)}
                />
              </Campo>

              <Campo rotulo="Tipo de conteúdo">
                <SeletorOpcao
                  value={card.tipo}
                  onChange={(v) => mudarTipo(v as TipoConteudo)}
                  opcoes={TIPOS_ORDEM.map((t) => ({ valor: t, rotulo: TIPOS[t].label }))}
                />
              </Campo>

              <Campo rotulo="Etapa atual">
                <SeletorOpcao
                  value={card.etapa}
                  onChange={(v) => mudarEtapa(v as Etapa)}
                  opcoes={etapas.map((c) => ({ valor: c.id, rotulo: c.titulo }))}
                />
              </Campo>

              <Campo rotulo="Prioridade" className="sm:col-span-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => atualizarCampo("prioridade", undefined)}
                    aria-pressed={!card.prioridade}
                    className={`rounded-marca border px-3 py-1.5 text-sm font-semibold transition ${
                      !card.prioridade
                        ? "border-marca-azulEscuro bg-marca-azulEscuro text-white"
                        : "border-marca-cinza/40 bg-white text-marca-cinza hover:text-marca-azulEscuro"
                    }`}
                  >
                    Nenhuma
                  </button>
                  {PRIORIDADES_ORDEM.map((p) => {
                    const cfg = PRIORIDADES[p];
                    const ativo = card.prioridade === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => atualizarCampo("prioridade", p as Prioridade)}
                        aria-pressed={ativo}
                        style={
                          ativo
                            ? { backgroundColor: cfg.cor, borderColor: cfg.cor }
                            : { color: cfg.cor, borderColor: cfg.cor }
                        }
                        className={`flex items-center gap-1.5 rounded-marca border px-3 py-1.5 text-sm font-semibold transition ${
                          ativo ? "text-white" : "bg-white hover:brightness-95"
                        }`}
                      >
                        <Flag size={14} aria-hidden />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </Campo>

              {ehServico && (
                <Campo rotulo="Descrição do serviço" className="sm:col-span-2">
                  <input
                    type="text"
                    value={card.briefing}
                    onChange={(e) => atualizarCampo("briefing", e.target.value)}
                    className={inputClasse}
                    placeholder="Ex: Gravação dos vídeos da semana"
                  />
                </Campo>
              )}

              {ehServico && (
                <Campo rotulo="Projetos que este serviço cobre" className="sm:col-span-2">
                  <div className="max-h-56 space-y-1 overflow-y-auto rounded-marca border border-marca-cinza/30 p-2">
                    {candidatosVinculo.length === 0 ? (
                      <p className="px-1 py-2 text-xs text-marca-cinza">
                        Nenhum outro conteúdo para vincular.
                      </p>
                    ) : (
                      candidatosVinculo.map((c) => {
                        const marcado = (card.cardsVinculados ?? []).includes(c.id);
                        return (
                          <label
                            key={c.id}
                            className="flex items-center gap-2 rounded px-1 py-1 hover:bg-marca-branco"
                          >
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={() => alternarVinculo(c.id)}
                              className="h-4 w-4 accent-marca-laranja"
                            />
                            <span className="min-w-0 flex-1 truncate text-sm text-marca-preto">
                              {c.titulo || "Sem título"}
                            </span>
                            <span className="shrink-0 text-[11px] text-marca-cinza">
                              {campanhaPorId(c.campanhaId)?.nome}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                  <span className="mt-1 block text-xs text-marca-cinza">
                    O tempo do timer deste serviço aparece na linha do tempo de cada conteúdo marcado.
                  </span>
                </Campo>
              )}

              {!ehServico && (
              <Campo rotulo="Canais" className="sm:col-span-2">
                <div className="flex flex-wrap gap-2">
                  {CANAIS_ORDEM.map((canal) => {
                    const ativo = card.canais.includes(canal);
                    const Icone = CANAIS[canal].icone;
                    return (
                      <button
                        key={canal}
                        type="button"
                        onClick={() => alternarCanal(canal)}
                        aria-pressed={ativo}
                        className={`flex items-center gap-1.5 rounded-marca border px-3 py-1.5 text-sm font-medium transition ${
                          ativo
                            ? "border-marca-laranja bg-marca-laranja text-white"
                            : "border-marca-cinza/40 bg-white text-marca-cinza hover:border-marca-laranja hover:text-marca-laranja"
                        }`}
                      >
                        <Icone size={15} aria-hidden />
                        {CANAIS[canal].label}
                      </button>
                    );
                  })}
                </div>
              </Campo>
              )}

              <Campo rotulo="Tema ou campanha">
                <input
                  type="text"
                  value={card.tema ?? ""}
                  onChange={(e) => atualizarCampo("tema", e.target.value)}
                  className={inputClasse}
                  placeholder="Ex: Cibersegurança"
                />
              </Campo>

              <Campo rotulo="Responsável">
                <input
                  type="text"
                  value={card.responsavel ?? ""}
                  onChange={(e) => atualizarCampo("responsavel", e.target.value)}
                  className={inputClasse}
                  placeholder="Quem cuida deste conteúdo"
                />
              </Campo>

              <Campo rotulo="Data de publicação">
                <SeletorData
                  value={card.dataPublicacao}
                  onChange={(iso) => atualizarCampo("dataPublicacao", iso)}
                />
              </Campo>

              <Campo rotulo="Horário (auto-publicação)">
                <SeletorHora
                  value={card.horaPublicacao}
                  onChange={(v) => atualizarCampo("horaPublicacao", v ?? "")}
                />
              </Campo>

              {/* Publicacao automatica (FB/IG): o robo publica no horario agendado. */}
              {card.tipo !== "projeto" && !ehServico && (
                <div className="rounded-marca border border-marca-cinza/30 bg-marca-branco p-3 sm:col-span-2">
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-marca-azulEscuro">
                    Publicação automática (Facebook e Instagram)
                  </p>
                  <p className="mb-3 text-xs text-marca-cinza">
                    Cole o link público da mídia (imagem ou vídeo), marque os canais e defina
                    data e horário. O robô publica sozinho no horário marcado.
                  </p>
                  <Campo rotulo="Link da mídia (imagem ou vídeo)">
                    <input
                      type="url"
                      value={card.midiaUrl ?? ""}
                      onChange={(e) => atualizarCampo("midiaUrl", e.target.value)}
                      className={inputClasse}
                      placeholder="https://..."
                    />
                  </Campo>

                  {/* Acao de agendamento conforme o status atual */}
                  <div className="mt-3 border-t border-marca-cinza/20 pt-3">
                    {card.statusPub === "publicado" ? (
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-marca-verde">
                        <CheckCircle2 size={14} aria-hidden />
                        Publicado automaticamente
                        {card.postadoEm ? ` em ${formatarData(card.postadoEm.slice(0, 10))}` : ""}.
                      </p>
                    ) : card.statusPub === "agendado" ? (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-marca-azulClaro">
                          <Clock size={14} aria-hidden />
                          Agendado para {formatarData(card.dataPublicacao)} às {card.horaPublicacao}.
                        </span>
                        <button
                          type="button"
                          onClick={cancelarAuto}
                          className="rounded-marca border border-marca-cinza/40 px-3 py-1.5 text-xs font-semibold text-marca-cinza transition hover:text-marca-azulEscuro"
                        >
                          Cancelar agendamento
                        </button>
                      </div>
                    ) : (
                      <>
                        {card.statusPub === "erro" && (
                          <p className="mb-2 text-xs font-semibold text-marca-vermelho">
                            Falha ao publicar: {card.erroPub}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={agendarAuto}
                          disabled={!podeAgendar}
                          className="flex items-center gap-1.5 rounded-marca bg-marca-azulEscuro px-3 py-2 text-sm font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Send size={15} aria-hidden />
                          {card.statusPub === "erro" ? "Tentar de novo" : "Agendar publicação automática"}
                        </button>
                        {!podeAgendar && (
                          <p className="mt-1.5 text-xs text-marca-cinza">Para agendar: {faltam.join(", ")}.</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {aba === "briefing" && (
            <Campo
              rotulo="Briefing"
              dica="Objetivo, público-alvo, gancho (hook) e CTA."
            >
              <textarea
                value={card.briefing}
                onChange={(e) => atualizarCampo("briefing", e.target.value)}
                className={`${inputClasse} min-h-[260px] resize-y leading-relaxed`}
                placeholder="Objetivo do conteúdo, para quem é, qual o gancho e qual a chamada para ação."
              />
            </Campo>
          )}

          {aba === "roteiro" && (
            <div className="space-y-6">
              {/* Roteiro completo (planejamento: cenas, estrutura, indicacoes) */}
              <div>
                <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
                      Roteiro completo
                    </span>
                    <span className="text-xs text-marca-cinza">
                      Cenas, estrutura, indicações e slides (planejamento).
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={copiarRoteiro}
                    disabled={!card.roteiro.trim()}
                    className="flex items-center gap-1.5 rounded-marca border border-marca-cinza/40 px-3 py-1.5 text-sm font-semibold text-marca-azulEscuro transition hover:bg-marca-branco disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {copiado ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
                    {copiado ? "Copiado" : "Copiar"}
                  </button>
                </div>
                <textarea
                  value={card.roteiro}
                  onChange={(e) => atualizarCampo("roteiro", e.target.value)}
                  className={`${inputClasse} min-h-[200px] resize-y leading-relaxed`}
                  placeholder="Descreva cena a cena (Reels) ou slide a slide (carrossel), com as indicações."
                />
              </div>

              {/* Texto do teleprompter (apenas as falas) */}
              <div>
                <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
                      Texto do teleprompter
                    </span>
                    <span className="text-xs text-marca-cinza">
                      Apenas as falas, sem indicações. É o que aparece ao abrir o Teleprompter.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={copiarTeleprompter}
                      disabled={!card.teleprompter?.trim()}
                      className="flex items-center gap-1.5 rounded-marca border border-marca-cinza/40 px-3 py-1.5 text-sm font-semibold text-marca-azulEscuro transition hover:bg-marca-branco disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {copiadoTp ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
                      {copiadoTp ? "Copiado" : "Copiar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setModoTpInicial("remoto");
                        setTeleprompterAberto(true);
                      }}
                      disabled={!card.teleprompter?.trim() && !card.roteiro.trim()}
                      title="Comandar o teleprompter das outras telas pelo celular"
                      className="flex items-center gap-1.5 rounded-marca border border-marca-cinza/40 px-3 py-1.5 text-sm font-semibold text-marca-azulEscuro transition hover:bg-marca-branco disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <MonitorSmartphone size={15} aria-hidden />
                      <span className="hidden sm:inline">Controle remoto</span>
                      <span className="sm:hidden">Remoto</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setModoTpInicial(undefined);
                        setTeleprompterAberto(true);
                      }}
                      disabled={!card.teleprompter?.trim() && !card.roteiro.trim()}
                      className="flex items-center gap-1.5 rounded-marca bg-marca-laranja px-3 py-1.5 text-sm font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <MonitorPlay size={15} aria-hidden />
                      Teleprompter
                    </button>
                  </div>
                </div>
                {card.teleprompterAjustadoEm && (
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-marca border border-marca-azulClaro/40 bg-marca-azulClaro/5 px-3 py-2 text-xs">
                    <span className="font-semibold text-marca-azulClaro">
                      Teleprompter ajustado via compartilhamento em{" "}
                      {new Date(card.teleprompterAjustadoEm).toLocaleString("pt-BR")}.
                    </span>
                    <button
                      type="button"
                      onClick={reverterTeleprompter}
                      className="flex items-center gap-1 rounded-marca border border-marca-cinza/40 px-2.5 py-1 font-semibold text-marca-azulEscuro transition hover:bg-white"
                    >
                      <RotateCcw size={13} aria-hidden /> Reverter
                    </button>
                  </div>
                )}
                <textarea
                  value={card.teleprompter ?? ""}
                  onChange={(e) => {
                    atualizarCampo("teleprompter", e.target.value);
                    enviarTp(e.target.value); // propaga AO VIVO para o visitante
                  }}
                  className={`${inputClasse} min-h-[240px] resize-y bg-marca-branco text-base leading-loose`}
                  placeholder="Apenas a fala, do jeito que você vai narrar (sem 'Cena 1', sem indicações)."
                />
                <p className="mt-1.5 text-xs text-marca-cinza">
                  Dica: deixe só a fala aqui para ler limpo no Teleprompter. Se ficar vazio, o
                  Teleprompter mostra o roteiro completo. Para marcar uma seção, comece uma linha
                  com um traço (ex: <span className="font-semibold text-marca-vermelho">-hook</span>,{" "}
                  <span className="font-semibold text-marca-vermelho">-problema</span>): ela aparece
                  pequena, em vermelho, no Teleprompter.
                </p>
              </div>
            </div>
          )}

          {aba === "legenda" && (
            <div>
              <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                <span className="block text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
                  Legenda final
                </span>
                <button
                  type="button"
                  onClick={copiarLegenda}
                  disabled={!card.legenda.trim()}
                  className="flex items-center gap-1.5 rounded-marca border border-marca-cinza/40 px-3 py-1.5 text-sm font-semibold text-marca-azulEscuro transition hover:bg-marca-branco disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {copiadoLegenda ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
                  {copiadoLegenda ? "Copiado" : "Copiar"}
                </button>
              </div>
              <textarea
                value={card.legenda}
                onChange={(e) => atualizarCampo("legenda", e.target.value)}
                className={`${inputClasse} min-h-[260px] resize-y leading-relaxed`}
                placeholder="Legenda final do post."
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span
                  className={legendaExcedida ? "font-semibold" : "text-marca-cinza"}
                  style={legendaExcedida ? { color: "#EC1313" } : undefined}
                >
                  {totalLegenda} / {limiteLegenda} caracteres
                </span>
                <span className="text-marca-cinza">
                  Referência: Instagram e Facebook 2.200, LinkedIn 3.000, YouTube 5.000
                </span>
              </div>
            </div>
          )}

          {aba === "linha" && (
            <LinhaDoTempoProjeto
              registros={registrosDoCard(card.id)}
              timerAtivo={timerAtivo && timerAtivo.cardId === card.id ? timerAtivo : undefined}
              servicos={servicosDoCard}
            />
          )}

          {/* Acoes no mobile: rolam junto com o conteudo, no fim do card (nao
              ficam fixas comendo a tela). Ao aparecer, o botao flutuante some e
              os tres botoes ficam juntos. */}
          <div
            ref={rodapeMobileRef}
            className="mt-8 flex items-center justify-between gap-2 border-t border-marca-cinza/30 pt-4 espacoso:hidden"
          >
            {acoesEsquerda}
            {acoesDireita}
          </div>
        </div>

        {/* Rodape fixo (desktop): salvar, excluir, compartilhar */}
        <div className="hidden items-center justify-between gap-3 border-t border-marca-cinza/30 bg-marca-branco px-5 py-3 espacoso:flex">
          {acoesEsquerda}
          {acoesDireita}
        </div>

        {/* Botao flutuante (mobile): "Salvar e fechar" sempre a mao enquanto rola;
            desliza para fora quando o rodape com os outros botoes aparece no fim. */}
        <button
          type="button"
          onClick={onFechar}
          aria-label="Salvar e fechar"
          className={`fixed bottom-4 right-4 z-[60] flex items-center gap-1.5 rounded-marca bg-marca-laranja px-4 py-3 text-sm font-bold text-white shadow-modal transition-all duration-200 ease-suave espacoso:hidden ${
            rodapeVisivel ? "pointer-events-none translate-y-4 opacity-0" : "translate-y-0 opacity-100"
          }`}
        >
          <Save size={16} aria-hidden />
          Salvar e fechar
        </button>
      </div>
    </div>

    {teleprompterAberto && (
      <Teleprompter
        texto={card.teleprompter?.trim() ? card.teleprompter : card.roteiro}
        cardId={card.id}
        onFechar={fecharTeleprompter}
        modoInicial={modoTpInicial}
      />
    )}

    {compartilharAberto && (
      <ModalCompartilhar card={card} onFechar={() => setCompartilharAberto(false)} />
    )}
    </>
  );
}

/** Rotulo + campo, com dica opcional. */
function Campo({
  rotulo,
  dica,
  className,
  children,
}: {
  rotulo: string;
  dica?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
        {rotulo}
      </span>
      {dica && <span className="mb-2 block text-xs text-marca-cinza">{dica}</span>}
      {children}
    </label>
  );
}
