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
import type { Contagem } from "./types";
import { agora, gerarId } from "./util";
import { ordenarContagens } from "./contagens";
import {
  assinarContagens,
  getContagens,
  lerFixadaLocal,
  salvarContagens,
  salvarFixadaLocal,
} from "./contagensStorage";
import { useOrg } from "./orgProvider";
import { useApontamentos } from "./apontamentosProvider";

/**
 * Estado central das contagens regressivas (espelha o ApontamentosProvider).
 *
 * A lista de prazos vive num documento compartilhado da organizacao; qual prazo
 * fica no card flutuante e escolha deste aparelho (localStorage). Precisa estar
 * DENTRO do <ApontamentosProvider>, de onde vem o autor ja resolvido (login),
 * para nao repetir a leitura do usuario em dois lugares.
 */

interface ContagensStore {
  contagens: Contagem[]; // ordenadas pelo prazo mais proximo (vencidos no topo)
  pronto: boolean;
  fixadaId: string | null; // contagem no card flutuante deste aparelho
  contagemFixada: Contagem | null;
  criar: (dados: { titulo: string; alvo: string; cardId?: string }) => Contagem | null;
  atualizar: (contagem: Contagem) => void;
  excluir: (id: string) => void;
  fixar: (id: string | null) => void; // null tira o card flutuante da tela
}

const ContagensContext = createContext<ContagensStore | null>(null);

export function ContagensProvider({ children }: { children: ReactNode }) {
  const { orgId } = useOrg();
  const { autor } = useApontamentos();
  const [contagens, setContagens] = useState<Contagem[]>([]);
  const [fixadaId, setFixadaId] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  // Espelhos para as acoes lerem o valor atual sem depender de closures.
  const contagensRef = useRef(contagens);
  contagensRef.current = contagens;
  const autorRef = useRef(autor);
  autorRef.current = autor;
  const orgIdRef = useRef(orgId);
  orgIdRef.current = orgId;

  // Carrega a lista da organizacao ativa, a escolha deste aparelho e assina as
  // mudancas. Recarrega ao trocar de organizacao.
  useEffect(() => {
    if (!orgId) return;
    let ativo = true;
    setPronto(false);

    getContagens(orgId)
      .then((c) => {
        if (!ativo) return;
        setContagens(c);
        setPronto(true);
      })
      .catch(() => {
        if (ativo) setPronto(true);
      });

    setFixadaId(lerFixadaLocal(orgId));

    const cancelar = assinarContagens(orgId, (c) => {
      if (ativo) setContagens(c);
    });

    return () => {
      ativo = false;
      if (cancelar) cancelar();
    };
  }, [orgId]);

  /** Atualiza o estado e persiste a lista inteira (acoes sao pouco frequentes). */
  const aplicar = useCallback((novas: Contagem[]) => {
    setContagens(novas);
    const org = orgIdRef.current;
    if (org) void salvarContagens(org, novas);
  }, []);

  const fixar = useCallback((id: string | null) => {
    setFixadaId(id);
    const org = orgIdRef.current;
    if (org) salvarFixadaLocal(org, id);
  }, []);

  /**
   * Cria um prazo e ja o coloca no card flutuante: acabou de ser criado, e o que
   * esta na cabeca de quem criou. Da para tirar da tela no "x" da pilula.
   */
  const criar = useCallback(
    (dados: { titulo: string; alvo: string; cardId?: string }): Contagem | null => {
      const titulo = dados.titulo.trim();
      if (!titulo || !dados.alvo) return null;
      const ts = agora();
      const a = autorRef.current;
      const nova: Contagem = {
        id: gerarId(),
        titulo,
        alvo: dados.alvo,
        cardId: dados.cardId || undefined,
        criadoEm: ts,
        atualizadoEm: ts,
        autorId: a.id,
        autorNome: a.nome,
      };
      aplicar([...contagensRef.current, nova]);
      fixar(nova.id);
      return nova;
    },
    [aplicar, fixar]
  );

  const atualizar = useCallback(
    (contagem: Contagem) => {
      const titulo = contagem.titulo.trim();
      if (!titulo || !contagem.alvo) return;
      aplicar(
        contagensRef.current.map((c) =>
          c.id === contagem.id ? { ...contagem, titulo, atualizadoEm: agora() } : c
        )
      );
    },
    [aplicar]
  );

  const excluir = useCallback(
    (id: string) => {
      aplicar(contagensRef.current.filter((c) => c.id !== id));
      // Estava na tela: tira o card flutuante junto.
      if (fixadaId === id) fixar(null);
    },
    [aplicar, fixadaId, fixar]
  );

  const valor: ContagensStore = useMemo(() => {
    const ordenadas = ordenarContagens(contagens);
    // A fixada pode ter sido excluida por um colega: nesse caso, some da tela.
    const fixada = ordenadas.find((c) => c.id === fixadaId) ?? null;
    return {
      contagens: ordenadas,
      pronto,
      fixadaId: fixada ? fixadaId : null,
      contagemFixada: fixada,
      criar,
      atualizar,
      excluir,
      fixar,
    };
  }, [contagens, pronto, fixadaId, criar, atualizar, excluir, fixar]);

  return <ContagensContext.Provider value={valor}>{children}</ContagensContext.Provider>;
}

/** Hook para acessar as contagens regressivas. */
export function useContagens(): ContagensStore {
  const ctx = useContext(ContagensContext);
  if (!ctx) {
    throw new Error("useContagens precisa estar dentro de <ContagensProvider>");
  }
  return ctx;
}
