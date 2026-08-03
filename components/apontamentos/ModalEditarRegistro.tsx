"use client";

import { useState } from "react";
import { X, Save, Trash2, Plus, ListChecks } from "lucide-react";
import { useBoard } from "@/lib/store";
import { useApontamentos } from "@/lib/apontamentosProvider";
import { deInputLocal, formatarDuracao, paraInputLocal } from "@/lib/apontamentos";
import { TIPOS, TIPOS_ORDEM } from "@/lib/config";
import { agora } from "@/lib/util";
import type { Checkpoint, RegistroTempo, TipoConteudo } from "@/lib/types";
import ListaCheckpoints from "./ListaCheckpoints";
import LinhaDoTempoProjeto, { type ServicoNaLinha } from "./LinhaDoTempoProjeto";

const AVISO_LONGO_MS = 12 * 3_600_000;

/**
 * Edita um registro existente ou lanca um novo manualmente (sem `registro`).
 * Inicio e fim sao a fonte da duracao; mexer na duracao ajusta o fim. Valida
 * fim depois do inicio e avisa quando o intervalo fica grande demais.
 */
export default function ModalEditarRegistro({
  registro,
  cardIdPadrao,
  onFechar,
}: {
  registro?: RegistroTempo;
  cardIdPadrao?: string;
  onFechar: () => void;
}) {
  const { cards, campanhas, marcas, etapas, adicionarCard, atualizarCard } = useBoard();
  const { editarRegistro, adicionarManual, excluirRegistro, registrosDoCard, timerAtivo } =
    useApontamentos();

  const editando = Boolean(registro);
  const [cardId, setCardId] = useState(registro?.cardId ?? cardIdPadrao ?? "");
  const [inicio, setInicio] = useState(paraInputLocal(registro?.inicio ?? agora()));
  const [fim, setFim] = useState(paraInputLocal(registro?.fim ?? agora()));
  const [nota, setNota] = useState(registro?.nota ?? "");
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>(registro?.checkpoints ?? []);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false);
  // Lancamento novo: por padrao "avulso" (escreve o que foi e vira um card, tipo
  // Servico), sem precisar escolher um projeto; ou apontar num card existente.
  const [modoNovo, setModoNovo] = useState<"avulso" | "projeto">(cardIdPadrao ? "projeto" : "avulso");
  const [titulo, setTitulo] = useState("");
  const [tipoNovo, setTipoNovo] = useState<TipoConteudo>("servico");

  const inicioISO = deInputLocal(inicio);
  const fimISO = deInputLocal(fim);
  const inicioMs = inicioISO ? new Date(inicioISO).getTime() : NaN;
  const fimMs = fimISO ? new Date(fimISO).getTime() : NaN;
  const valido = Number.isFinite(inicioMs) && Number.isFinite(fimMs) && fimMs > inicioMs;
  const pausaMs = registro?.pausaMs ?? 0; // tempo pausado, descontado do trabalhado
  const durMs = valido ? Math.max(0, fimMs - inicioMs - pausaMs) : 0;
  const durMin = valido ? Math.round(durMs / 60000) : 0;
  const muitoLongo = durMs > AVISO_LONGO_MS;

  function mudarDuracaoMin(valor: string) {
    const min = Number(valor);
    if (!inicioISO || !Number.isFinite(min) || min < 0) return;
    // A duracao editada e a trabalhada; o termino acomoda a pausa ja registrada.
    const novoFim = new Date(new Date(inicioISO).getTime() + min * 60000 + pausaMs);
    setFim(paraInputLocal(novoFim.toISOString()));
    setErro(null);
  }

  const avulso = !editando && modoNovo === "avulso";

  function salvar() {
    if (!valido) {
      setErro("O término precisa ser depois do início.");
      return;
    }
    if (pausaMs > 0 && durMs <= 0) {
      setErro("A pausa registrada é maior que o intervalo. Ajuste o início, o término ou a pausa.");
      return;
    }
    if (durMs > 24 * 3_600_000) {
      setErro("Esse intervalo passa de 24 horas. Confira o início e o fim.");
      return;
    }
    if (editando && registro) {
      if (!cardId) {
        setErro("Escolha o projeto ou card.");
        return;
      }
      editarRegistro({
        ...registro,
        cardId,
        inicio: inicioISO,
        fim: fimISO,
        nota,
        checkpoints: checkpoints.length > 0 ? checkpoints : undefined,
      });
    } else if (avulso) {
      // Avulso: cria um card na hora (padrao Servico) com o que foi escrito e
      // ja lanca as horas nele. Cai na primeira campanha (primeira etapa).
      if (!titulo.trim()) {
        setErro("Escreva o que foi feito.");
        return;
      }
      const campanhaId = campanhas[0]?.id;
      if (!campanhaId) {
        setErro("Crie uma campanha primeiro para lançar avulso.");
        return;
      }
      const etapa = etapas[0]?.id ?? "";
      const novo = adicionarCard(campanhaId, etapa, tipoNovo);
      atualizarCard({
        ...novo,
        titulo: titulo.trim(),
        // Servico e enxuto: nasce sem canais de publicacao.
        canais: tipoNovo === "servico" ? [] : novo.canais,
      });
      adicionarManual(novo.id, inicioISO, fimISO, nota);
    } else {
      if (!cardId) {
        setErro("Escolha o projeto ou card.");
        return;
      }
      adicionarManual(cardId, inicioISO, fimISO, nota);
    }
    onFechar();
  }

  function excluir() {
    if (registro) excluirRegistro(registro.id);
    onFechar();
  }

  return (
    <div
      className="fixed inset-0 z-[65] flex items-stretch justify-center bg-marca-preto/50 p-0 animate-fadeIn sm:items-center sm:p-4"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label={editando ? "Editar registro de horas" : "Lançar horas manualmente"}
    >
      <div
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-modal sm:h-auto sm:max-h-[90vh] sm:max-w-3xl sm:rounded-marca"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 bg-marca-azulEscuro px-5 py-4 text-white">
          <h2 className="text-base font-bold">{editando ? "Editar registro" : "Lançar horas"}</h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-marca p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className={`grid grid-cols-1 gap-5 ${avulso ? "" : "sm:grid-cols-2"}`}>
            <div className="space-y-4">
          {/* Como lancar: avulso (escreve e vira card) ou num projeto existente.
              So no lancamento novo; ao editar, sempre mostra o seletor de card. */}
          {!editando && (
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setModoNovo("avulso");
                  setErro(null);
                }}
                aria-pressed={modoNovo === "avulso"}
                className={`flex-1 rounded-marca border px-3 py-2 text-sm font-semibold transition ${
                  modoNovo === "avulso"
                    ? "border-transparent bg-marca-laranja text-white"
                    : "border-marca-cinza/40 bg-white text-marca-cinza hover:text-marca-azulEscuro"
                }`}
              >
                Escrever o que foi
              </button>
              <button
                type="button"
                onClick={() => {
                  setModoNovo("projeto");
                  setErro(null);
                }}
                aria-pressed={modoNovo === "projeto"}
                className={`flex-1 rounded-marca border px-3 py-2 text-sm font-semibold transition ${
                  modoNovo === "projeto"
                    ? "border-transparent bg-marca-laranja text-white"
                    : "border-marca-cinza/40 bg-white text-marca-cinza hover:text-marca-azulEscuro"
                }`}
              >
                Projeto existente
              </button>
            </div>
          )}

          {avulso ? (
            <>
              {/* Avulso: o que foi feito (vira o titulo do card) + tipo */}
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
                  O que foi feito
                </span>
                <input
                  type="text"
                  value={titulo}
                  autoFocus
                  onChange={(e) => {
                    setTitulo(e.target.value);
                    setErro(null);
                  }}
                  placeholder="Ex: Gravação, reunião, edição de vídeo..."
                  className="w-full rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 text-sm text-marca-preto outline-none focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
                  Tipo
                </span>
                <select
                  value={tipoNovo}
                  onChange={(e) => setTipoNovo(e.target.value as TipoConteudo)}
                  className="w-full rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 text-sm text-marca-preto outline-none focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
                >
                  {TIPOS_ORDEM.map((t) => (
                    <option key={t} value={t}>
                      {TIPOS[t].label}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs text-marca-cinza">
                  Vira um card novo com esse nome e as horas ja lançadas.
                </span>
              </label>
            </>
          ) : (
            /* Projeto/card existente */
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
                Projeto ou card
              </span>
              <select
                value={cardId}
                onChange={(e) => {
                  setCardId(e.target.value);
                  setErro(null);
                }}
                className="w-full rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 text-sm text-marca-preto outline-none focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
              >
                <option value="">Selecione...</option>
                {marcas.map((m) =>
                  campanhas
                    .filter((c) => c.marca === m.id)
                    .map((camp) => {
                      const cs = cards.filter((cd) => cd.campanhaId === camp.id);
                      if (cs.length === 0) return null;
                      return (
                        <optgroup key={camp.id} label={`${m.nome} · ${camp.nome}`}>
                          {cs.map((cd) => (
                            <option key={cd.id} value={cd.id}>
                              {cd.titulo || "Sem título"}
                            </option>
                          ))}
                        </optgroup>
                      );
                    })
                )}
              </select>
            </label>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
                Início
              </span>
              <input
                type="datetime-local"
                value={inicio}
                onChange={(e) => {
                  setInicio(e.target.value);
                  setErro(null);
                }}
                className="w-full rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 text-sm text-marca-preto outline-none focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
                Término
              </span>
              <input
                type="datetime-local"
                value={fim}
                onChange={(e) => {
                  setFim(e.target.value);
                  setErro(null);
                }}
                className="w-full rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 text-sm text-marca-preto outline-none focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
              />
            </label>
          </div>

          {/* Duracao direta */}
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
              Duração (minutos)
            </span>
            <input
              type="number"
              min={0}
              value={valido ? durMin : ""}
              onChange={(e) => mudarDuracaoMin(e.target.value)}
              className="w-full rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 text-sm text-marca-preto outline-none focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
            />
            <span className="mt-1 block text-xs text-marca-cinza">
              {valido ? `Equivale a ${formatarDuracao(durMs)}.` : "Ajuste início e término."}
              {pausaMs > 0 && ` Já descontados ${formatarDuracao(pausaMs)} de pausa.`}
              {muitoLongo && " Intervalo grande, confira os horários."}
            </span>
          </label>

          {/* Nota */}
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
              Nota
            </span>
            <input
              type="text"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="O que foi feito neste intervalo"
              className="w-full rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 text-sm text-marca-preto outline-none focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
            />
          </label>

          {/* Linha do tempo desta sessao (checkpoints anotados durante o timer). */}
          {checkpoints.length > 0 && (
            <div>
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
                <ListChecks size={13} aria-hidden /> Linha do tempo desta sessão
              </span>
              <ListaCheckpoints
                checkpoints={checkpoints}
                fim={fimISO || agora()}
                onRemover={(id) => setCheckpoints((lista) => lista.filter((c) => c.id !== id))}
              />
            </div>
          )}

          {erro && <p className="text-sm font-semibold text-marca-vermelho">{erro}</p>}
            </div>

            {/* Linha do tempo COMPLETA do projeto: todas as sessoes, datas e pontos.
                No modo avulso (card ainda nem existe) nao ha o que mostrar. */}
            {!avulso && (
              <div className="min-w-0">
                <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
                  <ListChecks size={13} aria-hidden /> Linha do tempo do projeto
                </span>
                <LinhaDoTempoProjeto
                  registros={cardId ? registrosDoCard(cardId) : []}
                  timerAtivo={timerAtivo && timerAtivo.cardId === cardId ? timerAtivo : undefined}
                  servicos={
                    cardId
                      ? cards
                          .filter((c) => c.tipo === "servico" && (c.cardsVinculados ?? []).includes(cardId))
                          .map<ServicoNaLinha>((s) => ({
                            titulo: s.titulo || "Serviço",
                            registros: registrosDoCard(s.id),
                            timer: timerAtivo && timerAtivo.cardId === s.id ? timerAtivo : undefined,
                          }))
                      : []
                  }
                />
              </div>
            )}
          </div>
        </div>

        {/* Rodape */}
        <div className="flex items-center justify-between gap-3 border-t border-marca-cinza/30 bg-marca-branco px-5 py-3">
          {editando ? (
            confirmandoExcluir ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-marca-preto">Excluir?</span>
                <button
                  type="button"
                  onClick={excluir}
                  className="rounded-marca px-2.5 py-1.5 text-sm font-semibold text-white"
                  style={{ backgroundColor: "#EC1313" }}
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmandoExcluir(false)}
                  className="text-sm font-semibold text-marca-cinza hover:text-marca-azulEscuro"
                >
                  Não
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmandoExcluir(true)}
                className="flex items-center gap-1.5 rounded-marca px-3 py-2 text-sm font-semibold text-marca-vermelho transition hover:bg-marca-vermelho/10"
              >
                <Trash2 size={16} aria-hidden /> Excluir
              </button>
            )
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={salvar}
            className="flex items-center gap-1.5 rounded-marca bg-marca-laranja px-4 py-2 text-sm font-bold text-white transition hover:brightness-95"
          >
            {editando ? <Save size={16} aria-hidden /> : <Plus size={16} aria-hidden />}
            {editando ? "Salvar" : "Lançar"}
          </button>
        </div>
      </div>
    </div>
  );
}
