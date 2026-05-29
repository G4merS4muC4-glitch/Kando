"use client";

import Link from "next/link";
import { Pencil, FileStack, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import { STATUS_CAMPANHA, TIPOS_CAMPANHA, campanhaArquivada } from "@/lib/config";
import type { Campanha, CardConteudo } from "@/lib/types";
import { formatarData, prazoVencido } from "@/lib/util";
import MarcaBadge from "./MarcaBadge";

/**
 * Card de uma campanha na tela inicial. Mostra a marca, o tipo, o periodo e o
 * progresso (quantos conteudos ja foram postados). Abre o quadro da campanha.
 */
export default function CampanhaCard({
  campanha,
  cards,
  onEditar,
}: {
  campanha: Campanha;
  cards: CardConteudo[];
  onEditar: (id: string) => void;
}) {
  const total = cards.length;
  const postados = cards.filter((c) => c.etapa === "publicado").length;
  const vencidos = cards.filter((c) => prazoVencido(c.dataPublicacao, c.etapa)).length;
  const progresso = total > 0 ? Math.round((postados / total) * 100) : 0;
  const tipoConf = TIPOS_CAMPANHA[campanha.tipo];
  const IconeTipo = tipoConf.icone;
  const status = campanha.status ?? "ativa";
  const arquivada = campanhaArquivada(status);

  const periodo =
    campanha.inicio && campanha.fim
      ? `${formatarData(campanha.inicio)} a ${formatarData(campanha.fim)}`
      : campanha.inicio
        ? `desde ${formatarData(campanha.inicio)}`
        : tipoConf.descricao;

  return (
    <Link
      href={`/campanha/${campanha.id}`}
      className={`group flex flex-col rounded-marca border bg-white p-4 shadow-card outline-none transition hover:-translate-y-0.5 hover:shadow-cardHover focus-visible:ring-2 focus-visible:ring-marca-laranja ${
        arquivada ? "border-marca-cinza/30 opacity-75 hover:opacity-100" : "border-marca-cinza/30"
      }`}
    >
      {/* Topo: marca, situacao e editar */}
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <MarcaBadge marca={campanha.marca} />
          {arquivada && (
            <span
              className="inline-flex items-center gap-1 rounded-marca px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
              style={{ backgroundColor: STATUS_CAMPANHA[status].cor }}
            >
              {(() => {
                const Icone = STATUS_CAMPANHA[status].icone;
                return <Icone size={11} aria-hidden />;
              })()}
              {STATUS_CAMPANHA[status].label}
            </span>
          )}
        </div>
        <button
          type="button"
          aria-label="Editar campanha"
          title="Editar campanha"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onEditar(campanha.id);
          }}
          className="rounded-marca p-1.5 text-marca-cinza opacity-0 transition hover:bg-marca-branco hover:text-marca-azulEscuro focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Pencil size={15} aria-hidden />
        </button>
      </div>

      {/* Nome e tipo */}
      <h2 className="text-lg font-bold leading-tight text-marca-azulEscuro">{campanha.nome}</h2>
      <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-marca-cinza">
        <IconeTipo size={13} aria-hidden />
        {tipoConf.label}
      </p>

      {campanha.descricao && (
        <p className="mt-2 line-clamp-2 text-sm text-marca-cinza">{campanha.descricao}</p>
      )}

      <p className="mt-2 text-xs text-marca-cinza">{periodo}</p>

      {/* Progresso */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs text-marca-cinza">
          <span>{postados} de {total} postados</span>
          <span className="font-semibold text-marca-verde">{progresso}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-marca-cinza/20">
          <div
            className="h-full rounded-full bg-marca-verde transition-all"
            style={{ width: `${progresso}%` }}
          />
        </div>
      </div>

      {/* Rodape: contadores */}
      <div className="mt-4 flex items-center justify-between border-t border-marca-cinza/20 pt-3 text-xs">
        <div className="flex items-center gap-3 text-marca-cinza">
          <span className="flex items-center gap-1">
            <FileStack size={14} aria-hidden /> {total}
          </span>
          <span className="flex items-center gap-1 text-marca-verde">
            <CheckCircle2 size={14} aria-hidden /> {postados}
          </span>
          {vencidos > 0 && (
            <span className="flex items-center gap-1 font-semibold text-marca-vermelho">
              <AlertTriangle size={14} aria-hidden /> {vencidos}
            </span>
          )}
        </div>
        <span className="flex items-center gap-1 font-semibold text-marca-laranja transition group-hover:gap-2">
          Abrir quadro <ArrowRight size={14} aria-hidden />
        </span>
      </div>
    </Link>
  );
}
