"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BoardProvider } from "@/lib/store";
import Topo from "./Topo";
import AvisoErroCarregar from "./AvisoErroCarregar";

/**
 * Casca da aplicacao. Nas paginas do painel, envolve tudo com o estado central
 * (BoardProvider) e a navegacao global (Topo). Na tela de login, renderiza so o
 * conteudo, sem navegacao nem provider.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const caminho = usePathname();

  if (caminho === "/login") {
    return <>{children}</>;
  }

  return (
    <BoardProvider>
      <AvisoErroCarregar />
      <div className="flex h-screen flex-col bg-marca-branco">
        <Topo />
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </BoardProvider>
  );
}
