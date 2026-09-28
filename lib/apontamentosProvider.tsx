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
import type { Checkpoint, RegistroTempo, TimerAtivo, TimerParado } from "./types";
import { agora, gerarId } from "./util";
import { duracaoMs, formatarDuracao, timerRecemEscolhido } from "./apontamentos";
import {
  assinarApontamentos,
  assinarTimersAtivos,
  getApontamentos,
  lerMeuTimer,
  lerTimerLocal,
  lerTimersAtivos,
  limparTimerLocal,
  publicarTimerParado,
  salvarApontamentos,
  salvarTimerLocal,
  upsertTimerAtivo,
  type TimerEquipe,
} from "./apontamentosStorage";
import { chaveVersao, decidirSincronia, ehTimerParado } from "./sincroniaTimer";
import { useOrg } from "./orgProvider";
import { lerConfigAutoParada, limiteAutoParada } from "./autoParada";
import { criarClienteNavegador, supabaseConfigurado } from "./supabase/client";

/**
 * Estado central do apontamento de horas (espelha lib/store.tsx).
 *
 * Registros vivem num documento compartilhado; o timer em andamento vive no
 * localStorage do aparelho. O tempo corrido e calculado por diferenca (ver o
 * IndicadorTimerTopo), entao fechar a aba nao para a contagem.
 *
 * Com login, o timer tambem segue a pessoa entre aparelhos: a linha dela em
 * timers_ativos guarda a versao mais nova (carimbada em `atualizadoEm`), ou o
 * marcador de parado. Cada aparelho compara a sua versao com a de la e fica com a
 * mais nova: iniciou no computador, abriu o celular, o timer ja esta correndo ali.
 */

/** Avisa o card flutuante que um timer sem projeto comecou AQUI (ele abre e foca o campo). */
function avisarTimerLivre() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("kando:timer-livre"));
}


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
  // Inicia no card ("" = sem projeto). Recem-iniciado e sem nada anotado, so troca
  // o card do timer; senao grava o trecho atual e comeca um novo.
  iniciarTimer: (cardId: string, nota?: string) => void;
  vincularTimer: (cardId: string, nota?: string) => void; // o timer atual passa a contar no card desde o inicio
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

// Timer sem projeto parado antes disso, sem nada anotado, foi clique sem querer.
const MIN_SEM_PROJETO_MS = 60_000;

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
  const prontoRef = useRef(pronto);
  prontoRef.current = pronto;

  // Sincronia entre aparelhos (ver sincronizar).
  const paradaRef = useRef<TimerParado | null>(null); // ultimo "parei" conhecido por este aparelho
  const versaoPublicadaRef = useRef<string | null>(null); // o que o servidor ja tem (evita eco)
  const sincronizadoRef = useRef(false); // so publica depois de comparar com o servidor
  const sincronizandoRef = useRef(false);
  const pendenteRef = useRef(false);
  const sincronizarRef = useRef<() => Promise<void>>(async () => {});

  /**
   * Troca o timer deste aparelho (estado, ref e localStorage). Toda mudanca feita
   * aqui ganha o carimbo `atualizadoEm`: e por ele que os aparelhos da pessoa
   * sabem qual versao do timer e a mais nova. `carimbar = false` so ao adotar uma
   * versao que veio de outro aparelho (ela ja vem carimbada).
   */
  const definirTimer = useCallback((novo: TimerAtivo | null, carimbar = true) => {
    const final = novo && carimbar ? { ...novo, atualizadoEm: agora() } : novo;
    const org = orgIdRef.current;
    if (org) {
      if (final) salvarTimerLocal(org, final);
      else limparTimerLocal(org);
    }
    timerRef.current = final; // sincroniza o ref no mesmo tick
    setTimerAtivo(final);
  }, []);

  // Carrega registros e timer da organizacao ativa, descobre o autor e assina
  // mudancas. Recarrega ao trocar de organizacao.
  useEffect(() => {
    if (!orgId) return;
    let ativo = true;
    setPronto(false);
    paradaRef.current = null;
    versaoPublicadaRef.current = null;
    sincronizadoRef.current = false;

    getApontamentos(orgId)
      .then((r) => {
        if (!ativo) return;
        setRegistros(r);
        setPronto(true);
      })
      .catch(() => {
        if (ativo) setPronto(true);
      });

    const local = lerTimerLocal(orgId);
    timerRef.current = local;
    setTimerAtivo(local);

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
              definirTimer({ ...t, autorId: u.id, autorNome: u.email ?? t.autorNome });
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
    const cancelarTimers = assinarTimersAtivos(orgId, (t, quemMudou) => {
      if (!ativo) return;
      setTimersEquipe(t);
      // Minha linha mudou (outro aparelho meu mexeu no timer): sincroniza aqui.
      if (quemMudou && quemMudou === autorRef.current.id) void sincronizarRef.current();
    });

    return () => {
      ativo = false;
      if (cancelar) cancelar();
      if (cancelarTimers) cancelarTimers();
    };
  }, [orgId, definirTimer]);

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
      // Descarta intervalos sem duracao (play/stop acidental) e o timer sem projeto
      // parado logo, sem nada anotado (Iniciar clicado sem querer). Tambem nao
      // grava de novo o que outro aparelho meu ja gravou (ex.: os dois pararam
      // sozinhos no limite do dia).
      const dur = duracaoMs(reg);
      const acidental = !t.cardId && checkpointsFinais.length === 0 && dur < MIN_SEM_PROJETO_MS;
      const jaGravado = registrosRef.current.some((r) => r.autorId === t.autorId && r.inicio === t.inicio);
      if (dur > 0 && !acidental && !jaGravado) aplicar([reg, ...registrosRef.current]);
      // Avisa os outros aparelhos que este timer acabou (efeito de publicacao).
      paradaRef.current = { parado: true, em: ts, inicioParado: t.inicio };
      definirTimer(null);
    },
    [aplicar, definirTimer]
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
    const t = timerRef.current;
    if (t) paradaRef.current = { parado: true, em: agora(), inicioParado: t.inicio };
    definirTimer(null);
  }, [definirTimer]);

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
    // O ref e atualizado no mesmo tick: varios checkpoints disparados juntos (ex.: 2
    // tarefas concluidas) acumulam em vez de o ultimo sobrescrever os anteriores.
    definirTimer({ ...t, checkpoints: [...(t.checkpoints ?? []), cp] });
  }, [definirTimer]);

  /** Remove um marcador (corrige um Enter dado por engano). */
  const removerCheckpoint = useCallback((indice: number) => {
    const t = timerRef.current;
    if (!t || !t.checkpoints) return;
    const restantes = t.checkpoints.filter((_, i) => i !== indice);
    definirTimer({ ...t, checkpoints: restantes.length > 0 ? restantes : undefined });
  }, [definirTimer]);

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
    definirTimer(novo);
  }, [definirTimer]);

  /** Troca o card do timer em andamento sem gravar trecho (segue do mesmo inicio). */
  const trocarCardDoTimer = useCallback(
    (t: TimerAtivo, cardId: string, nota?: string) => {
      definirTimer({ ...t, cardId, vinculadoEm: agora(), nota: nota?.trim() || t.nota });
      if (!cardId) avisarTimerLivre();
    },
    [definirTimer]
  );

  const iniciarTimer = useCallback(
    (cardId: string, nota?: string) => {
      const t = timerRef.current;
      // Acabou de comecar (ou de escolher o card) e nada foi anotado: e so a
      // escolha do card (ex.: comecou sem projeto e em seguida escolheu). O timer
      // continua de onde estava, em vez de gravar um trecho de segundos.
      if (t && timerRecemEscolhido(t, Date.now())) {
        if (t.cardId !== cardId) trocarCardDoTimer(t, cardId, nota);
        return;
      }
      // Um timer por vez: para o atual (gravando) antes de iniciar o novo.
      if (t) pararInterno(agora());
      const a = autorRef.current;
      definirTimer({
        cardId,
        inicio: agora(),
        nota: nota?.trim() || undefined,
        autorId: a.id,
        autorNome: a.nome,
      });
      if (!cardId) avisarTimerLivre();
    },
    [pararInterno, trocarCardDoTimer, definirTimer]
  );

  /**
   * O timer em andamento passa a contar no card DESDE O INICIO (ex.: rodou sem
   * projeto e, na verdade, era tudo deste card). Os pontos anotados vao junto.
   */
  const vincularTimer = useCallback(
    (cardId: string, nota?: string) => {
      const t = timerRef.current;
      if (!t) iniciarTimer(cardId, nota);
      else if (t.cardId !== cardId) trocarCardDoTimer(t, cardId, nota);
    },
    [iniciarTimer, trocarCardDoTimer]
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

  /**
   * Sincroniza o MEU timer entre os meus aparelhos: le a minha linha no servidor
   * e fica com a versao mais nova (regra em lib/sincroniaTimer.ts). Roda ao abrir,
   * ao voltar para o app, a cada batida e quando a minha linha muda em tempo real.
   *
   * - La mais nova e rodando: adota (iniciou/pausou/anotou em outro aparelho).
   * - La mais nova e parada: encerra aqui SEM gravar (quem parou ja gravou).
   * - Aqui mais nova: publica a versao daqui.
   */
  const sincronizar = useCallback(async () => {
    const org = orgIdRef.current;
    const eu = autorRef.current.id;
    if (!supabaseConfigurado() || !org || eu === "local" || !prontoRef.current) return;
    if (sincronizandoRef.current) {
      pendenteRef.current = true; // chegou outro aviso no meio: roda de novo no fim
      return;
    }
    sincronizandoRef.current = true;
    try {
      const remoto = await lerMeuTimer(org, eu);
      if (remoto === undefined || orgIdRef.current !== org) return; // falhou: tenta na proxima

      // O timer daqui e lido DEPOIS da espera: pega o que mudou enquanto o servidor respondia.
      const { descartarLocal, acao } = decidirSincronia({
        local: timerRef.current,
        paradaLocal: paradaRef.current,
        remoto,
        jaGravado: (inicio) => registrosRef.current.some((r) => r.autorId === eu && r.inicio === inicio),
      });
      if (descartarLocal) definirTimer(null, false); // parado em outro aparelho (versao antiga do app)

      if (acao.tipo === "adotar") {
        versaoPublicadaRef.current = chaveVersao(acao.timer);
        definirTimer(acao.timer, false); // ja vem carimbado de la
      } else if (acao.tipo === "encerrar") {
        if (timerRef.current) definirTimer(null, false); // quem parou ja gravou o registro
        paradaRef.current = acao.parado;
        versaoPublicadaRef.current = chaveVersao(acao.parado);
        if (acao.limparServidor) await publicarTimerParado(org, eu, acao.parado);
      } else if (acao.tipo === "publicar") {
        versaoPublicadaRef.current = chaveVersao(acao.estado);
        if (ehTimerParado(acao.estado)) await publicarTimerParado(org, eu, acao.estado);
        else await upsertTimerAtivo(org, eu, acao.estado);
      }
      sincronizadoRef.current = true;
    } finally {
      sincronizandoRef.current = false;
      if (pendenteRef.current) {
        pendenteRef.current = false;
        void sincronizarRef.current();
      }
    }
  }, [definirTimer]);
  sincronizarRef.current = sincronizar;

  // Ao abrir (registros carregados e login resolvido), compara com o servidor.
  useEffect(() => {
    if (pronto && autor.id !== "local") void sincronizar();
  }, [pronto, autor.id, orgId, sincronizar]);

  // Voltou para o app (celular desbloqueado, aba trocada, internet de volta): no
  // celular o tempo real para em segundo plano, entao confere na volta.
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void sincronizarRef.current();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("online", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("online", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, []);

  // Publica cada mudanca do MEU timer (rodando, ou o marcador de parado). So
  // depois da primeira sincronizacao: senao um timer velho deste aparelho poderia
  // sobrescrever a versao mais nova que esta no servidor.
  useEffect(() => {
    if (!supabaseConfigurado() || !orgId || !sincronizadoRef.current) return;
    const estado: TimerAtivo | TimerParado | null = timerAtivo ?? paradaRef.current;
    if (!estado) return;
    const userId = timerAtivo ? timerAtivo.autorId : autorRef.current.id;
    if (userId === "local") return;
    const chave = chaveVersao(estado);
    if (versaoPublicadaRef.current === chave) return; // ja esta la (inclusive o que veio de la)
    versaoPublicadaRef.current = chave;
    if (ehTimerParado(estado)) void publicarTimerParado(orgId, userId, estado);
    else void upsertTimerAtivo(orgId, userId, estado);
  }, [timerAtivo, orgId]);

  // Batimento (60s): confere a minha linha, reescreve o meu timer para ele nao
  // virar "fantasma" para a equipe, e re-le os timers da equipe para sumir com
  // linhas orfas de quem fechou o app sem parar.
  useEffect(() => {
    if (!supabaseConfigurado() || !orgId) return;
    const org = orgId;
    const bater = async () => {
      await sincronizarRef.current();
      const t = timerRef.current;
      if (t && t.autorId !== "local" && sincronizadoRef.current) void upsertTimerAtivo(org, t.autorId, t);
      void lerTimersAtivos(org).then((x) => setTimersEquipe(x));
    };
    const id = window.setInterval(() => void bater(), 60_000);
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
      vincularTimer,
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
      vincularTimer,
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
