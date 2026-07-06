"use client";

import { useEffect, useState, type ReactNode } from "react";
import { criarClienteNavegador, supabaseConfigurado } from "@/lib/supabase/client";
import TrocaSenhaObrigatoria from "./TrocaSenhaObrigatoria";

/**
 * Segura o app no primeiro acesso: se a conta do usuario logado ainda tem
 * senha_temporaria (login recem-criado), obriga a definir a nova senha antes de
 * entrar. No modo local (sem Supabase) nao ha login, entao passa direto.
 */
export default function GuardaSenha({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<"checando" | "ok" | "precisa">(
    supabaseConfigurado() ? "checando" : "ok"
  );
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!supabaseConfigurado()) return;
    let ativo = true;
    (async () => {
      try {
        const sb = criarClienteNavegador();
        const { data } = await sb.auth.getUser();
        const u = data.user;
        if (!ativo) return;
        // A marca vive em app_metadata (so a service role escreve); o navegador so le.
        const temp = (u?.app_metadata as { senha_temporaria?: boolean } | undefined)?.senha_temporaria;
        if (u && temp === true) {
          setEmail(u.email ?? "");
          setEstado("precisa");
        } else {
          setEstado("ok");
        }
      } catch {
        if (ativo) setEstado("ok");
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  if (estado === "checando") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-marca-branco">
        <p className="text-sm text-marca-cinza">Carregando...</p>
      </div>
    );
  }
  if (estado === "precisa") {
    return <TrocaSenhaObrigatoria email={email} onPronto={() => setEstado("ok")} />;
  }
  return <>{children}</>;
}
