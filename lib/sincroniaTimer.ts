/**
 * Regra da sincronia do timer entre os aparelhos da mesma pessoa (pura, sem
 * React nem servidor, para testar e entender facil).
 *
 * Cada aparelho tem a sua versao do timer (ou o "parei" mais recente dele) e o
 * servidor tem a ultima publicada (timer rodando, marcador de parado ou nada).
 * Entre dois timers rodando, vence a versao mais nova (carimbo `atualizadoEm`).
 * Um "parei" encerra sempre o MESMO timer (parar e definitivo: quem parou ja
 * gravou o registro) e nunca um timer diferente. Timer que ja virou registro
 * (mesma pessoa, mesmo inicio) conta como parado dos dois lados: e resto de um
 * aparelho que parou sem conseguir avisar.
 */

import type { TimerAtivo, TimerParado } from "./types";

export function ehTimerParado(d: unknown): d is TimerParado {
  return Boolean(d && typeof d === "object" && (d as TimerParado).parado === true);
}

/** Momento da versao de um timer (a ultima mudanca; timers antigos: o inicio). */
export function marcaTimer(t: TimerAtivo): number {
  const ms = new Date(t.atualizadoEm ?? t.inicio).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/** Identidade de uma versao publicada (para nao republicar o que ja esta la). */
export function chaveVersao(estado: TimerAtivo | TimerParado): string {
  return ehTimerParado(estado) ? `parado:${estado.em}` : `rodando:${marcaTimer(estado)}`;
}

export type AcaoSincronia =
  | { tipo: "nada" }
  | { tipo: "adotar"; timer: TimerAtivo } // la e mais nova e esta rodando
  | { tipo: "encerrar"; parado: TimerParado; limparServidor: boolean } // la e mais nova e parou
  | { tipo: "publicar"; estado: TimerAtivo | TimerParado }; // aqui e mais nova

export interface EntradaSincronia {
  local: TimerAtivo | null;
  paradaLocal: TimerParado | null; // o ultimo "parei" conhecido por este aparelho
  remoto: TimerAtivo | TimerParado | null; // a minha linha no servidor
  jaGravado: (inicio: string) => boolean; // ja existe registro meu com este inicio?
}

const emMs = (iso: string) => {
  const ms = new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : 0;
};

/**
 * Decide o que fazer com o timer deste aparelho diante da minha linha no servidor.
 * Como o "parei" so vale para o mesmo timer (mesmo inicio), um aparelho com o
 * relogio adiantado nao derruba o timer novo que comecou em outro.
 */
export function decidirSincronia(e: EntradaSincronia): {
  descartarLocal: boolean; // o timer daqui ja virou registro em outro aparelho
  acao: AcaoSincronia;
} {
  const descartarLocal = Boolean(e.local && e.jaGravado(e.local.inicio));
  const local = descartarLocal ? null : e.local;
  const nada = { descartarLocal, acao: { tipo: "nada" } as AcaoSincronia };

  // Linha rodando de um timer que ja virou registro: e, na verdade, um "parei".
  let remoto = e.remoto;
  let limparServidor = false;
  if (remoto && !ehTimerParado(remoto) && e.jaGravado(remoto.inicio)) {
    remoto = { parado: true, em: new Date(marcaTimer(remoto)).toISOString(), inicioParado: remoto.inicio };
    limparServidor = true;
  }

  // Servidor rodando.
  if (remoto && !ehTimerParado(remoto)) {
    if (local) {
      // Os dois rodando: a versao mais nova vence (o mesmo timer ou um trocado).
      const tl = marcaTimer(local);
      const tr = marcaTimer(remoto);
      if (tr > tl) return { descartarLocal, acao: { tipo: "adotar", timer: remoto } };
      if (tl > tr) return { descartarLocal, acao: { tipo: "publicar", estado: local } };
      return nada;
    }
    // Parei este mesmo timer aqui (parar e definitivo: o registro ja foi gravado):
    // o servidor ficou para tras.
    const p = e.paradaLocal;
    if (p && p.inicioParado === remoto.inicio) {
      return { descartarLocal, acao: { tipo: "publicar", estado: p } };
    }
    return { descartarLocal, acao: { tipo: "adotar", timer: remoto } };
  }

  // Servidor parado (ou sem linha).
  if (local) {
    // O mesmo timer parou em outro aparelho: encerra aqui (parar e definitivo).
    if (remoto && remoto.inicioParado === local.inicio) {
      return { descartarLocal, acao: { tipo: "encerrar", parado: remoto, limparServidor } };
    }
    // Timer diferente do que parou (ou sem linha): o daqui continua.
    return { descartarLocal, acao: { tipo: "publicar", estado: local } };
  }
  if (remoto && limparServidor) {
    return { descartarLocal, acao: { tipo: "encerrar", parado: remoto, limparServidor } };
  }
  // Nada rodando dos dois lados: so atualiza o servidor se o meu "parei" for mais novo.
  const p = e.paradaLocal;
  if (p && (!remoto || emMs(p.em) > emMs(remoto.em))) {
    return { descartarLocal, acao: { tipo: "publicar", estado: p } };
  }
  return nada;
}
