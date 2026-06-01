"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, CalendarDays, BarChart3, Timer } from "lucide-react";
import BotaoSair from "./BotaoSair";
import IndicadorTimerTopo from "./apontamentos/IndicadorTimerTopo";

/**
 * Cabecalho global fixo, presente em todas as telas: wordmark a esquerda e
 * navegacao (Campanhas e Calendario) a direita. Fundo em azul escuro da marca.
 */
export default function Topo() {
  const caminho = usePathname();
  const naInicial = caminho === "/";
  const noCalendario = caminho?.startsWith("/calendario");
  const noMetricas = caminho?.startsWith("/metricas");
  const noHoras = caminho?.startsWith("/horas");

  return (
    <header className="sticky top-0 z-30 bg-marca-azulEscuro text-white shadow-md">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        {/* Simbolo laranja + logo completa (Kando by Brusoft) lado a lado */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Kando by Brusoft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/kando-logo.svg"
            alt=""
            aria-hidden
            className="h-7 w-7 shrink-0 object-contain"
            width={28}
            height={28}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/kando-completa.svg"
            alt="Kando by Brusoft"
            className="h-7 w-auto object-contain sm:h-8"
          />
        </Link>

        {/* Indicador de timer + navegacao */}
        <div className="flex items-center gap-2">
          <IndicadorTimerTopo />
          <nav className="flex items-center gap-1">
            <LinkNav href="/" ativo={!!naInicial} icone={<LayoutGrid size={16} aria-hidden />}>
              Campanhas
            </LinkNav>
            <LinkNav
              href="/calendario"
              ativo={!!noCalendario}
              icone={<CalendarDays size={16} aria-hidden />}
            >
              Calendário
            </LinkNav>
            <LinkNav
              href="/metricas"
              ativo={!!noMetricas}
              icone={<BarChart3 size={16} aria-hidden />}
            >
              Métricas
            </LinkNav>
            <LinkNav href="/horas" ativo={!!noHoras} icone={<Timer size={16} aria-hidden />}>
              Horas
            </LinkNav>
          </nav>
          <BotaoSair />
        </div>
      </div>
    </header>
  );
}

function LinkNav({
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
      className={`flex items-center gap-1.5 rounded-marca px-3 py-2 text-sm font-semibold transition ${
        ativo
          ? "bg-marca-laranja text-white"
          : "text-white/80 hover:bg-white/10 hover:text-white"
      }`}
      title={typeof children === "string" ? children : undefined}
    >
      {icone}
      <span className="hidden sm:inline">{children}</span>
    </Link>
  );
}
