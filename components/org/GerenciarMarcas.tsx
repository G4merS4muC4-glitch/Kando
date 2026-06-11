"use client";

import { useState } from "react";
import { X, Plus, Trash2, Tag } from "lucide-react";
import { useBoard } from "@/lib/store";
import { corClara } from "@/lib/util";

/**
 * Gerencia as marcas da organizacao (nome + cor). A cor identifica a marca nos
 * cards, no calendario e nas horas. Excluir uma marca em uso deixa as campanhas
 * dela sem marca (pedimos confirmacao). Salva no mesmo quadro da organizacao.
 */
export default function GerenciarMarcas({ onFechar }: { onFechar: () => void }) {
  const { marcas, campanhas, adicionarMarca, atualizarMarca, excluirMarca } = useBoard();
  const [confirmando, setConfirmando] = useState<string | null>(null);

  const usadaPor = (id: string) => campanhas.filter((c) => c.marca === id).length;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-stretch justify-center bg-marca-preto/50 p-0 animate-fadeIn sm:items-center sm:p-4"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label="Gerenciar marcas"
    >
      <div
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-modal sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-marca"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 bg-marca-azulEscuro px-5 py-4 text-white">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Tag size={18} aria-hidden /> Marcas da organização
          </h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-marca p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto px-5 py-5">
          <p className="text-sm text-marca-cinza">
            Cadastre as marcas (ou empresas) que você gerencia. A cor identifica a marca
            nos cards, no calendário e nas horas.
          </p>

          {marcas.length === 0 && (
            <p className="rounded-marca border border-dashed border-marca-cinza/40 px-4 py-6 text-center text-sm text-marca-cinza">
              Nenhuma marca ainda. Adicione a primeira abaixo.
            </p>
          )}

          {marcas.map((m) => {
            const emUso = usadaPor(m.id);
            const confirmar = confirmando === m.id;
            return (
              <div
                key={m.id}
                className="flex items-center gap-2 rounded-marca border border-marca-cinza/30 bg-white p-2"
              >
                <input
                  type="color"
                  value={m.cor}
                  onChange={(e) =>
                    atualizarMarca({ ...m, cor: e.target.value, corSuave: corClara(e.target.value) })
                  }
                  aria-label={`Cor de ${m.nome}`}
                  className="h-9 w-9 shrink-0 cursor-pointer rounded border border-marca-cinza/30 bg-white p-0.5"
                />
                <input
                  type="text"
                  value={m.nome}
                  onChange={(e) => atualizarMarca({ ...m, nome: e.target.value })}
                  maxLength={40}
                  placeholder="Nome da marca"
                  className="min-w-0 flex-1 rounded-marca border border-marca-cinza/40 px-2.5 py-1.5 text-sm text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
                />
                {confirmar ? (
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        excluirMarca(m.id);
                        setConfirmando(null);
                      }}
                      className="rounded-marca px-2 py-1.5 text-xs font-bold text-white"
                      style={{ backgroundColor: "#EC1313" }}
                    >
                      Excluir
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmando(null)}
                      className="rounded-marca px-2 py-1.5 text-xs font-semibold text-marca-cinza hover:text-marca-azulEscuro"
                    >
                      Não
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmando(m.id)}
                    aria-label={`Excluir ${m.nome}`}
                    title={
                      emUso > 0
                        ? `${emUso} campanha(s) usam esta marca; elas ficarão sem marca`
                        : "Excluir marca"
                    }
                    className="shrink-0 rounded-marca p-1.5 text-marca-cinza transition hover:bg-marca-vermelho/10 hover:text-marca-vermelho"
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => adicionarMarca()}
            className="mt-2 flex items-center gap-1.5 rounded-marca border border-dashed border-marca-laranja/60 px-3 py-2 text-sm font-bold text-marca-laranja transition hover:bg-marca-laranja/5"
          >
            <Plus size={16} aria-hidden /> Adicionar marca
          </button>
        </div>

        <div className="flex justify-end border-t border-marca-cinza/30 bg-marca-branco px-5 py-3">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-marca bg-marca-laranja px-4 py-2 text-sm font-bold text-white transition hover:brightness-95"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}
