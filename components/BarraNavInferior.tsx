"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, CalendarDays, Timer } from "lucide-react";

/**
 * Barra de navegacao inferior (somente mobile). Fica ao alcance do polegar, com
 * os destinos principais do painel. Guarda destinos, nao acoes. No desktop nao
 * aparece (a navegacao continua no topo).
 *
 * Metricas segue em stand-by (fora do menu) ate a integracao com a IA; quando
 * voltar, basta adicionar um ItemNav para "/metricas".
 */
export default function BarraNavInferior() {
  const caminho = usePathname() ?? "";
  const noQuadro = caminho === "/" || caminho.startsWith("/campanha");
  const noCalendario = caminho.startsWith("/calendario");
  const noHoras = caminho.startsWith("/horas");

  return (
    <nav
      aria-label="Navegação principal"
      className="flex border-t border-marca-cinza/20 bg-white pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ItemNav href="/" ativo={noQuadro} icone={<LayoutGrid size={20} aria-hidden />}>
        Campanhas
      </ItemNav>
      <ItemNav href="/calendario" ativo={noCalendario} icone={<CalendarDays size={20} aria-hidden />}>
        Calendário
      </ItemNav>
      <ItemNav href="/horas" ativo={noHoras} icone={<Timer size={20} aria-hidden />}>
        Horas
      </ItemNav>
    </nav>
  );
}

function ItemNav({
  href,
  ativo,
  icone,
  children,
}: {
  href: string;
  ativo: boolean;
  icone: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={ativo ? "page" : undefined}
      className={`relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-[11px] font-semibold transition ${
        ativo ? "text-marca-laranja" : "text-marca-cinza hover:text-marca-azulEscuro"
      }`}
    >
      {ativo && (
        <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-marca-laranja" aria-hidden />
      )}
      {icone}
      {children}
    </Link>
  );
}
