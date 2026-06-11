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
import type { Organizacao } from "./types";
import { supabaseConfigurado } from "./supabase/client";
import {
  aplicarConvites,
  criarOrg as criarOrgRemoto,
  listarMinhasOrgs,
  usuarioAtual,
} from "./orgStorage";

/**
 * Estado da organizacao ativa (multiempresa). Fica acima do BoardProvider: o
 * quadro, as horas e as metricas sempre carregam os dados da organizacao ativa.
 *
 * Modo local (sem Supabase): uma organizacao sintetica "local" mantem o app
 * funcionando igual ao de antes, sem login nem isolamento.
 */

const ORG_LOCAL: Organizacao = { id: "local", nome: "Local", papel: "dono" };
const CHAVE_ORG_ATIVA = "kando:org-ativa";

interface OrgStore {
  orgs: Organizacao[];
  orgAtiva: Organizacao | null;
  orgId: string | null; // id da organizacao ativa (ou null enquanto resolve)
  pronto: boolean;
  logado: boolean; // ha usuario autenticado (sempre false no modo local)
  semOrg: boolean; // logado, ja resolveu, e nao participa de nenhuma organizacao
  erro: boolean; // falha ao carregar (ex.: tabelas ainda nao criadas)
  trocarOrg: (id: string) => void;
  criarOrg: (nome: string) => Promise<string>;
  recarregar: () => Promise<void>;
}

const OrgContext = createContext<OrgStore | null>(null);

function lerOrgAtivaLocal(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(CHAVE_ORG_ATIVA);
  } catch {
    return null;
  }
}

function salvarOrgAtivaLocal(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE_ORG_ATIVA, id);
  } catch {
    // ignora
  }
}

export function OrgProvider({ children }: { children: ReactNode }) {
  const ehSupabase = supabaseConfigurado();
  const [orgs, setOrgs] = useState<Organizacao[]>(ehSupabase ? [] : [ORG_LOCAL]);
  const [orgAtivaId, setOrgAtivaId] = useState<string | null>(ehSupabase ? null : ORG_LOCAL.id);
  const [pronto, setPronto] = useState(!ehSupabase);
  const [logado, setLogado] = useState(false);
  const [erro, setErro] = useState(false);
  const ativo = useRef(true);

  // Escolhe a organizacao ativa: a salva (se ainda existir) ou a primeira.
  const escolherAtiva = useCallback((lista: Organizacao[]): string | null => {
    if (lista.length === 0) return null;
    const salva = lerOrgAtivaLocal();
    if (salva && lista.some((o) => o.id === salva)) return salva;
    return lista[0].id;
  }, []);

  const carregar = useCallback(async () => {
    if (!ehSupabase) return;
    try {
      const u = await usuarioAtual();
      if (!ativo.current) return;
      setLogado(Boolean(u));
      if (!u) {
        setOrgs([]);
        setOrgAtivaId(null);
        setPronto(true);
        return;
      }
      // Aplica convites pendentes antes de listar (entra nas orgs que o convidaram).
      await aplicarConvites();
      const lista = await listarMinhasOrgs();
      if (!ativo.current) return;
      setOrgs(lista);
      setOrgAtivaId((atual) => (atual && lista.some((o) => o.id === atual) ? atual : escolherAtiva(lista)));
      setErro(false);
      setPronto(true);
    } catch {
      if (!ativo.current) return;
      setErro(true);
      setPronto(true);
    }
  }, [ehSupabase, escolherAtiva]);

  useEffect(() => {
    ativo.current = true;
    void carregar();
    return () => {
      ativo.current = false;
    };
  }, [carregar]);

  const trocarOrg = useCallback((id: string) => {
    salvarOrgAtivaLocal(id);
    setOrgAtivaId(id);
  }, []);

  const criarOrg = useCallback(
    async (nome: string): Promise<string> => {
      const novo = await criarOrgRemoto(nome);
      const lista = await listarMinhasOrgs();
      setOrgs(lista);
      salvarOrgAtivaLocal(novo);
      setOrgAtivaId(novo);
      setLogado(true);
      return novo;
    },
    []
  );

  const orgAtiva = useMemo(
    () => orgs.find((o) => o.id === orgAtivaId) ?? null,
    [orgs, orgAtivaId]
  );

  const valor: OrgStore = useMemo(
    () => ({
      orgs,
      orgAtiva,
      orgId: orgAtiva?.id ?? null,
      pronto,
      logado,
      // "Sem organizacao" so quando carregou de verdade (sem erro): em caso de
      // falha de carga, mostramos o aviso em vez de empurrar para o onboarding.
      semOrg: pronto && logado && !erro && orgs.length === 0,
      erro,
      trocarOrg,
      criarOrg,
      recarregar: carregar,
    }),
    [orgs, orgAtiva, pronto, logado, erro, trocarOrg, criarOrg, carregar]
  );

  return <OrgContext.Provider value={valor}>{children}</OrgContext.Provider>;
}

/** Hook para acessar a organizacao ativa. */
export function useOrg(): OrgStore {
  const ctx = useContext(OrgContext);
  if (!ctx) {
    throw new Error("useOrg precisa estar dentro de <OrgProvider>");
  }
  return ctx;
}
