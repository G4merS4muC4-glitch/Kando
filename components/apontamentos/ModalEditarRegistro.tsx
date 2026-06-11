"use client";

import { useState } from "react";
import { X, Save, Trash2, Plus } from "lucide-react";
import { useBoard } from "@/lib/store";
import { useApontamentos } from "@/lib/apontamentosProvider";
import { deInputLocal, formatarDuracao, paraInputLocal } from "@/lib/apontamentos";
import { agora } from "@/lib/util";
import type { RegistroTempo } from "@/lib/types";

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
  const { cards, campanhas, marcas } = useBoard();
  const { editarRegistro, adicionarManual, excluirRegistro } = useApontamentos();

  const editando = Boolean(registro);
  const [cardId, setCardId] = useState(registro?.cardId ?? cardIdPadrao ?? "");
  const [inicio, setInicio] = useState(paraInputLocal(registro?.inicio ?? agora()));
  const [fim, setFim] = useState(paraInputLocal(registro?.fim ?? agora()));
  const [nota, setNota] = useState(registro?.nota ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [confirmandoExcluir, setConfirmandoExcluir] = useState(false);

  const inicioISO = deInputLocal(inicio);
  const fimISO = deInputLocal(fim);
  const inicioMs = inicioISO ? new Date(inicioISO).getTime() : NaN;
  const fimMs = fimISO ? new Date(fimISO).getTime() : NaN;
  const valido = Number.isFinite(inicioMs) && Number.isFinite(fimMs) && fimMs > inicioMs;
  const durMs = valido ? fimMs - inicioMs : 0;
  const durMin = valido ? Math.round(durMs / 60000) : 0;
  const muitoLongo = durMs > AVISO_LONGO_MS;

  function mudarDuracaoMin(valor: string) {
    const min = Number(valor);
    if (!inicioISO || !Number.isFinite(min) || min < 0) return;
    const novoFim = new Date(new Date(inicioISO).getTime() + min * 60000);
    setFim(paraInputLocal(novoFim.toISOString()));
    setErro(null);
  }

  function salvar() {
    if (!cardId) {
      setErro("Escolha o projeto ou card.");
      return;
    }
    if (!valido) {
      setErro("O término precisa ser depois do início.");
      return;
    }
    if (durMs > 24 * 3_600_000) {
      setErro("Esse intervalo passa de 24 horas. Confira o início e o fim.");
      return;
    }
    if (editando && registro) {
      editarRegistro({ ...registro, cardId, inicio: inicioISO, fim: fimISO, nota });
    } else {
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
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-modal sm:h-auto sm:max-h-[90vh] sm:max-w-md sm:rounded-marca"
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

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Projeto/card */}
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

          {erro && <p className="text-sm font-semibold text-marca-vermelho">{erro}</p>}
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
