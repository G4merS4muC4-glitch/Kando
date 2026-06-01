"use client";

import { Clock, User } from "lucide-react";
import { MARCAS } from "@/lib/config";
import type { CardConteudo, Marca, RegistroTempo } from "@/lib/types";
import { duracaoMs, formatarDuracao, diaDoRegistro, horaLocal } from "@/lib/apontamentos";
import { formatarData } from "@/lib/util";
import BadgeTipo from "@/components/BadgeTipo";

/** Mostra so o nome (antes do @) quando o autor for um e-mail. */
function nomeCurto(nome: string): string {
  if (!nome) return "Sem nome";
  return nome.includes("@") ? nome.split("@")[0] : nome;
}

/** Minicard de um registro de horas. Clicar abre o detalhe (editar). */
export default function CardRegistro({
  registro,
  card,
  marca,
  onAbrir,
}: {
  registro: RegistroTempo;
  card?: CardConteudo;
  marca?: Marca;
  onAbrir: (reg: RegistroTempo) => void;
}) {
  const corMarca = marca ? MARCAS[marca].cor : "#8790AB";
  return (
    <button
      type="button"
      onClick={() => onAbrir(registro)}
      className="flex w-full items-stretch gap-2 rounded-marca border border-marca-cinza/30 bg-white p-2.5 text-left shadow-card transition hover:border-marca-cinza/60 hover:shadow-cardHover"
    >
      <span className="w-1 shrink-0 rounded-full" style={{ backgroundColor: corMarca }} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="mb-1 flex items-center gap-1.5">
          {card && <BadgeTipo tipo={card.tipo} tamanho="pequeno" />}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-marca-preto">
            {card?.titulo || "Card removido"}
          </span>
          <span className="shrink-0 text-sm font-bold text-marca-azulEscuro">
            {formatarDuracao(duracaoMs(registro))}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-marca-cinza">
          <span className="flex items-center gap-1">
            <Clock size={11} aria-hidden />
            {formatarData(diaDoRegistro(registro))} · {horaLocal(registro.inicio)}–{horaLocal(registro.fim)}
          </span>
          <span className="flex items-center gap-1">
            <User size={11} aria-hidden /> {nomeCurto(registro.autorNome)}
          </span>
        </span>
        {registro.nota && (
          <span className="mt-1 block truncate text-xs text-marca-cinza/90">{registro.nota}</span>
        )}
      </span>
    </button>
  );
}
