/**
 * Configuracao de parada automatica do cronometro (por aparelho). Existe para o
 * timer nao ficar rodando esquecido de madrugada: ele encerra sozinho no horario
 * definido do dia e/ou depois de um maximo de horas seguidas, o que vier primeiro.
 *
 * Como o timer e local do aparelho (ver ApontamentosProvider), a config tambem
 * vive no localStorage do aparelho.
 */

const CHAVE = "kando:auto-parada";

export interface ConfigAutoParada {
  pararNoHorario: boolean; // encerra ao passar de um horario do dia
  horario: string; // "HH:MM" (horario local)
  pararAposHoras: boolean; // encerra depois de rodar X horas seguidas
  maxHoras: number; // limite de horas seguidas
}

export const CONFIG_AUTO_PARADA_PADRAO: ConfigAutoParada = {
  pararNoHorario: true,
  horario: "20:00",
  pararAposHoras: true,
  maxHoras: 12,
};

/** "HH:MM" -> { h, m } (ou null se invalido). */
function parseHorario(horario: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(horario.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return { h, m: min };
}

/**
 * Momento (ms) em que o timer deve parar sozinho, ou null se nenhuma regra se
 * aplica. Considera o horario do dia (proxima ocorrencia a partir do inicio) e o
 * maximo de horas seguidas, devolvendo o MENOR dos dois (o que vier primeiro).
 */
export function limiteAutoParada(inicioISO: string, config: ConfigAutoParada): number | null {
  const inicioMs = new Date(inicioISO).getTime();
  if (!Number.isFinite(inicioMs)) return null;

  const candidatos: number[] = [];

  if (config.pararNoHorario) {
    const hm = parseHorario(config.horario);
    if (hm) {
      const d = new Date(inicioMs);
      const alvo = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hm.h, hm.m, 0, 0);
      // Se o horario ja passou no dia do inicio, vale para o dia seguinte.
      if (alvo.getTime() <= inicioMs) alvo.setDate(alvo.getDate() + 1);
      candidatos.push(alvo.getTime());
    }
  }

  if (config.pararAposHoras && config.maxHoras >= 1) {
    candidatos.push(inicioMs + config.maxHoras * 3_600_000);
  }

  return candidatos.length > 0 ? Math.min(...candidatos) : null;
}

export function lerConfigAutoParada(): ConfigAutoParada {
  if (typeof window === "undefined") return CONFIG_AUTO_PARADA_PADRAO;
  try {
    const cru = window.localStorage.getItem(CHAVE);
    if (!cru) return CONFIG_AUTO_PARADA_PADRAO;
    const c = JSON.parse(cru) as Partial<ConfigAutoParada>;
    return {
      pararNoHorario: Boolean(c.pararNoHorario),
      horario: parseHorario(String(c.horario ?? "")) ? String(c.horario) : CONFIG_AUTO_PARADA_PADRAO.horario,
      pararAposHoras: Boolean(c.pararAposHoras),
      maxHoras:
        typeof c.maxHoras === "number" && c.maxHoras >= 1 && c.maxHoras <= 48
          ? c.maxHoras
          : CONFIG_AUTO_PARADA_PADRAO.maxHoras,
    };
  } catch {
    return CONFIG_AUTO_PARADA_PADRAO;
  }
}

export function salvarConfigAutoParada(config: ConfigAutoParada): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(config));
  } catch {
    // sem localStorage: a config apenas nao persiste
  }
}
