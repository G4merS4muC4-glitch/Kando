"use client";

import { useMemo, useState } from "react";
import { X, Play, Search, AlertTriangle, History } from "lucide-react";
import { MARCAS, MARCAS_ORDEM, campanhaArquivada } from "@/lib/config";
import { useBoard } from "@/lib/store";
import { useApontamentos } from "@/lib/apontamentosProvider";
import type { CardConteudo, Marca, MarcaFiltro } from "@/lib/types";
import BadgeTipo from "@/components/BadgeTipo";

/**
 * Escolhe em qual card (projeto ou conteudo) o timer vai contar. Tem busca,
 * filtro por marca, atalho para os usados recentemente e uma nota opcional.
 * Se ja houver um timer rodando, avisa que iniciar um novo para o atual.
 */
export default function ModalIniciarTimer({ onFechar }: { onFechar: () => void }) {
  const { cards, campanhas, campanhaPorId } = useBoard();
  const { registros, timerAtivo, iniciarTimer } = useApontamentos();

  const [busca, setBusca] = useState("");
  const [marcaFiltro, setMarcaFiltro] = useState<MarcaFiltro>("todas");
  const [selecionadoId, setSelecionadoId] = useState<string>("");
  const [nota, setNota] = useState("");

  const marcaPorCampanha = useMemo(() => {
    const m = new Map<string, Marca>();
    campanhas.forEach((c) => m.set(c.id, c.marca));
    return m;
  }, [campanhas]);

  // Cards de campanhas ativas (nao arquivadas), com busca e filtro de marca.
  const disponiveis = useMemo(() => {
    const arquivadas = new Set(
      campanhas.filter((c) => campanhaArquivada(c.status)).map((c) => c.id)
    );
    const termo = busca.trim().toLowerCase();
    return cards
      .filter((c) => !arquivadas.has(c.campanhaId))
      .filter((c) => marcaFiltro === "todas" || marcaPorCampanha.get(c.campanhaId) === marcaFiltro)
      .filter((c) => !termo || c.titulo.toLowerCase().includes(termo))
      .slice(0, 60);
  }, [cards, campanhas, marcaFiltro, marcaPorCampanha, busca]);

  // Cards usados recentemente em timers (mais novos primeiro), que ainda existem.
  const recentes = useMemo(() => {
    const vistos = new Set<string>();
    const ids: string[] = [];
    [...registros]
      .sort((a, b) => (a.atualizadoEm < b.atualizadoEm ? 1 : -1))
      .forEach((r) => {
        if (!vistos.has(r.cardId)) {
          vistos.add(r.cardId);
          ids.push(r.cardId);
        }
      });
    return ids
      .map((id) => cards.find((c) => c.id === id))
      .filter((c): c is CardConteudo => Boolean(c))
      .slice(0, 6);
  }, [registros, cards]);

  const cardRodando = timerAtivo ? cards.find((c) => c.id === timerAtivo.cardId) : null;

  function confirmar() {
    if (!selecionadoId) return;
    iniciarTimer(selecionadoId, nota);
    onFechar();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-stretch justify-center bg-marca-preto/50 p-0 animate-fadeIn sm:items-center sm:p-4"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label="Iniciar timer"
    >
      <div
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-modal sm:h-auto sm:max-h-[88vh] sm:max-w-lg sm:rounded-marca"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecalho */}
        <div className="flex items-center justify-between gap-3 bg-marca-azulEscuro px-5 py-4 text-white">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Play size={18} aria-hidden /> Iniciar timer
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

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {cardRodando && (
            <div className="mb-4 flex items-start gap-2 rounded-marca border border-marca-laranja/40 bg-marca-laranja/5 px-3 py-2.5 text-sm text-marca-azulEscuro">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-marca-laranja" aria-hidden />
              <span>
                Já existe um timer rodando em{" "}
                <strong>{cardRodando.titulo || "Sem título"}</strong>. Iniciar um novo vai parar e
                salvar o atual.
              </span>
            </div>
          )}

          {/* Busca */}
          <div className="relative mb-3">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-marca-cinza"
              aria-hidden
            />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              autoFocus
              placeholder="Buscar card pelo título"
              className="w-full rounded-marca border border-marca-cinza/40 bg-white py-2 pl-9 pr-3 text-sm text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
            />
          </div>

          {/* Filtro de marca */}
          <div className="mb-3 flex flex-wrap gap-1.5">
            <ChipMarca ativo={marcaFiltro === "todas"} onClick={() => setMarcaFiltro("todas")}>
              Todas
            </ChipMarca>
            {MARCAS_ORDEM.map((m) => (
              <ChipMarca
                key={m}
                ativo={marcaFiltro === m}
                cor={MARCAS[m].cor}
                onClick={() => setMarcaFiltro(m)}
              >
                {MARCAS[m].label}
              </ChipMarca>
            ))}
          </div>

          {/* Recentes */}
          {recentes.length > 0 && busca.trim() === "" && (
            <div className="mb-3">
              <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-marca-cinza">
                <History size={13} aria-hidden /> Usados recentemente
              </p>
              <div className="flex flex-wrap gap-1.5">
                {recentes.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelecionadoId(c.id)}
                    className={`flex max-w-[200px] items-center gap-1.5 rounded-marca border px-2 py-1 text-xs font-semibold transition ${
                      selecionadoId === c.id
                        ? "border-marca-laranja bg-marca-laranja/10 text-marca-azulEscuro"
                        : "border-marca-cinza/40 bg-white text-marca-cinza hover:border-marca-laranja"
                    }`}
                  >
                    <BadgeTipo tipo={c.tipo} tamanho="pequeno" />
                    <span className="truncate">{c.titulo || "Sem título"}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Lista de cards */}
          <div className="space-y-1.5">
            {disponiveis.length === 0 ? (
              <p className="rounded-marca bg-marca-branco px-3 py-6 text-center text-sm text-marca-cinza">
                Nenhum card encontrado.
              </p>
            ) : (
              disponiveis.map((c) => {
                const camp = campanhaPorId(c.campanhaId);
                const ativo = selecionadoId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelecionadoId(c.id)}
                    className={`flex w-full items-center gap-2 rounded-marca border px-3 py-2 text-left transition ${
                      ativo
                        ? "border-marca-laranja bg-marca-laranja/5 ring-1 ring-marca-laranja"
                        : "border-marca-cinza/30 bg-white hover:border-marca-cinza/60"
                    }`}
                  >
                    <BadgeTipo tipo={c.tipo} tamanho="pequeno" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-marca-preto">
                        {c.titulo || "Sem título"}
                      </span>
                      {camp && (
                        <span className="block truncate text-xs text-marca-cinza">
                          {camp.nome} · {MARCAS[camp.marca].label}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Nota */}
          <div className="mt-4">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
              Nota (opcional)
            </label>
            <input
              type="text"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Ex: gravação do roteiro, ajuste de arte"
              className="w-full rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 text-sm text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
            />
          </div>
        </div>

        {/* Rodape */}
        <div className="flex items-center justify-end gap-3 border-t border-marca-cinza/30 bg-marca-branco px-5 py-3">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-marca px-4 py-2 text-sm font-semibold text-marca-cinza transition hover:text-marca-azulEscuro"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={!selecionadoId}
            className="flex items-center gap-1.5 rounded-marca bg-marca-laranja px-4 py-2 text-sm font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Play size={15} aria-hidden /> Começar
          </button>
        </div>
      </div>
    </div>
  );
}

function ChipMarca({
  ativo,
  cor,
  onClick,
  children,
}: {
  ativo: boolean;
  cor?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-marca border px-2.5 py-1 text-xs font-semibold transition ${
        ativo ? "border-transparent text-white" : "border-marca-cinza/40 bg-white text-marca-cinza hover:text-marca-azulEscuro"
      }`}
      style={ativo ? { backgroundColor: cor ?? "#002952" } : undefined}
    >
      {cor && !ativo && (
        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: cor }} aria-hidden />
      )}
      {children}
    </button>
  );
}
