"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  LayoutGrid,
  CalendarDays,
  Timer,
  Play,
  Pause,
  type LucideIcon,
} from "lucide-react";
import { useBoard } from "@/lib/store";
import { useUltimaCampanha } from "@/lib/ultimaCampanha";
import { useApontamentos } from "@/lib/apontamentosProvider";
import { SEM_PROJETO, formatarRelogio, tempoTrabalhadoMs } from "@/lib/apontamentos";

/**
 * Barra de navegacao inferior (somente celular), em vidro e ao alcance do polegar,
 * presente em todas as telas (inclusive dentro de uma campanha). Guarda os destinos
 * principais e, no meio, o botao do timer: parado, comeca sem projeto (depois e so
 * digitar o nome do card); rodando, mostra o tempo e abre o card de tempo. No
 * desktop nao aparece (a navegacao continua no topo).
 *
 * Metricas segue em stand-by (fora do menu) ate a integracao com a IA; quando
 * voltar, basta adicionar um ItemNav para "/metricas".
 */
export default function BarraNavInferior() {
  const caminho = usePathname() ?? "";
  const { campanhaPorId } = useBoard();
  const ultima = useUltimaCampanha();

  // "Campanhas" volta para a ultima campanha aberta (se ainda existe); senao, lista.
  const hrefCampanhas = ultima && campanhaPorId(ultima) ? `/campanha/${ultima}` : "/campanhas";
  const noCampanhas = caminho.startsWith("/campanhas") || caminho.startsWith("/campanha/");

  return (
    <nav
      aria-label="Navegação principal"
      className="vidro-nav relative z-30 flex items-stretch pb-[env(safe-area-inset-bottom)] espacoso:hidden"
    >
      <ItemNav href="/" ativo={caminho === "/"} icone={LayoutDashboard}>
        Painel
      </ItemNav>
      <ItemNav href={hrefCampanhas} ativo={noCampanhas} icone={LayoutGrid}>
        Campanhas
      </ItemNav>
      <BotaoTimerCentral />
      <ItemNav href="/calendario" ativo={caminho.startsWith("/calendario")} icone={CalendarDays}>
        Calendário
      </ItemNav>
      <ItemNav href="/horas" ativo={caminho.startsWith("/horas")} icone={Timer}>
        Horas
      </ItemNav>
    </nav>
  );
}

function ItemNav({
  href,
  ativo,
  icone: Icone,
  children,
}: {
  href: string;
  ativo: boolean;
  icone: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={ativo ? "page" : undefined}
      className={`pressionavel relative flex min-h-[60px] flex-1 flex-col items-center justify-center gap-0.5 px-1 pt-1.5 text-[11px] font-semibold transition-colors ${
        ativo ? "text-marca-laranja" : "text-marca-cinza"
      }`}
    >
      {/* Pilula atras do icone: cresce na aba ativa (onde voce esta, de relance) */}
      <span className="relative flex h-8 w-14 items-center justify-center">
        <span
          aria-hidden
          className={`absolute inset-0 rounded-full bg-marca-laranja/[0.12] transition-transform duration-300 ease-suave ${
            ativo ? "scale-100" : "scale-50 opacity-0"
          }`}
        />
        <Icone size={21} strokeWidth={ativo ? 2.4 : 2} aria-hidden />
      </span>
      <span className="leading-none">{children}</span>
    </Link>
  );
}

/**
 * Botao do timer no meio da barra. Parado: "Iniciar" (sem projeto; o card
 * flutuante abre com o campo pronto para digitar). Rodando: o tempo correndo e,
 * ao tocar, abre o card de tempo para anotar, pausar ou parar.
 */
function BotaoTimerCentral() {
  const { timerAtivo, iniciarTimer } = useApontamentos();
  const [agoraMs, setAgoraMs] = useState(0);
  const rodando = Boolean(timerAtivo);
  const pausado = Boolean(timerAtivo?.pausadoEm);

  useEffect(() => {
    if (!rodando) return;
    setAgoraMs(Date.now());
    const id = window.setInterval(() => setAgoraMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [rodando]);

  function tocar() {
    if (!timerAtivo) iniciarTimer(SEM_PROJETO);
    else window.dispatchEvent(new CustomEvent("kando:abrir-timer"));
  }

  const Icone = !rodando ? Play : pausado ? Pause : Timer;

  return (
    <div className="relative flex flex-1 flex-col items-center justify-end pb-1.5">
      <button
        type="button"
        onClick={tocar}
        aria-label={rodando ? "Abrir o timer em andamento" : "Iniciar timer"}
        className={`pressionavel absolute -top-5 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-modal ring-4 ring-marca-branco transition-colors duration-300 ${
          rodando && !pausado ? "bg-marca-azulEscuro" : pausado ? "bg-marca-cinza" : "bg-marca-laranja"
        }`}
      >
        {rodando && !pausado && (
          <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-marca-azulEscuro/30" />
        )}
        <Icone size={24} strokeWidth={2.4} fill={!rodando ? "currentColor" : "none"} aria-hidden />
      </button>
      <span
        className={`text-[11px] font-semibold leading-none ${
          rodando ? "font-mono tabular-nums text-marca-azulEscuro" : "text-marca-laranja"
        }`}
      >
        {rodando && timerAtivo ? formatarRelogio(tempoTrabalhadoMs(timerAtivo, agoraMs || Date.now())) : "Iniciar"}
      </span>
    </div>
  );
}
