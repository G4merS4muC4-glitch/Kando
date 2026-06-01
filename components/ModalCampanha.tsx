"use client";

import { useEffect, useRef, useState } from "react";
import { X, Trash2, Save, CheckCircle2, Ban, RotateCcw } from "lucide-react";
import {
  MARCAS,
  MARCAS_ORDEM,
  STATUS_CAMPANHA,
  TIPOS_CAMPANHA,
  TIPOS_CAMPANHA_ORDEM,
  campanhaArquivada,
} from "@/lib/config";
import { useBoard } from "@/lib/store";
import type { Campanha, Marca, TipoCampanha } from "@/lib/types";

const inputClasse =
  "w-full rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 text-sm text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40";

/**
 * Modal para criar ou editar uma campanha. Usa um rascunho local e so grava no
 * store quando o usuario salva (evita campanhas vazias acidentais).
 */
export default function ModalCampanha({
  campanha,
  onFechar,
  onCriada,
}: {
  campanha?: Campanha; // ausente = criar nova
  onFechar: () => void;
  onCriada?: (marca: Marca) => void; // avisa a marca da campanha recem-criada
}) {
  const { adicionarCampanha, atualizarCampanha, arquivarCampanha, reabrirCampanha, excluirCampanha } =
    useBoard();
  const editando = Boolean(campanha);
  const status = campanha?.status ?? "ativa";
  const arquivada = campanhaArquivada(status);

  const [nome, setNome] = useState(campanha?.nome ?? "");
  const [marca, setMarca] = useState<Marca>(campanha?.marca ?? "brusoft");
  const [tipo, setTipo] = useState<TipoCampanha>(campanha?.tipo ?? "geral");
  const [descricao, setDescricao] = useState(campanha?.descricao ?? "");
  const [inicio, setInicio] = useState(campanha?.inicio ?? "");
  const [fim, setFim] = useState(campanha?.fim ?? "");
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const nomeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nomeRef.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [onFechar]);

  function salvar() {
    // Garante coerencia: se o fim vier antes do inicio, troca a ordem.
    let ini = inicio || undefined;
    let f = fim || undefined;
    if (ini && f && f < ini) {
      [ini, f] = [f, ini];
    }
    const dados = {
      nome: nome.trim() || "Nova campanha",
      marca,
      tipo,
      descricao: descricao.trim() || undefined,
      inicio: ini,
      fim: f,
    };
    if (editando && campanha) {
      atualizarCampanha({ ...campanha, ...dados });
    } else {
      const nova = adicionarCampanha(dados);
      onCriada?.(nova.marca);
    }
    onFechar();
  }

  function confirmarExclusao() {
    if (campanha) excluirCampanha(campanha.id);
    onFechar();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-marca-preto/50 p-0 animate-fadeIn sm:items-center sm:p-4"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label={editando ? "Editar campanha" : "Nova campanha"}
    >
      <div
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-modal sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-marca"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecalho */}
        <div className="flex items-center justify-between gap-3 bg-marca-azulEscuro px-5 py-4 text-white">
          <h2 className="text-base font-bold">{editando ? "Editar campanha" : "Nova campanha"}</h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-marca p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        {/* Conteudo */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <Campo rotulo="Nome da campanha">
            <input
              ref={nomeRef}
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={inputClasse}
              placeholder="Ex: Bimestral Mai/Jun"
            />
          </Campo>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo rotulo="Marca">
              <select
                value={marca}
                onChange={(e) => setMarca(e.target.value as Marca)}
                className={inputClasse}
              >
                {MARCAS_ORDEM.map((m) => (
                  <option key={m} value={m}>
                    {MARCAS[m].label}
                  </option>
                ))}
              </select>
            </Campo>

            <Campo rotulo="Tipo">
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoCampanha)}
                className={inputClasse}
              >
                {TIPOS_CAMPANHA_ORDEM.map((t) => (
                  <option key={t} value={t}>
                    {TIPOS_CAMPANHA[t].label}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <Campo rotulo="Descrição">
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className={`${inputClasse} min-h-[80px] resize-y`}
              placeholder="Foco e objetivo da campanha."
            />
          </Campo>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo rotulo="Início">
              <input
                type="date"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                className={inputClasse}
              />
            </Campo>
            <Campo rotulo="Fim">
              <input
                type="date"
                value={fim}
                min={inicio || undefined}
                onChange={(e) => setFim(e.target.value)}
                className={inputClasse}
              />
            </Campo>
          </div>

          {/* Situacao: concluir, cancelar (arquivar) ou reabrir a campanha. */}
          {editando && campanha && (
            <div className="rounded-marca border border-marca-cinza/30 bg-marca-branco p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-marca-azulEscuro">
                Situação da campanha
              </p>
              {arquivada ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-marca px-2 py-1 text-xs font-bold uppercase tracking-wide text-white"
                    style={{ backgroundColor: STATUS_CAMPANHA[status].cor }}
                  >
                    {(() => {
                      const Icone = STATUS_CAMPANHA[status].icone;
                      return <Icone size={13} aria-hidden />;
                    })()}
                    {STATUS_CAMPANHA[status].label}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      reabrirCampanha(campanha.id);
                      onFechar();
                    }}
                    className="flex items-center gap-1.5 rounded-marca border border-marca-cinza/40 px-3 py-1.5 text-sm font-semibold text-marca-azulEscuro transition hover:bg-white"
                  >
                    <RotateCcw size={15} aria-hidden />
                    Reabrir campanha
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      arquivarCampanha(campanha.id, "concluida");
                      onFechar();
                    }}
                    className="flex items-center gap-1.5 rounded-marca bg-marca-verde px-3 py-1.5 text-sm font-bold text-white transition hover:bg-marca-verdeEscuro"
                  >
                    <CheckCircle2 size={15} aria-hidden />
                    Concluir e arquivar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      arquivarCampanha(campanha.id, "cancelada");
                      onFechar();
                    }}
                    className="flex items-center gap-1.5 rounded-marca border border-marca-cinza/40 px-3 py-1.5 text-sm font-semibold text-marca-cinza transition hover:text-marca-azulEscuro"
                  >
                    <Ban size={15} aria-hidden />
                    Cancelar campanha
                  </button>
                </div>
              )}
              <p className="mt-2 text-xs text-marca-cinza">
                Arquivar tira a campanha da lista de ativas, sem apagar nada. Dá para reabrir quando
                quiser.
              </p>
            </div>
          )}
        </div>

        {/* Rodape */}
        <div className="flex items-center justify-between gap-3 border-t border-marca-cinza/30 bg-marca-branco px-5 py-3">
          {editando ? (
            confirmandoExclusao ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-marca-preto">Excluir a campanha e seus conteúdos?</span>
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
                className="flex items-center gap-1.5 rounded-marca px-3 py-2 text-sm font-semibold text-marca-vermelho transition hover:bg-marca-vermelho/10"
              >
                <Trash2 size={16} aria-hidden />
                Excluir
              </button>
            )
          ) : (
            <span />
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onFechar}
              className="rounded-marca px-4 py-2 text-sm font-semibold text-marca-cinza transition hover:text-marca-azulEscuro"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvar}
              className="flex items-center gap-1.5 rounded-marca bg-marca-laranja px-4 py-2 text-sm font-bold text-white transition hover:brightness-95"
            >
              <Save size={16} aria-hidden />
              {editando ? "Salvar" : "Criar campanha"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
        {rotulo}
      </span>
      {children}
    </label>
  );
}
