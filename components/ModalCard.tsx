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
import Teleprompter from "./Teleprompter";

type Aba = "visao" | "briefing" | "roteiro" | "legenda";

const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "visao", rotulo: "Visao Geral" },
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
  const [copiadoLegenda, setCopiadoLegenda] = useState(false);
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

  const postado = card.etapa === "publicado";
  const aprovado = card.etapa === "aprovado";

  // Limite de caracteres da legenda conforme os canais marcados.
  const limiteLegenda = card.canais.length
    ? Math.min(...card.canais.map((c) => CANAIS[c].limiteLegenda))
    : LIMITE_LEGENDA_PADRAO;
  const totalLegenda = card.legenda.length;
  const legendaExcedida = totalLegenda > limiteLegenda;

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-marca-preto/50 p-0 animate-fadeIn sm:items-center sm:p-4"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhe do conteudo: ${card.titulo || "sem titulo"}`}
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
                {card.titulo || "Sem titulo"}
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
          {ABAS.map((a) => (
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
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {aba === "visao" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo rotulo="Titulo" className="sm:col-span-2">
                <input
                  ref={tituloRef}
                  type="text"
                  value={card.titulo}
                  onChange={(e) => atualizarCampo("titulo", e.target.value)}
                  className={inputClasse}
                  placeholder="Titulo do conteudo"
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

              <Campo rotulo="Tipo de conteudo">
                <select
                  value={card.tipo}
                  onChange={(e) => atualizarCampo("tipo", e.target.value as TipoConteudo)}
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
                  placeholder="Ex: Ciberseguranca"
                />
              </Campo>

              <Campo rotulo="Responsavel">
                <input
                  type="text"
                  value={card.responsavel ?? ""}
                  onChange={(e) => atualizarCampo("responsavel", e.target.value)}
                  className={inputClasse}
                  placeholder="Quem cuida deste conteudo"
                />
              </Campo>

              <Campo rotulo="Data de publicacao">
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
            </div>
          )}

          {aba === "briefing" && (
            <Campo
              rotulo="Briefing"
              dica="Objetivo, publico-alvo, gancho (hook) e CTA."
            >
              <textarea
                value={card.briefing}
                onChange={(e) => atualizarCampo("briefing", e.target.value)}
                className={`${inputClasse} min-h-[260px] resize-y leading-relaxed`}
                placeholder="Objetivo do conteudo, para quem e, qual o gancho e qual a chamada para acao."
              />
            </Campo>
          )}

          {aba === "roteiro" && (
            <div>
              <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <span className="block text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
                    Roteiro
                  </span>
                  <span className="text-xs text-marca-cinza">
                    Fala do Reels ou estrutura dos slides do carrossel.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={copiarRoteiro}
                    disabled={!card.roteiro.trim()}
                    className="flex items-center gap-1.5 rounded-marca border border-marca-cinza/40 px-3 py-1.5 text-sm font-semibold text-marca-azulEscuro transition hover:bg-marca-branco disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {copiado ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
                    {copiado ? "Copiado" : "Copiar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTeleprompterAberto(true)}
                    disabled={!card.roteiro.trim()}
                    className="flex items-center gap-1.5 rounded-marca bg-marca-laranja px-3 py-1.5 text-sm font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <MonitorPlay size={15} aria-hidden />
                    Teleprompter
                  </button>
                </div>
              </div>
              <textarea
                value={card.roteiro}
                onChange={(e) => atualizarCampo("roteiro", e.target.value)}
                className={`${inputClasse} min-h-[320px] resize-y rounded-marca bg-marca-branco text-base leading-loose`}
                placeholder="Descreva cena a cena (Reels) ou slide a slide (carrossel)."
              />
              <p className="mt-1.5 text-xs text-marca-cinza">
                Dica: use o Teleprompter para ler a fala enquanto grava.
              </p>
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
                  Referencia: Instagram e Facebook 2.200, LinkedIn 3.000, YouTube 5.000
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Rodape: salvar, excluir, fechar */}
        <div className="flex items-center justify-between gap-3 border-t border-marca-cinza/30 bg-marca-branco px-5 py-3">
          {confirmandoExclusao ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-marca-preto">Excluir este conteudo?</span>
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
      <Teleprompter texto={card.roteiro} onFechar={fecharTeleprompter} />
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
