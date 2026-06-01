"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useBoard } from "@/lib/store";
import type { RegistroTempo } from "@/lib/types";
import { diaDoRegistro, duracaoMs, emHoras, registrosDoMes, totalPorCard } from "@/lib/apontamentos";
import { chaveData } from "@/lib/util";

const CINZA = "#8790AB";
const PALETA = ["#FA611E", "#044B8C", "#1bbf5d", "#6D4FC0", "#0E7490", "#002952"];
const COR_OUTROS = "#B6BCcc";

type Modo = "total" | "projeto";

/** Barras de horas por dia do mes. Modo "projeto" empilha pelos cards lideres. */
export default function GraficoHorasPorDia({
  ano,
  mes,
  registros,
  modo,
  onModo,
}: {
  ano: number;
  mes: number;
  registros: RegistroTempo[];
  modo: Modo;
  onModo: (m: Modo) => void;
}) {
  const { cardPorId } = useBoard();
  const diasNoMes = useMemo(() => new Date(ano, mes + 1, 0).getDate(), [ano, mes]);
  const regMes = useMemo(() => registrosDoMes(registros, ano, mes), [registros, ano, mes]);

  // Cards lideres do mes (para empilhar); o resto vira "Outros".
  const series = useMemo(() => {
    const tot = totalPorCard(regMes);
    const top = [...tot.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id]) => id);
    const lista = top.map((id, i) => ({
      key: id,
      nome: cardPorId(id)?.titulo || "Card removido",
      cor: PALETA[i % PALETA.length],
    }));
    const temOutros = tot.size > top.length;
    return { lista, top, temOutros };
  }, [regMes, cardPorId]);

  const dados = useMemo(() => {
    return Array.from({ length: diasNoMes }, (_, i) => {
      const dia = i + 1;
      const chave = chaveData(new Date(ano, mes, dia));
      const regsDia = regMes.filter((r) => diaDoRegistro(r) === chave);
      const linha: Record<string, number | string> = { dia: String(dia).padStart(2, "0") };
      if (modo === "total") {
        linha.horas = Number(regsDia.reduce((s, r) => s + emHoras(duracaoMs(r)), 0).toFixed(2));
      } else {
        let outros = 0;
        for (const r of regsDia) {
          const h = emHoras(duracaoMs(r));
          if (series.top.includes(r.cardId)) {
            linha[r.cardId] = Number((((linha[r.cardId] as number) ?? 0) + h).toFixed(2));
          } else {
            outros += h;
          }
        }
        if (series.temOutros) linha.__outros = Number(outros.toFixed(2));
      }
      return linha;
    });
  }, [diasNoMes, ano, mes, regMes, modo, series]);

  const vazio = regMes.length === 0;

  return (
    <div className="rounded-marca border border-marca-cinza/30 bg-white p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-marca-azulEscuro">Horas por dia</p>
        <div className="flex overflow-hidden rounded-marca border border-marca-cinza/40 text-xs font-semibold">
          <button
            type="button"
            onClick={() => onModo("total")}
            className={`px-2.5 py-1 transition ${
              modo === "total" ? "bg-marca-azulEscuro text-white" : "bg-white text-marca-cinza hover:text-marca-azulEscuro"
            }`}
          >
            Total
          </button>
          <button
            type="button"
            onClick={() => onModo("projeto")}
            className={`px-2.5 py-1 transition ${
              modo === "projeto" ? "bg-marca-azulEscuro text-white" : "bg-white text-marca-cinza hover:text-marca-azulEscuro"
            }`}
          >
            Por projeto
          </button>
        </div>
      </div>

      {vazio ? (
        <p className="py-10 text-center text-sm text-marca-cinza">Sem horas neste mês.</p>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dados} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E8F0" />
              <XAxis dataKey="dia" tick={{ fontSize: 10, fill: CINZA }} interval={1} />
              <YAxis tick={{ fontSize: 11, fill: CINZA }} width={40} unit="h" />
              <Tooltip
                formatter={(v, nome) => [`${Number(v).toFixed(1).replace(".", ",")} h`, nome]}
                labelFormatter={(d) => `Dia ${d}`}
              />
              {modo === "total" ? (
                <Bar dataKey="horas" name="Horas" fill="#FA611E" radius={[3, 3, 0, 0]} />
              ) : (
                <>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {series.lista.map((s) => (
                    <Bar key={s.key} dataKey={s.key} name={s.nome} stackId="h" fill={s.cor} />
                  ))}
                  {series.temOutros && (
                    <Bar dataKey="__outros" name="Outros" stackId="h" fill={COR_OUTROS} radius={[3, 3, 0, 0]} />
                  )}
                </>
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
