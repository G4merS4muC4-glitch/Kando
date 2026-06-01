"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Loader2 } from "lucide-react";
import { criarClienteNavegador, supabaseConfigurado } from "@/lib/supabase/client";

/**
 * Tela de login (modo Supabase). As contas do time sao criadas no painel do
 * Supabase (Authentication > Users). Aqui o usuario apenas entra com e-mail e
 * senha. Sem Supabase configurado, mostra um aviso.
 */
export default function PaginaLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!supabaseConfigurado()) {
      setErro("O login ainda não foi configurado (Supabase).");
      return;
    }
    setCarregando(true);
    try {
      const sb = criarClienteNavegador();
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: senha });
      if (error) {
        setErro("E-mail ou senha incorretos.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setErro("Não foi possível entrar. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-marca-azulEscuro px-4">
      <div className="w-full max-w-sm rounded-marca bg-white p-8 shadow-modal">
        {/* Marca */}
        <div className="mb-6 flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/kando-logo.svg" alt="Kando" className="mb-3 h-12 w-12 object-contain" />
          <h1 className="font-titulo text-2xl font-bold uppercase tracking-wide text-marca-azulEscuro">
            Kando
          </h1>
          <p className="text-[11px] font-medium tracking-wide text-marca-cinza">by Brusoft</p>
          <p className="mt-2 text-sm text-marca-cinza">Entre para acessar o painel.</p>
        </div>

        <form onSubmit={entrar} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
              E-mail
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 text-sm text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
              placeholder="voce@brusoft.inf.br"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
              Senha
            </span>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 text-sm text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
              placeholder="Sua senha"
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
            disabled={carregando}
            className="flex w-full items-center justify-center gap-2 rounded-marca bg-marca-laranja px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {carregando ? (
              <Loader2 size={16} className="animate-spin" aria-hidden />
            ) : (
              <LogIn size={16} aria-hidden />
            )}
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
