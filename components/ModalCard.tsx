"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  Trash2,
  Check,
  Save,
  Copy,
  MonitorPlay,
  CircleCheck,
  Send,
  RotateCcw,
  Clock,
  CheckCircle2,
  Share2,
} from "lucide-react";
import {
  CANAIS,
  CANAIS_ORDEM,
  COLUNAS,
  ETAPA_TITULO,
  LIMITE_LEGENDA_PADRAO,
  MARCAS,
  MARCAS_ORDEM,
  TIPOS,
  TIPOS_ORDEM,
} from "@/lib/config";
import { useBoard } from "@/lib/store";
import type { Canal, CardConteudo, Etapa, TipoConteudo } from "@/lib/types";
import { agora, formatarData } from "@/lib/util";
import { criarProjetoVazio } from "@/lib/projeto";
import Teleprompter from "./Teleprompter";
import AbaProjeto from "./projeto/AbaProjeto";
import ModalCompartilhar from "./ModalCompartilhar";

type Aba = "visao" | "projeto" | "briefing" | "roteiro" | "legenda";

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "visao", rotulo: "Visão Geral" },
  { id: "briefing", rotulo: "Briefing" },
  { id: "roteiro", rotulo: "Roteiro" },
  { id: "legenda", rotulo: "Legenda" },
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
  const { campanhas, atualizarCard, excluirCard, concluirCard, marcarPostado, reabrirCard } =
    useBoard();
  const [aba, setAba] = useState<Aba>("visao");
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [teleprompterAberto, setTeleprompterAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [copiadoTp, setCopiadoTp] = useState(false);
  const [copiadoLegenda, setCopiadoLegenda] = useState(false);
  const [compartilharAberto, setCompartilharAberto] = useState(false);
  const tituloRef = useRef<HTMLInputElement>(null);

  // Foca o titulo ao abrir e bloqueia o scroll do fundo.
  useEffect(() => {
    tituloRef.current?.focus();
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

  const ehProjeto = card.tipo === "projeto";

  // A aba Projeto so existe para cards do tipo projeto. Se o tipo mudar enquanto
  // a aba Projeto esta aberta, volta para a Visao Geral.
  useEffect(() => {
    if (aba === "projeto" && !ehProjeto) setAba("visao");
  }, [aba, ehProjeto]);

  // Lista de abas: insere "Projeto" logo apos "Visao Geral" quando for projeto.
  const abas: { id: Aba; rotulo: string }[] = ehProjeto
    ? [ABAS[0], { id: "projeto", rotulo: "Projeto" }, ...ABAS.slice(1)]
    : ABAS;

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
      postadoEm: nova === "publicado" ? (card.postadoEm ?? agora()) : undefined,
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

  const postado = card.etapa === "publicado";
  const aprovado = card.etapa === "aprovado";

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

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-marca-preto/50 p-0 animate-fadeIn sm:items-center sm:p-4"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhe do conteúdo: ${card.titulo || "sem título"}`}
    >
      <div
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-modal sm:h-[660px] sm:max-h-[90vh] sm:max-w-2xl sm:rounded-marca"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecalho do modal */}
        <div className="flex items-center justify-between gap-3 bg-marca-azulEscuro px-5 py-4 text-white">
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
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-marca p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-laranja"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        {/* Acao rapida de status: concluir, postar ou reabrir */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-marca-cinza/30 bg-white px-5 py-2.5">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
            Etapa
            <span
              className={`rounded-marca px-2 py-0.5 ${
                postado ? "bg-marca-verde text-white" : "bg-marca-azulEscuro/10 text-marca-azulEscuro"
              }`}
            >
              {ETAPA_TITULO[card.etapa]}
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
          ) : aprovado ? (
            <button
              type="button"
              onClick={() => marcarPostado(card.id)}
              className="flex items-center gap-1.5 rounded-marca bg-marca-verde px-3 py-1.5 text-sm font-bold text-white transition hover:bg-marca-verdeEscuro"
            >
              <Send size={15} aria-hidden />
              Marcar como postado
            </button>
          ) : (
            <button
              type="button"
              onClick={() => concluirCard(card.id)}
              className="flex items-center gap-1.5 rounded-marca bg-marca-laranja px-3 py-1.5 text-sm font-bold text-white transition hover:brightness-95"
            >
              <CircleCheck size={15} aria-hidden />
              Concluir (mover para Aprovado)
            </button>
          )}
        </div>

        {/* Abas */}
        <div className="flex border-b border-marca-cinza/30 bg-marca-branco px-2" role="tablist">
          {abas.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={aba === a.id}
              onClick={() => setAba(a.id)}
              className={`relative px-4 py-3 text-sm font-semibold transition ${
                aba === a.id
                  ? "text-marca-laranja"
                  : "text-marca-cinza hover:text-marca-azulEscuro"
              }`}
            >
              {a.rotulo}
              {aba === a.id && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-marca-laranja" />
              )}
            </button>
          ))}
        </div>

        {/* Conteudo das abas (altura fixa do modal: o miolo rola, o tamanho nao muda) */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
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
                <select
                  value={card.campanhaId}
                  onChange={(e) => atualizarCampo("campanhaId", e.target.value)}
                  className={inputClasse}
                >
                  {MARCAS_ORDEM.map((m) => {
                    const daMarca = campanhas.filter((c) => c.marca === m);
                    if (daMarca.length === 0) return null;
                    return (
                      <optgroup key={m} label={MARCAS[m].label}>
                        {daMarca.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </Campo>

              <Campo rotulo="Tipo de conteúdo">
                <select
                  value={card.tipo}
                  onChange={(e) => mudarTipo(e.target.value as TipoConteudo)}
                  className={inputClasse}
                >
                  {TIPOS_ORDEM.map((t) => (
                    <option key={t} value={t}>
                      {TIPOS[t].label}
                    </option>
                  ))}
                </select>
              </Campo>

              <Campo rotulo="Etapa atual">
                <select
                  value={card.etapa}
                  onChange={(e) => mudarEtapa(e.target.value as Etapa)}
                  className={inputClasse}
                >
                  {COLUNAS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.titulo}
                    </option>
                  ))}
                </select>
              </Campo>

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
                <input
                  type="date"
                  value={card.dataPublicacao ?? ""}
                  onChange={(e) =>
                    atualizarCampo("dataPublicacao", e.target.value || undefined)
                  }
                  className={inputClasse}
                />
                {card.dataPublicacao && (
                  <p className="mt-1 text-xs text-marca-cinza">
                    {formatarData(card.dataPublicacao)}
                  </p>
                )}
              </Campo>

              <Campo rotulo="Horário (auto-publicação)">
                <input
                  type="time"
                  value={card.horaPublicacao ?? ""}
                  onChange={(e) => atualizarCampo("horaPublicacao", e.target.value)}
                  className={inputClasse}
                />
              </Campo>

              {/* Publicacao automatica (FB/IG): o robo publica no horario agendado. */}
              {card.tipo !== "projeto" && (
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
                      onClick={() => setTeleprompterAberto(true)}
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
                  onChange={(e) => atualizarCampo("teleprompter", e.target.value)}
                  className={`${inputClasse} min-h-[240px] resize-y bg-marca-branco text-base leading-loose`}
                  placeholder="Apenas a fala, do jeito que você vai narrar (sem 'Cena 1', sem indicações)."
                />
                <p className="mt-1.5 text-xs text-marca-cinza">
                  Dica: deixe só a fala aqui para ler limpo no Teleprompter. Se ficar vazio, o
                  Teleprompter mostra o roteiro completo.
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
        </div>

        {/* Rodape: salvar, excluir, fechar */}
        <div className="flex items-center justify-between gap-3 border-t border-marca-cinza/30 bg-marca-branco px-5 py-3">
          <div className="flex items-center gap-2">
          {!confirmandoExclusao && (
            <button
              type="button"
              onClick={() => setCompartilharAberto(true)}
              className="flex items-center gap-1.5 rounded-marca border border-marca-cinza/40 px-3 py-2 text-sm font-semibold text-marca-azulEscuro transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-azulClaro"
            >
              <Share2 size={16} aria-hidden />
              Compartilhar
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
              className="flex items-center gap-1.5 rounded-marca px-3 py-2 text-sm font-semibold text-marca-vermelho transition hover:bg-marca-vermelho/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-vermelho"
            >
              <Trash2 size={16} aria-hidden />
              Excluir
            </button>
          )}
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1 text-xs text-marca-cinza sm:flex">
              <Check size={13} aria-hidden /> Salvo automaticamente
            </span>
            <button
              type="button"
              onClick={onFechar}
              className="rounded-marca px-4 py-2 text-sm font-semibold text-marca-cinza transition hover:text-marca-azulEscuro"
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
        </div>
      </div>
    </div>

    {teleprompterAberto && (
      <Teleprompter
        texto={card.teleprompter?.trim() ? card.teleprompter : card.roteiro}
        onFechar={fecharTeleprompter}
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
