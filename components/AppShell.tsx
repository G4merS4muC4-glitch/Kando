"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BoardProvider } from "@/lib/store";
import { ApontamentosProvider } from "@/lib/apontamentosProvider";
import Topo from "./Topo";
import BarraNavInferior from "./BarraNavInferior";
import FaixaTimerMobile from "./FaixaTimerMobile";
import AvisoErroCarregar from "./AvisoErroCarregar";

/**
 * Casca da aplicacao. Nas paginas do painel, envolve tudo com o estado central
 * (BoardProvider) e a navegacao global (Topo). Na tela de login, renderiza so o
 * conteudo, sem navegacao nem provider.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const caminho = usePathname();

  // Login e o painel publico do visitante (/c/...) nao tem navegacao nem o estado
  // do quadro: renderizam so o conteudo.
  if (caminho === "/login" || caminho.startsWith("/c/")) {
    return <>{children}</>;
  }

  return (
    <BoardProvider>
      <ApontamentosProvider>
        <AvisoErroCarregar />
        <div className="flex h-dvh flex-col bg-marca-branco">
          <Topo />
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          {/* Mobile: faixa de timer (so quando rodando) + barra inferior.
              No desktop ambos somem (sm:hidden) e a navegacao fica no topo. */}
          <FaixaTimerMobile />
          <BarraNavInferior />
        </div>
      </ApontamentosProvider>
    </BoardProvider>
  );
}
