"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { criarClienteNavegador, supabaseConfigurado } from "@/lib/supabase/client";

/**
 * Mostra o e-mail logado e o botao de sair. So aparece quando o Supabase esta
 * configurado (modo com login); no modo local (localStorage) nao renderiza nada.
 */
export default function BotaoSair() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const configurado = supabaseConfigurado();

  useEffect(() => {
    if (!configurado) return;
    const sb = criarClienteNavegador();
    sb.auth
      .getUser()
      .then((res: { data: { user: { email?: string | null } | null } }) =>
        setEmail(res.data.user?.email ?? null)
      );
  }, [configurado]);

  if (!configurado) return null;

  async function sair() {
    const sb = criarClienteNavegador();
    await sb.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {email && (
        <span className="hidden max-w-[160px] truncate text-xs text-white/70 lg:inline">{email}</span>
      )}
      <button
        type="button"
        onClick={sair}
        title="Sair"
        className="flex items-center gap-1.5 rounded-marca px-3 py-2 text-sm font-semibold text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        <LogOut size={16} aria-hidden />
        Sair
      </button>
    </div>
  );
}
