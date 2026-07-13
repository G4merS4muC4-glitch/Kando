"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { BoardProvider } from "@/lib/store";
import { ApontamentosProvider } from "@/lib/apontamentosProvider";
import { OrgProvider, useOrg } from "@/lib/orgProvider";
import Topo from "./Topo";
import BarraNavInferior from "./BarraNavInferior";
import CartaoTimerFlutuante from "./CartaoTimerFlutuante";
import CentralNotificacoes from "./CentralNotificacoes";
import AvisoErroCarregar from "./AvisoErroCarregar";
import GuardaSenha from "./GuardaSenha";

/**
 * Casca da aplicacao. Resolve primeiro a organizacao ativa (OrgProvider) e so
 * entao monta o estado do quadro (BoardProvider) e a navegacao. Na tela de
 * login e no painel publico do visitante, renderiza so o conteudo.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const caminho = usePathname();

  if (caminho === "/login" || caminho.startsWith("/c/") || caminho.startsWith("/sugerir/")) {
    return <>{children}</>;
  }

  return (
    <OrgProvider>
      <ShellComOrg>{children}</ShellComOrg>
    </OrgProvider>
  );
}

/** Decide, ja com a organizacao resolvida, o que renderizar. */
function ShellComOrg({ children }: { children: ReactNode }) {
  const caminho = usePathname();
  const router = useRouter();
  const { pronto, semOrg, orgId, erro } = useOrg();
  const naOnboarding = caminho.startsWith("/onboarding");

  // Logado e sem nenhuma organizacao: leva para criar a primeira.
  useEffect(() => {
    if (pronto && semOrg && !naOnboarding) router.replace("/onboarding");
  }, [pronto, semOrg, naOnboarding, router]);

  // O onboarding (criar organizacao) nao precisa do quadro nem da navegacao.
  if (naOnboarding) return <>{children}</>;

  // Aguardando resolver a organizacao (ou redirecionando para o onboarding).
  if (!pronto || semOrg || !orgId) {
    return <TelaCarregando erro={erro} />;
  }

  return (
    <GuardaSenha>
      <BoardProvider>
        <ApontamentosProvider>
          <AvisoErroCarregar />
          <div className="flex h-dvh flex-col bg-marca-branco">
            <Topo />
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
            {/* Barra de navegacao do mobile (no desktop some e a navegacao fica no
                topo). O timer ativo aparece no card flutuante, sobre qualquer pagina. */}
            <BarraNavInferior />
            <CartaoTimerFlutuante />
            <CentralNotificacoes />
          </div>
        </ApontamentosProvider>
      </BoardProvider>
    </GuardaSenha>
  );
}

function TelaCarregando({ erro }: { erro: boolean }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-marca-branco px-4 text-center">
      {erro ? (
        <p className="max-w-xs text-sm text-marca-cinza">
          Não foi possível carregar suas organizações. Recarregue a página e tente de novo.
        </p>
      ) : (
        <p className="text-sm text-marca-cinza">Carregando...</p>
      )}
    </div>
  );
}
