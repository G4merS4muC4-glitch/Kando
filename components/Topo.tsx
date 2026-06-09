"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, CalendarDays, Timer } from "lucide-react";
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
  const noHoras = caminho?.startsWith("/horas");
  const noCampanha = caminho?.startsWith("/campanha");

  return (
    // No mobile, dentro de uma campanha a barra do topo some (a barra da campanha
    // ja tem voltar + contexto, e a navegacao fica na barra inferior): economiza
    // espaco. No desktop continua sempre visivel.
    <header
      className={`sticky top-0 z-30 bg-marca-azulEscuro text-white shadow-md ${
        noCampanha ? "hidden espacoso:block" : ""
      }`}
    >
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

        {/* Indicador de timer + navegacao. No mobile, a navegacao migra para a
            barra inferior (ao alcance do polegar) e o timer para uma faixa acima
            dela: aqui o topo fica enxuto (so a logo e o sair). */}
        <div className="flex items-center gap-2">
          <div className="hidden espacoso:block">
            <IndicadorTimerTopo />
          </div>
          <nav className="hidden items-center gap-1 espacoso:flex">
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
            {/* Metricas em stand-by: aba removida do menu ate integrar a IA.
                O codigo (/metricas) continua intacto; e so readicionar o LinkNav
                para "/metricas" (icone BarChart3) quando reativar. */}
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
