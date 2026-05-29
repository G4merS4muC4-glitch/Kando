"use client";

import { Lightbulb, Target, TrendingUp } from "lucide-react";
import { TIPOS } from "@/lib/config";
import { TIPOS_METRICA, type MetricasInstagram, type PerfilMetrica } from "@/lib/metricas";
import CardRecomendacao from "./CardRecomendacao";

/**
 * Aba Planejamento: le os insights e recomendacoes da analise e permite virar
 * cada recomendacao em um card no quadro. Tambem sugere uma cadencia simples a
 * partir dos formatos com melhor desempenho (sem inventar numeros).
 */
export default function PainelPlanejamento({
  dados,
  perfil,
}: {
  dados: MetricasInstagram;
  perfil: PerfilMetrica;
}) {
  // Filtra vazios: campos parciais podem trazer null/strings vazias na lista.
  const insights = (dados.insights ?? []).filter((t) => typeof t === "string" && t.trim() !== "");
  const recomendacoes = (dados.recomendacoes ?? []).filter((r) => r && r.titulo);

  // Cadencia sugerida: formato de maior alcance e de maior engajamento.
  const porAlcance = TIPOS_METRICA.filter((t) => dados.alcance_por_tipo?.[t] != null).sort(
    (a, b) => (dados.alcance_por_tipo![b] as number) - (dados.alcance_por_tipo![a] as number)
  );
  const porEngaj = TIPOS_METRICA.filter(
    (t) => dados.engajamento_por_tipo?.[t]?.taxa_pct != null
  ).sort(
    (a, b) =>
      (dados.engajamento_por_tipo![b]!.taxa_pct as number) -
      (dados.engajamento_por_tipo![a]!.taxa_pct as number)
  );
  const melhorAlcance = porAlcance[0];
  const melhorEngaj = porEngaj[0];

  if (insights.length === 0 && recomendacoes.length === 0) {
    return (
      <p className="rounded-marca border border-dashed border-marca-cinza/40 px-4 py-10 text-center text-sm text-marca-cinza">
        Atualize as metricas para ver os insights e as recomendacoes de conteudo.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cadencia sugerida */}
      {(melhorAlcance || melhorEngaj) && (
        <div className="rounded-marca border border-marca-cinza/30 bg-marca-branco p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-marca-azulEscuro">
            <TrendingUp size={14} aria-hidden /> Cadencia sugerida
          </p>
          <ul className="space-y-1 text-sm text-marca-preto">
            {melhorAlcance && (
              <li>
                Priorize <strong>{TIPOS[melhorAlcance].label}</strong>: foi o formato de maior
                alcance no periodo.
              </li>
            )}
            {melhorEngaj && melhorEngaj !== melhorAlcance && (
              <li>
                <strong>{TIPOS[melhorEngaj].label}</strong> teve a melhor taxa de engajamento; vale
                manter na rotacao.
              </li>
            )}
          </ul>
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-marca-azulEscuro">
            <Lightbulb size={16} aria-hidden /> Insights do periodo
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {insights.map((texto, i) => (
              <div
                key={i}
                className="rounded-marca border border-marca-cinza/30 bg-white p-3 text-sm text-marca-preto shadow-card"
              >
                {texto}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recomendacoes */}
      {recomendacoes.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-marca-azulEscuro">
            <Target size={16} aria-hidden /> Recomendacoes de conteudo
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {recomendacoes.map((rec, i) => (
              <CardRecomendacao key={i} rec={rec} perfil={perfil} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
