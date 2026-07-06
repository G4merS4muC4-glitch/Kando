"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Shuffle, Plus, Trash2, CalendarClock } from "lucide-react";
import { TIPOS, TIPOS_ORDEM, campanhaArquivada } from "@/lib/config";
import { useBoard } from "@/lib/store";
import type { Marca, TipoConteudo } from "@/lib/types";
import { chaveData, gerarId } from "@/lib/util";
import { planejarDistribuicao, type RegraDistribuicao } from "@/lib/redistribuir";

const CHAVE_CONFIG = "kando:redistribuir-config";
const inputClasse =
  "rounded-marca border border-marca-cinza/40 bg-white px-2.5 py-1.5 text-sm text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40";

interface ConfigSalva {
  regras: RegraDistribuicao[];
  semanas: number;
  soDiasUteis: boolean;
}

function lerConfig(): ConfigSalva | null {
  if (typeof window === "undefined") return null;
  try {
    const cru = window.localStorage.getItem(CHAVE_CONFIG);
    if (!cru) return null;
    const c = JSON.parse(cru) as ConfigSalva;
    if (Array.isArray(c?.regras)) return c;
  } catch {
    // ignora
  }
  return null;
}

/**
 * Redistribuicao automatica: espalha os conteudos pelos dias conforme regras de
 * cota por semana (marca e/ou tipo). Reorganiza todos os cards ativos (nao
 * publicados); os que nao entram em nenhuma cota ficam como estao.
 */
export default function ModalRedistribuir({ onFechar }: { onFechar: () => void }) {
  const { cards, campanhas, marcas, etapaPostado, atualizarCard } = useBoard();

  const salva = useMemo(() => lerConfig(), []);
  const [regras, setRegras] = useState<RegraDistribuicao[]>(
    () => salva?.regras ?? [{ id: gerarId(), porSemana: 3 }]
  );
  const [semanas, setSemanas] = useState<number>(() => salva?.semanas ?? 4);
  const [soDiasUteis, setSoDiasUteis] = useState<boolean>(() => salva?.soDiasUteis ?? false);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", aoTeclar);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [onFechar]);

  const marcaPorCampanha = useMemo(() => {
    const m = new Map<string, Marca>();
    campanhas.forEach((c) => m.set(c.id, c.marca));
    return m;
  }, [campanhas]);

  const candidatos = useMemo(() => {
    const ativas = new Set(campanhas.filter((c) => !campanhaArquivada(c.status)).map((c) => c.id));
    return cards.filter((c) => ativas.has(c.campanhaId) && c.etapa !== etapaPostado.id);
  }, [cards, campanhas, etapaPostado]);

  const hoje = useMemo(() => chaveData(new Date()), []);
  const plano = useMemo(
    () =>
      planejarDistribuicao(
        candidatos,
        (c) => marcaPorCampanha.get(c.campanhaId),
        regras,
        Math.max(1, semanas),
        hoje,
        soDiasUteis
      ),
    [candidatos, marcaPorCampanha, regras, semanas, hoje, soDiasUteis]
  );

  const totalCota = regras.reduce((s, r) => s + (r.porSemana > 0 ? r.porSemana : 0), 0);
  const podeDistribuir = totalCota > 0 && plano.length > 0;

  function addRegra() {
    setRegras((r) => [...r, { id: gerarId(), porSemana: 1 }]);
  }
  function updRegra(id: string, patch: Partial<RegraDistribuicao>) {
    setRegras((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }
  function delRegra(id: string) {
    setRegras((r) => r.filter((x) => x.id !== id));
  }

  function distribuir() {
    const mapa = new Map(cards.map((c) => [c.id, c]));
    plano.forEach(({ cardId, data }) => {
      const c = mapa.get(cardId);
      if (c && c.dataPublicacao !== data) atualizarCard({ ...c, dataPublicacao: data });
    });
    try {
      window.localStorage.setItem(CHAVE_CONFIG, JSON.stringify({ regras, semanas, soDiasUteis }));
    } catch {
      // sem localStorage: nao guarda a config
    }
    onFechar();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-stretch justify-center bg-marca-preto/50 p-0 animate-fadeIn sm:items-center sm:p-4"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label="Redistribuir conteúdos automaticamente"
    >
      <div
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-modal sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-marca"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 bg-marca-azulEscuro px-5 py-4 text-white">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-marca bg-marca-laranja">
              <Shuffle size={16} aria-hidden />
            </span>
            <div>
              <p className="text-xs uppercase tracking-wide text-white/70">Calendário</p>
              <h2 className="text-base font-bold">Redistribuir automaticamente</h2>
            </div>
          </div>
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
          <p className="text-sm text-marca-cinza">
            Defina quantos conteúdos de cada regra entram por semana. O calendário reorganiza os
            conteúdos ativos (não publicados) espalhando pelos dias; o que não entra em nenhuma
            cota fica como está.
          </p>

          {/* Regras */}
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-marca-azulEscuro">
              Regras por semana
            </p>
            <div className="space-y-2">
              {regras.map((r) => (
                <div key={r.id} className="flex items-center gap-2">
                  <select
                    value={r.marca ?? ""}
                    onChange={(e) => updRegra(r.id, { marca: (e.target.value || undefined) as Marca | undefined })}
                    className={`${inputClasse} min-w-0 flex-1`}
                    aria-label="Marca da regra"
                  >
                    <option value="">Qualquer marca</option>
                    {marcas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                  </select>
                  <select
                    value={r.tipo ?? ""}
                    onChange={(e) =>
                      updRegra(r.id, { tipo: (e.target.value || undefined) as TipoConteudo | undefined })
                    }
                    className={`${inputClasse} min-w-0 flex-1`}
                    aria-label="Tipo da regra"
                  >
                    <option value="">Qualquer tipo</option>
                    {TIPOS_ORDEM.map((t) => (
                      <option key={t} value={t}>
                        {TIPOS[t].label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={r.porSemana}
                    onChange={(e) => updRegra(r.id, { porSemana: Math.max(0, Number(e.target.value) || 0) })}
                    className={`${inputClasse} w-16 text-center`}
                    aria-label="Quantidade por semana"
                    title="Por semana"
                  />
                  <button
                    type="button"
                    onClick={() => delRegra(r.id)}
                    aria-label="Remover regra"
                    className="shrink-0 rounded-marca p-2 text-marca-cinza transition hover:text-marca-vermelho"
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addRegra}
              className="mt-2 flex items-center gap-1.5 rounded-marca border border-dashed border-marca-cinza/50 px-3 py-2 text-sm font-semibold text-marca-cinza transition hover:border-marca-laranja hover:text-marca-laranja"
            >
              <Plus size={15} aria-hidden /> Adicionar regra
            </button>
          </div>

          {/* Semanas + dias */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-marca-azulEscuro">
                Semanas (a partir de hoje)
              </span>
              <input
                type="number"
                min={1}
                max={26}
                value={semanas}
                onChange={(e) => setSemanas(Math.max(1, Math.min(26, Number(e.target.value) || 1)))}
                className={`${inputClasse} w-full`}
              />
            </label>
            <label className="flex items-end gap-2 pb-1">
              <input
                type="checkbox"
                checked={soDiasUteis}
                onChange={(e) => setSoDiasUteis(e.target.checked)}
                className="h-4 w-4 accent-marca-laranja"
              />
              <span className="text-sm text-marca-preto">Só dias úteis (seg a sex)</span>
            </label>
          </div>

          {/* Previa */}
          <div className="flex items-center gap-2 rounded-marca border border-marca-cinza/30 bg-marca-branco px-3 py-2.5 text-sm">
            <CalendarClock size={16} className="shrink-0 text-marca-azulEscuro" aria-hidden />
            <span className="text-marca-preto">
              {podeDistribuir ? (
                <>
                  Vai agendar <strong>{plano.length}</strong> de {candidatos.length} conteúdos ativos nas
                  próximas {Math.max(1, semanas)} semanas.
                </>
              ) : (
                "Defina ao menos uma regra com quantidade maior que zero."
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-marca-cinza/30 bg-marca-branco px-5 py-3">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-marca px-4 py-2 text-sm font-semibold text-marca-cinza transition hover:text-marca-azulEscuro"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={distribuir}
            disabled={!podeDistribuir}
            className="flex items-center gap-1.5 rounded-marca bg-marca-laranja px-4 py-2 text-sm font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Shuffle size={16} aria-hidden /> Distribuir
          </button>
        </div>
      </div>
    </div>
  );
}
