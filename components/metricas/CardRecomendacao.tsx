"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Check, ArrowRight } from "lucide-react";
import { useBoard } from "@/lib/store";
import { campanhaArquivada } from "@/lib/config";
import type { CardConteudo } from "@/lib/types";
import { agora, gerarId } from "@/lib/util";
import type { PerfilMetrica, Recomendacao } from "@/lib/metricas";
import BadgeTipo from "@/components/BadgeTipo";

/**
 * Cartao de uma recomendacao da analise. O botao "Criar card no quadro" abre um
 * seletor de campanha (da marca do perfil) e cria um card na coluna Ideias com
 * titulo, tipo, tema e o "porque" no briefing. Reaproveita a criacao do quadro.
 */
export default function CardRecomendacao({
  rec,
  perfil,
}: {
  rec: Recomendacao;
  perfil: PerfilMetrica;
}) {
  const { campanhas, adicionarCardCompleto } = useBoard();
  const campanhasDaMarca = useMemo(
    () => campanhas.filter((c) => c.marca === perfil && !campanhaArquivada(c.status)),
    [campanhas, perfil]
  );

  const [abrindo, setAbrindo] = useState(false);
  const [campanhaId, setCampanhaId] = useState("");
  const [criadoEm, setCriadoEm] = useState<string | null>(null);

  function criar() {
    const alvo = campanhaId || campanhasDaMarca[0]?.id;
    if (!alvo) return;
    const ts = agora();
    const card: CardConteudo = {
      id: gerarId(),
      campanhaId: alvo,
      titulo: rec.titulo || "Ideia de conteúdo",
      tipo: rec.tipo_sugerido ?? "post",
      canais: ["instagram"],
      etapa: "ideias",
      tema: rec.tema_sugerido ?? "",
      briefing: rec.porque ?? "",
      roteiro: "",
      teleprompter: "",
      legenda: "",
      criadoEm: ts,
      atualizadoEm: ts,
    };
    adicionarCardCompleto(card);
    setCriadoEm(alvo);
    setAbrindo(false);
  }

  return (
    <div className="rounded-marca border border-marca-cinza/30 bg-white p-4 shadow-card">
      <h3 className="text-sm font-bold leading-snug text-marca-preto">{rec.titulo}</h3>
      {rec.porque && <p className="mt-1.5 text-sm text-marca-cinza">{rec.porque}</p>}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {rec.tipo_sugerido && <BadgeTipo tipo={rec.tipo_sugerido} tamanho="pequeno" />}
        {rec.tema_sugerido && (
          <span className="rounded-marca border border-marca-cinza/40 bg-white px-2 py-0.5 text-[11px] font-medium text-marca-azulClaro">
            {rec.tema_sugerido}
          </span>
        )}
      </div>

      <div className="mt-3 border-t border-marca-cinza/20 pt-3">
        {criadoEm ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-marca-verde">
              <Check size={14} aria-hidden /> Card criado em Ideias.
            </span>
            <Link
              href={`/campanha/${criadoEm}`}
              className="flex items-center gap-1 text-xs font-semibold text-marca-laranja hover:gap-1.5"
            >
              Ver no quadro <ArrowRight size={13} aria-hidden />
            </Link>
          </div>
        ) : campanhasDaMarca.length === 0 ? (
          <p className="text-xs text-marca-cinza">
            Crie uma campanha desta marca para transformar a recomendação em card.
          </p>
        ) : abrindo ? (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={campanhaId || campanhasDaMarca[0].id}
              onChange={(e) => setCampanhaId(e.target.value)}
              className="min-w-0 flex-1 rounded-marca border border-marca-cinza/40 bg-white px-2.5 py-2 text-sm text-marca-preto outline-none focus:ring-2 focus:ring-marca-laranja"
            >
              {campanhasDaMarca.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={criar}
              className="flex items-center gap-1.5 rounded-marca bg-marca-laranja px-3 py-2 text-sm font-bold text-white transition hover:brightness-95"
            >
              <Plus size={15} aria-hidden /> Criar
            </button>
            <button
              type="button"
              onClick={() => setAbrindo(false)}
              className="rounded-marca px-2 py-2 text-sm font-semibold text-marca-cinza hover:text-marca-azulEscuro"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAbrindo(true)}
            className="flex items-center gap-1.5 rounded-marca border border-marca-cinza/40 px-3 py-1.5 text-sm font-semibold text-marca-azulEscuro transition hover:border-marca-laranja hover:text-marca-laranja"
          >
            <Plus size={15} aria-hidden /> Criar card no quadro
          </button>
        )}
      </div>
    </div>
  );
}
