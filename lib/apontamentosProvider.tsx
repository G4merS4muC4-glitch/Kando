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
  assinarTimersAtivos,
  deleteTimerAtivo,
  getApontamentos,
  lerTimerLocal,
  lerTimersAtivos,
  limparTimerLocal,
  salvarApontamentos,
  salvarTimerLocal,
  upsertTimerAtivo,
  type TimerEquipe,
} from "./apontamentosStorage";
import { useOrg } from "./orgProvider";
import { lerConfigAutoParada, limiteAutoParada } from "./autoParada";
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
  timersEquipe: TimerEquipe[]; // timers em andamento da equipe (ao vivo), inclui o meu
  autor: Autor;
  pronto: boolean;
  iniciarTimer: (cardId: string, nota?: string) => void;
  pararTimer: () => void;
  ajustarEPararTimer: (fimISO: string) => void; // para com horario de termino corrigido
  descartarTimer: () => void; // descarta sem gravar
  adicionarCheckpoint: (texto: string, tipo?: Checkpoint["tipo"]) => void; // ponto na linha do tempo
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
  const [timersEquipe, setTimersEquipe] = useState<TimerEquipe[]>([]);
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
            if (!ativo || !u) return;
            setAutor({ id: u.id, nome: u.email ?? "Sem nome" });
            // Se um timer comecou antes do login resolver (autor "local"), corrige o
            // autor: atribui o registro a pessoa certa e passa a compartilhar o timer.
            const t = timerRef.current;
            if (t && t.autorId === "local") {
              const corrigido: TimerAtivo = { ...t, autorId: u.id, autorNome: u.email ?? t.autorNome };
              if (orgId) salvarTimerLocal(orgId, corrigido);
              timerRef.current = corrigido;
              setTimerAtivo(corrigido);
            }
          });
      } catch {
        // sem login: mantem autor local
      }
    }

    const cancelar = assinarApontamentos(orgId, (r) => {
      if (ativo) setRegistros(r);
    });

    // Timers em andamento da equipe (ao vivo): carga inicial + realtime.
    setTimersEquipe([]);
    void lerTimersAtivos(orgId).then((t) => {
      if (ativo) setTimersEquipe(t);
    });
    const cancelarTimers = assinarTimersAtivos(orgId, (t) => {
      if (ativo) setTimersEquipe(t);
    });

    return () => {
      ativo = false;
      if (cancelar) cancelar();
      if (cancelarTimers) cancelarTimers();
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
      timerRef.current = null; // sincroniza o ref no mesmo tick
      setTimerAtivo(null); // o efeito de sincronizacao apaga a linha compartilhada
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
    timerRef.current = null;
    setTimerAtivo(null);
  }, []);

  /**
   * Anota um marcador na linha do tempo do timer em andamento. `tipo` distingue
   * nota manual, pausa, troca de etapa ou conclusao de tarefa (para exibir e
   * dar a visao completa do que foi feito em cada sessao).
   */
  const adicionarCheckpoint = useCallback((texto: string, tipo?: Checkpoint["tipo"]) => {
    const t = timerRef.current;
    const txt = texto.trim();
    if (!t || !txt) return;
    const cp: Checkpoint = { id: gerarId(), em: agora(), texto: txt, tipo };
    const novo: TimerAtivo = { ...t, checkpoints: [...(t.checkpoints ?? []), cp] };
    if (orgIdRef.current) salvarTimerLocal(orgIdRef.current, novo);
    // Atualiza o ref no mesmo tick: varios checkpoints disparados juntos (ex.: 2
    // tarefas concluidas) acumulam em vez de o ultimo sobrescrever os anteriores.
    timerRef.current = novo;
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
    timerRef.current = novo;
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
    timerRef.current = novo;
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
      timerRef.current = novo;
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

  // Parada automatica: encerra o timer sozinho no limite configurado (horario do
  // dia e/ou maximo de horas). Confere no load (pega o timer esquecido de um dia
  // para o outro, gravando o fim no limite), a cada 30s e quando a config muda.
  // So roda depois de "pronto": senao os registros ainda nao chegaram (carga
  // assincrona) e gravar o registro do timer sobrescreveria o historico com um so.
  const inicioTimer = timerAtivo?.inicio;
  useEffect(() => {
    if (!inicioTimer || !pronto) return;
    const checar = () => {
      const t = timerRef.current;
      if (!t) return;
      const limite = limiteAutoParada(t.inicio, lerConfigAutoParada());
      if (limite !== null && Date.now() >= limite) {
        ajustarEPararTimer(new Date(limite).toISOString());
      }
    };
    checar();
    const id = window.setInterval(checar, 30_000);
    window.addEventListener("kando:auto-parada", checar);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("kando:auto-parada", checar);
    };
  }, [inicioTimer, pronto, ajustarEPararTimer]);

  // Checkpoints automaticos: quando o card do timer em andamento muda de etapa,
  // volta de etapa ou tem uma tarefa/mini-etapa concluida, marca na linha do tempo
  // (so no MEU timer, e so se nao estiver pausado). Os eventos vem do store.
  useEffect(() => {
    function aoEvento(e: Event) {
      const d = (e as CustomEvent).detail as {
        cardId?: string;
        deTitulo?: string;
        paraTitulo?: string;
        voltou?: boolean;
        tarefa?: { texto?: string };
      } | null;
      const t = timerRef.current;
      if (!d || !t || t.pausadoEm || t.cardId !== d.cardId) return;
      if (e.type === "kando:card-tarefa") {
        adicionarCheckpoint(`Concluiu: ${d.tarefa?.texto?.trim() || "tarefa"}`, "tarefa");
      } else {
        const alvo = d.paraTitulo?.trim() || "outra etapa";
        adicionarCheckpoint(d.voltou ? `Voltou para ${alvo}` : `Avançou para ${alvo}`, "etapa");
      }
    }
    window.addEventListener("kando:card-etapa", aoEvento);
    window.addEventListener("kando:card-tarefa", aoEvento);
    return () => {
      window.removeEventListener("kando:card-etapa", aoEvento);
      window.removeEventListener("kando:card-tarefa", aoEvento);
    };
  }, [adicionarCheckpoint]);

  // Sincroniza o MEU timer com o servidor (compartilhado): fonte unica de verdade.
  // Publica quando ha timer (com o autor ja resolvido) e apaga quando para; assim
  // nao ha corrida de "delete apos upsert" e o timer e republicado no load (o
  // estado vem do localStorage). Guarda org+user para apagar a linha certa.
  const publicadoRef = useRef<{ org: string; userId: string } | null>(null);
  useEffect(() => {
    if (!supabaseConfigurado()) return;
    const org = orgId;
    if (org && timerAtivo && timerAtivo.autorId !== "local") {
      publicadoRef.current = { org, userId: timerAtivo.autorId };
      void upsertTimerAtivo(org, timerAtivo.autorId, timerAtivo);
    } else if (!timerAtivo && publicadoRef.current) {
      const { org: o, userId } = publicadoRef.current;
      publicadoRef.current = null;
      void deleteTimerAtivo(o, userId);
    }
  }, [timerAtivo, orgId]);

  // Batimento (60s): enquanto meu timer existe, reescreve a linha para ela nao
  // virar "fantasma"; e re-le os timers da equipe para sumir com linhas orfas de
  // quem fechou o app sem parar.
  useEffect(() => {
    if (!supabaseConfigurado() || !orgId) return;
    const org = orgId;
    const bater = () => {
      const t = timerRef.current;
      if (t && t.autorId !== "local") void upsertTimerAtivo(org, t.autorId, t);
      void lerTimersAtivos(org).then((x) => setTimersEquipe(x));
    };
    const id = window.setInterval(bater, 60_000);
    return () => window.clearInterval(id);
  }, [orgId]);

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
      timersEquipe,
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
      timersEquipe,
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
