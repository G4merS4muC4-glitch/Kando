"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Checkpoint, RegistroTempo, TimerAtivo } from "./types";
import { agora, gerarId } from "./util";
import { duracaoMs, formatarDuracao } from "./apontamentos";
import {
  assinarApontamentos,
  getApontamentos,
  lerTimerLocal,
  limparTimerLocal,
  salvarApontamentos,
  salvarTimerLocal,
} from "./apontamentosStorage";
import { useOrg } from "./orgProvider";
import { criarClienteNavegador, supabaseConfigurado } from "./supabase/client";

/**
 * Estado central do apontamento de horas (espelha lib/store.tsx).
 *
 * Registros vivem num documento compartilhado; o timer em andamento vive no
 * localStorage do aparelho. O tempo corrido e calculado por diferenca (ver o
 * IndicadorTimerTopo), entao fechar a aba nao para a contagem.
 */

interface Autor {
  id: string;
  nome: string;
}

interface ApontamentosStore {
  registros: RegistroTempo[];
  timerAtivo: TimerAtivo | null;
  autor: Autor;
  pronto: boolean;
  iniciarTimer: (cardId: string, nota?: string) => void;
  pararTimer: () => void;
  ajustarEPararTimer: (fimISO: string) => void; // para com horario de termino corrigido
  descartarTimer: () => void; // descarta sem gravar
  adicionarCheckpoint: (texto: string) => void; // marca um ponto na linha do tempo
  removerCheckpoint: (indice: number) => void; // remove um marcador
  alternarPausa: () => void; // pausa/retoma o timer, registrando a pausa no historico
  adicionarManual: (cardId: string, inicioISO: string, fimISO: string, nota?: string) => void;
  editarRegistro: (reg: RegistroTempo) => void;
  excluirRegistro: (id: string) => void;
  registrosDoCard: (cardId: string) => RegistroTempo[];
  totalMsDoCard: (cardId: string) => number;
}

const AUTOR_LOCAL: Autor = { id: "local", nome: "Você" };

const ApontamentosContext = createContext<ApontamentosStore | null>(null);

export function ApontamentosProvider({ children }: { children: ReactNode }) {
  // A organizacao ativa define de quais horas (registros e timer) cuidamos.
  const { orgId } = useOrg();
  const [registros, setRegistros] = useState<RegistroTempo[]>([]);
  const [timerAtivo, setTimerAtivo] = useState<TimerAtivo | null>(null);
  const [autor, setAutor] = useState<Autor>(AUTOR_LOCAL);
  const [pronto, setPronto] = useState(false);

  // Espelhos para as acoes lerem o valor atual sem depender de closures.
  const registrosRef = useRef(registros);
  registrosRef.current = registros;
  const timerRef = useRef(timerAtivo);
  timerRef.current = timerAtivo;
  const autorRef = useRef(autor);
  autorRef.current = autor;
  const orgIdRef = useRef(orgId);
  orgIdRef.current = orgId;

  // Carrega registros e timer da organizacao ativa, descobre o autor e assina
  // mudancas. Recarrega ao trocar de organizacao.
  useEffect(() => {
    if (!orgId) return;
    let ativo = true;
    setPronto(false);

    getApontamentos(orgId)
      .then((r) => {
        if (!ativo) return;
        setRegistros(r);
        setPronto(true);
      })
      .catch(() => {
        if (ativo) setPronto(true);
      });

    setTimerAtivo(lerTimerLocal(orgId));

    if (supabaseConfigurado()) {
      try {
        const sb = criarClienteNavegador();
        sb.auth
          .getUser()
          .then((res: { data: { user: { id: string; email?: string | null } | null } }) => {
            const u = res.data.user;
            if (ativo && u) setAutor({ id: u.id, nome: u.email ?? "Sem nome" });
          });
      } catch {
        // sem login: mantem autor local
      }
    }

    const cancelar = assinarApontamentos(orgId, (r) => {
      if (ativo) setRegistros(r);
    });

    return () => {
      ativo = false;
      if (cancelar) cancelar();
    };
  }, [orgId]);

  /** Atualiza o estado e persiste a lista inteira (acoes sao pouco frequentes). */
  const aplicar = useCallback((novos: RegistroTempo[]) => {
    setRegistros(novos);
    const org = orgIdRef.current;
    if (org) void salvarApontamentos(org, novos);
  }, []);

  /** Encerra o timer atual gravando um registro (com o fim informado). */
  const pararInterno = useCallback(
    (fimISO: string): void => {
      const t = timerRef.current;
      if (!t) return;
      const ts = agora();
      // Fecha uma pausa em aberto (parou sem retomar): soma a duracao e registra.
      let pausaTotal = t.pausaMs ?? 0;
      const checkpointsFinais = [...(t.checkpoints ?? [])];
      if (t.pausadoEm) {
        const dur = Math.max(0, new Date(fimISO).getTime() - new Date(t.pausadoEm).getTime());
        pausaTotal += dur;
        checkpointsFinais.push({
          id: gerarId(),
          em: t.pausadoEm,
          texto: `Pausa de ${formatarDuracao(dur)}`,
          pausaMs: dur,
        });
      }
      const reg: RegistroTempo = {
        id: gerarId(),
        cardId: t.cardId,
        inicio: t.inicio,
        fim: fimISO,
        nota: t.nota,
        checkpoints: checkpointsFinais.length > 0 ? checkpointsFinais : undefined,
        pausaMs: pausaTotal > 0 ? pausaTotal : undefined,
        autorId: t.autorId,
        autorNome: t.autorNome,
        criadoEm: ts,
        atualizadoEm: ts,
      };
      // Descarta intervalos sem duracao (play/stop acidental).
      if (duracaoMs(reg) > 0) aplicar([reg, ...registrosRef.current]);
      if (orgIdRef.current) limparTimerLocal(orgIdRef.current);
      setTimerAtivo(null);
    },
    [aplicar]
  );

  const pararTimer = useCallback(() => {
    pararInterno(agora());
  }, [pararInterno]);

  const ajustarEPararTimer = useCallback(
    (fimISO: string) => {
      pararInterno(fimISO);
    },
    [pararInterno]
  );

  const descartarTimer = useCallback(() => {
    if (orgIdRef.current) limparTimerLocal(orgIdRef.current);
    setTimerAtivo(null);
  }, []);

  /** Anota um marcador na linha do tempo do timer em andamento. */
  const adicionarCheckpoint = useCallback((texto: string) => {
    const t = timerRef.current;
    const txt = texto.trim();
    if (!t || !txt) return;
    const cp: Checkpoint = { id: gerarId(), em: agora(), texto: txt };
    const novo: TimerAtivo = { ...t, checkpoints: [...(t.checkpoints ?? []), cp] };
    if (orgIdRef.current) salvarTimerLocal(orgIdRef.current, novo);
    setTimerAtivo(novo);
  }, []);

  /** Remove um marcador (corrige um Enter dado por engano). */
  const removerCheckpoint = useCallback((indice: number) => {
    const t = timerRef.current;
    if (!t || !t.checkpoints) return;
    const restantes = t.checkpoints.filter((_, i) => i !== indice);
    const novo: TimerAtivo = {
      ...t,
      checkpoints: restantes.length > 0 ? restantes : undefined,
    };
    if (orgIdRef.current) salvarTimerLocal(orgIdRef.current, novo);
    setTimerAtivo(novo);
  }, []);

  /**
   * Pausa ou retoma o timer. Ao retomar, soma o tempo parado e deixa um marcador
   * "Pausa de Xmin" na linha do tempo, para a pausa ficar registrada no historico.
   */
  const alternarPausa = useCallback(() => {
    const t = timerRef.current;
    if (!t) return;
    let novo: TimerAtivo;
    if (t.pausadoEm) {
      const fimIso = agora();
      const dur = Math.max(0, new Date(fimIso).getTime() - new Date(t.pausadoEm).getTime());
      const cp: Checkpoint = {
        id: gerarId(),
        em: t.pausadoEm, // marca a pausa onde ela comecou, nao no retomo
        texto: `Pausa de ${formatarDuracao(dur)}`,
        pausaMs: dur,
      };
      novo = {
        ...t,
        pausadoEm: undefined,
        pausaMs: (t.pausaMs ?? 0) + dur,
        checkpoints: [...(t.checkpoints ?? []), cp],
      };
    } else {
      novo = { ...t, pausadoEm: agora() };
    }
    if (orgIdRef.current) salvarTimerLocal(orgIdRef.current, novo);
    setTimerAtivo(novo);
  }, []);

  const iniciarTimer = useCallback(
    (cardId: string, nota?: string) => {
      // Um timer por vez: para o atual (gravando) antes de iniciar o novo.
      if (timerRef.current) pararInterno(agora());
      const a = autorRef.current;
      const novo: TimerAtivo = {
        cardId,
        inicio: agora(),
        nota: nota?.trim() || undefined,
        autorId: a.id,
        autorNome: a.nome,
      };
      if (orgIdRef.current) salvarTimerLocal(orgIdRef.current, novo);
      setTimerAtivo(novo);
    },
    [pararInterno]
  );

  const adicionarManual = useCallback(
    (cardId: string, inicioISO: string, fimISO: string, nota?: string) => {
      const a = autorRef.current;
      const ts = agora();
      const reg: RegistroTempo = {
        id: gerarId(),
        cardId,
        inicio: inicioISO,
        fim: fimISO,
        nota: nota?.trim() || undefined,
        autorId: a.id,
        autorNome: a.nome,
        criadoEm: ts,
        atualizadoEm: ts,
      };
      aplicar([reg, ...registrosRef.current]);
    },
    [aplicar]
  );

  const editarRegistro = useCallback(
    (reg: RegistroTempo) => {
      aplicar(
        registrosRef.current.map((r) => (r.id === reg.id ? { ...reg, atualizadoEm: agora() } : r))
      );
    },
    [aplicar]
  );

  const excluirRegistro = useCallback(
    (id: string) => {
      aplicar(registrosRef.current.filter((r) => r.id !== id));
    },
    [aplicar]
  );

  const seletores = useMemo(() => {
    const registrosDoCard = (cardId: string) => registros.filter((r) => r.cardId === cardId);
    const totalMsDoCard = (cardId: string) =>
      registros.reduce((s, r) => (r.cardId === cardId ? s + duracaoMs(r) : s), 0);
    return { registrosDoCard, totalMsDoCard };
  }, [registros]);

  const valor: ApontamentosStore = useMemo(
    () => ({
      registros,
      timerAtivo,
      autor,
      pronto,
      iniciarTimer,
      pararTimer,
      ajustarEPararTimer,
      descartarTimer,
      adicionarCheckpoint,
      removerCheckpoint,
      alternarPausa,
      adicionarManual,
      editarRegistro,
      excluirRegistro,
      ...seletores,
    }),
    [
      registros,
      timerAtivo,
      autor,
      pronto,
      iniciarTimer,
      pararTimer,
      ajustarEPararTimer,
      descartarTimer,
      adicionarCheckpoint,
      removerCheckpoint,
      alternarPausa,
      adicionarManual,
      editarRegistro,
      excluirRegistro,
      seletores,
    ]
  );

  return <ApontamentosContext.Provider value={valor}>{children}</ApontamentosContext.Provider>;
}

/** Hook para acessar o apontamento de horas. */
export function useApontamentos(): ApontamentosStore {
  const ctx = useContext(ApontamentosContext);
  if (!ctx) {
    throw new Error("useApontamentos precisa estar dentro de <ApontamentosProvider>");
  }
  return ctx;
}
