"use client";

import { useMemo } from "react";
import type { RegistroTempo } from "@/lib/types";
import { emHoras, totalPorDia } from "@/lib/apontamentos";
import { DIAS_SEMANA, gerarGradeMes } from "@/lib/util";

/** Laranja da marca em rgba, com transparencia proporcional a intensidade. */
function fundoIntensidade(ms: number, maxMs: number): string {
  if (ms <= 0 || maxMs <= 0) return "transparent";
  const alpha = 0.14 + 0.62 * Math.min(1, ms / maxMs);
  return `rgba(250, 97, 30, ${alpha.toFixed(2)})`;
}

/** Horas no rotulo do dia: "2,5h" / "45min". */
function rotuloHoras(ms: number): string {
  if (ms <= 0) return "";
  const h = emHoras(ms);
  if (h < 1) return `${Math.round(ms / 60000)}min`;
  return `${(h >= 10 ? h.toFixed(0) : h.toFixed(1)).replace(".", ",")}h`;
}

/** Calendario mensal com o total de horas por dia (intensidade proporcional). */
export default function CalendarioHoras({
  ano,
  mes,
  registros,
  diaSelecionado,
  onSelecionarDia,
}: {
  ano: number;
  mes: number;
  registros: RegistroTempo[];
  diaSelecionado: string | null;
  onSelecionarDia: (chave: string) => void;
}) {
  const porDia = useMemo(() => totalPorDia(registros), [registros]);
  const grade = useMemo(() => gerarGradeMes(ano, mes), [ano, mes]);
  const maxMs = useMemo(() => {
    let max = 0;
    grade.forEach((d) => {
      if (d.noMes) max = Math.max(max, porDia.get(d.chave) ?? 0);
    });
    return max;
  }, [grade, porDia]);

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1.5">
        {DIAS_SEMANA.map((d) => (
          <div
            key={d}
            className="py-1 text-center text-xs font-semibold uppercase tracking-wide text-marca-cinza"
          >
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {grade.map((dia) => {
          const ms = porDia.get(dia.chave) ?? 0;
          const ativo = diaSelecionado === dia.chave;
          return (
            <button
              key={dia.chave}
              type="button"
              onClick={() => onSelecionarDia(dia.chave)}
              className={`flex min-h-[72px] flex-col rounded-marca border p-1.5 text-left transition ${
                dia.noMes ? "" : "opacity-45"
              } ${
                ativo
                  ? "border-marca-laranja ring-2 ring-marca-laranja/50"
                  : "border-marca-cinza/25 hover:border-marca-cinza/60"
              }`}
              style={{ backgroundColor: ms > 0 ? fundoIntensidade(ms, maxMs) : "#fff" }}
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center self-end rounded-full text-xs font-semibold ${
                  dia.hoje ? "bg-marca-azulEscuro text-white" : "text-marca-preto"
                }`}
              >
                {dia.data.getDate()}
              </span>
              {ms > 0 && (
                <span className="mt-auto text-xs font-bold text-marca-azulEscuro">
                  {rotuloHoras(ms)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
