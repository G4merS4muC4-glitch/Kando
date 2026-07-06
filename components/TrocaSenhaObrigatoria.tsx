"use client";

import { useState } from "react";
import { KeyRound, Loader2, LogOut } from "lucide-react";
import { criarClienteNavegador } from "@/lib/supabase/client";

/**
 * Tela obrigatoria de troca de senha no primeiro acesso. Aparece antes do app
 * para quem recebeu um login novo (a conta nasce com senha_temporaria = true).
 * Ao definir a nova senha, limpa a marca para nao aparecer de novo.
 */
export default function TrocaSenhaObrigatoria({
  email,
  onPronto,
}: {
  email: string;
  onPronto: () => void;
}) {
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 8) {
      setErro("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirma) {
      setErro("As senhas não conferem.");
      return;
    }
    setSalvando(true);
    try {
      const sb = criarClienteNavegador();
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token ?? "";
      // Troca no servidor: define a senha e limpa a marca app_metadata numa acao so.
      const r = await fetch("/api/senha", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ novaSenha: senha }),
      });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { erro?: string };
        setErro(d.erro || "Não foi possível salvar a nova senha. Tente novamente.");
        return;
      }
      onPronto();
    } catch {
      setErro("Não foi possível salvar a nova senha. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  async function sair() {
    try {
      await criarClienteNavegador().auth.signOut();
    } catch {
      // ignora
    }
    window.location.href = "/login";
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-marca-azulEscuro px-4">
      <div className="w-full max-w-sm rounded-marca bg-white p-8 shadow-modal">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-marca-laranja text-white">
            <KeyRound size={22} aria-hidden />
          </span>
          <h1 className="font-titulo text-xl font-bold uppercase tracking-wide text-marca-azulEscuro">
            Defina sua senha
          </h1>
          <p className="mt-2 text-sm text-marca-cinza">
            Este é o seu primeiro acesso{email ? ` (${email})` : ""}. Crie uma senha só sua para
            continuar.
          </p>
        </div>

        <form onSubmit={salvar} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
              Nova senha
            </span>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 text-sm text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
              placeholder="Pelo menos 8 caracteres"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
              Confirmar nova senha
            </span>
            <input
              type="password"
              value={confirma}
              onChange={(e) => setConfirma(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 text-sm text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
              placeholder="Repita a senha"
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
            disabled={salvando}
            className="flex w-full items-center justify-center gap-2 rounded-marca bg-marca-laranja px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {salvando ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <KeyRound size={16} aria-hidden />}
            Salvar e entrar
          </button>
        </form>

        <button
          type="button"
          onClick={sair}
          className="mt-4 flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-marca-cinza transition hover:text-marca-azulEscuro"
        >
          <LogOut size={13} aria-hidden /> Sair
        </button>
      </div>
    </div>
  );
}
