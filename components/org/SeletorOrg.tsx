"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, Check, Plus } from "lucide-react";
import { useOrg } from "@/lib/orgProvider";
import { supabaseConfigurado } from "@/lib/supabase/client";

/**
 * Seletor da organizacao ativa, no topo. Mostra a organizacao atual e, ao abrir,
 * lista as demais para trocar, alem do atalho para criar uma nova. Trocar de
 * organizacao recarrega o quadro/horas e leva para a tela inicial (o id de uma
 * campanha so vale dentro da organizacao onde foi criada).
 */
export default function SeletorOrg() {
  const { orgs, orgAtiva, trocarOrg } = useOrg();
  const [aberto, setAberto] = useState(false);
  const router = useRouter();

  // Modo local (sem login) ou ainda resolvendo: nao mostra o seletor.
  if (!supabaseConfigurado() || !orgAtiva) return null;

  function selecionar(id: string) {
    setAberto(false);
    if (id !== orgAtiva!.id) {
      trocarOrg(id);
      router.push("/");
    }
  }

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex max-w-[44vw] items-center gap-1.5 rounded-marca px-2 py-1.5 text-sm font-semibold text-white/90 transition hover:bg-white/10 sm:max-w-none"
        title={orgAtiva.nome}
      >
        <Building2 size={15} className="shrink-0" aria-hidden />
        <span className="max-w-[120px] truncate sm:max-w-[180px]">{orgAtiva.nome}</span>
        <ChevronDown size={14} className="shrink-0 opacity-70" aria-hidden />
      </button>

      {aberto && (
        <>
          {/* Captura o clique fora para fechar. */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setAberto(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute left-0 z-50 mt-1 w-60 overflow-hidden rounded-marca bg-white text-marca-preto shadow-modal">
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-marca-cinza">
              Organizações
            </p>
            <ul className="max-h-64 overflow-y-auto">
              {orgs.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => selecionar(o.id)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-marca-branco"
                  >
                    <span className="truncate">{o.nome}</span>
                    {o.id === orgAtiva.id && (
                      <Check size={15} className="shrink-0 text-marca-laranja" aria-hidden />
                    )}
                  </button>
                </li>
              ))}
            </ul>
            <Link
              href="/onboarding"
              onClick={() => setAberto(false)}
              className="flex items-center gap-1.5 border-t border-marca-cinza/20 px-3 py-2 text-sm font-semibold text-marca-laranja transition hover:bg-marca-branco"
            >
              <Plus size={15} aria-hidden />
              Criar organização
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
