"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { useOrg } from "@/lib/orgProvider";
import { supabaseConfigurado } from "@/lib/supabase/client";

/**
 * Onboarding: cria a organizacao (empresa) do usuario. Aparece quando o usuario
 * logado ainda nao participa de nenhuma organizacao, e tambem pode ser aberto
 * pelo seletor do topo para criar uma organizacao adicional.
 *
 * As marcas da empresa (nome e cor) sao cadastradas na proxima etapa do projeto
 * (F2); por enquanto a organizacao ja nasce pronta para criar campanhas.
 */
export default function PaginaOnboarding() {
  const router = useRouter();
  const { criarOrg, orgs } = useOrg();
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const temOrgs = orgs.length > 0;

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    const limpo = nome.trim();
    if (!limpo) {
      setErro("Digite o nome da sua empresa.");
      return;
    }
    if (!supabaseConfigurado()) {
      setErro("As organizações só funcionam com o login configurado (Supabase).");
      return;
    }
    setCriando(true);
    try {
      await criarOrg(limpo);
      router.replace("/");
      router.refresh();
    } catch {
      setErro("Não foi possível criar a organização. Tente novamente.");
    } finally {
      setCriando(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-marca-azulEscuro px-4">
      <div className="w-full max-w-md rounded-marca bg-white p-8 shadow-modal">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-marca-laranja/10 text-marca-laranja">
            <Building2 size={28} aria-hidden />
          </span>
          <h1 className="font-titulo text-2xl font-bold uppercase tracking-wide text-marca-azulEscuro">
            Sua organização
          </h1>
          <p className="mt-2 text-sm text-marca-cinza">
            Crie a empresa que vai abrigar suas campanhas, conteúdos e horas. Tudo o
            que você criar fica salvo só para ela.
          </p>
        </div>

        <form onSubmit={criar} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
              Nome da empresa
            </span>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              autoFocus
              maxLength={60}
              className="w-full rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 text-sm text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
              placeholder="Ex: Minha Agência"
            />
          </label>

          {erro && (
            <p
              className="rounded-marca px-3 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: "#EC1313" }}
            >
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={criando}
            className="flex w-full items-center justify-center gap-2 rounded-marca bg-marca-laranja px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {criando ? (
              <Loader2 size={16} className="animate-spin" aria-hidden />
            ) : (
              <ArrowRight size={16} aria-hidden />
            )}
            Criar organização
          </button>
        </form>

        {temOrgs && (
          <Link
            href="/"
            className="mt-5 flex items-center justify-center gap-1.5 text-sm font-semibold text-marca-cinza transition hover:text-marca-azulEscuro"
          >
            <ArrowLeft size={15} aria-hidden />
            Voltar para o painel
          </Link>
        )}
      </div>
    </div>
  );
}
