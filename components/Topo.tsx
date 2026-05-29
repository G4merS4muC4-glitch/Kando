"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, CalendarDays } from "lucide-react";
import BotaoSair from "./BotaoSair";

/**
 * Cabecalho global fixo, presente em todas as telas: wordmark a esquerda e
 * navegacao (Campanhas e Calendario) a direita. Fundo em azul escuro da marca.
 */
export default function Topo() {
  const caminho = usePathname();
  const naInicial = caminho === "/";
  const noCalendario = caminho?.startsWith("/calendario");

  return (
    <header className="sticky top-0 z-30 bg-marca-azulEscuro text-white shadow-md">
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        {/* Wordmark */}
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brusoft-simbolo.png"
            alt="Brusoft"
            className="h-8 w-8 object-contain"
            width={32}
            height={32}
          />
          <span className="flex flex-col leading-tight">
            <span className="font-titulo text-lg font-bold uppercase tracking-wide text-white">
              Kando
            </span>
            <span className="text-[10px] font-medium tracking-wide text-white/55">
              by Brusoft
            </span>
          </span>
        </Link>

        {/* Navegacao */}
        <div className="flex items-center gap-2">
          <nav className="flex items-center gap-1">
            <LinkNav href="/" ativo={!!naInicial} icone={<LayoutGrid size={16} aria-hidden />}>
              Campanhas
            </LinkNav>
            <LinkNav
              href="/calendario"
              ativo={!!noCalendario}
              icone={<CalendarDays size={16} aria-hidden />}
            >
              Calendario
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
    >
      {icone}
      {children}
    </Link>
  );
}
