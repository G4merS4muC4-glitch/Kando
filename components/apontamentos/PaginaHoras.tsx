"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowUp,
  ArrowDown,
  X,
  CalendarDays,
} from "lucide-react";
import { MARCAS, MARCAS_ORDEM } from "@/lib/config";
import { useBoard } from "@/lib/store";
import { useApontamentos } from "@/lib/apontamentosProvider";
import type { Marca, MarcaFiltro, RegistroTempo } from "@/lib/types";
import {
  calcularKpis,
  diaDoRegistro,
  duracaoMs,
  formatarDuracao,
  registrosDoMes,
  totalPorCard,
} from "@/lib/apontamentos";
import { MESES, formatarData } from "@/lib/util";
import CalendarioHoras from "./CalendarioHoras";
import GraficoHorasPorDia from "./GraficoHorasPorDia";
import ListaRegistrosRecentes from "./ListaRegistrosRecentes";
import ResumoPorProjeto from "./ResumoPorProjeto";
import CardRegistro from "./CardRegistro";
import ModalEditarRegistro from "./ModalEditarRegistro";

type ModoGrafico = "total" | "projeto";

/** Painel de horas: KPIs, calendario, grafico, recentes e resumo por projeto. */
export default function PaginaHoras() {
  const { registros, timerAtivo, pronto } = useApontamentos();
  const { cards, campanhas, cardPorId, campanhaPorId } = useBoard();

  const [montado, setMontado] = useState(false);
  const [ano, setAno] = useState(2026);
  const [mes, setMes] = useState(0);
  const [marcaFiltro, setMarcaFiltro] = useState<MarcaFiltro>("todas");
  const [projetoFiltro, setProjetoFiltro] = useState<string>("todos");
  const [pessoaFiltro, setPessoaFiltro] = useState<string>("todos");
  const [modoGrafico, setModoGrafico] = useState<ModoGrafico>("total");
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null);
  const [editar, setEditar] = useState<RegistroTempo | "novo" | null>(null);

  useEffect(() => {
    const h = new Date();
    setAno(h.getFullYear());
    setMes(h.getMonth());
    setMontado(true);
  }, []);

  const marcaPorCampanha = useMemo(() => {
    const m = new Map<string, Marca>();
    campanhas.forEach((c) => m.set(c.id, c.marca));
    return m;
  }, [campanhas]);

  const marcaDoRegistro = (r: RegistroTempo): Marca | undefined => {
    const card = cardPorId(r.cardId);
    return card ? marcaPorCampanha.get(card.campanhaId) : undefined;
  };

  // Aplica os filtros (marca, projeto, pessoa) em tudo.
  const filtrados = useMemo(
    () =>
      registros.filter((r) => {
        if (marcaFiltro !== "todas" && marcaDoRegistro(r) !== marcaFiltro) return false;
        if (projetoFiltro !== "todos" && r.cardId !== projetoFiltro) return false;
        if (pessoaFiltro !== "todos" && r.autorId !== pessoaFiltro) return false;
        return true;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [registros, marcaFiltro, projetoFiltro, pessoaFiltro, marcaPorCampanha]
  );

  // KPIs do periodo atual (referencia = hoje), nao do mes navegado.
  const kpis = useMemo(() => calcularKpis(filtrados, new Date()), [filtrados]);
  const lider = useMemo(() => {
    const h = new Date();
    const doMes = registrosDoMes(filtrados, h.getFullYear(), h.getMonth());
    const tot = totalPorCard(doMes);
    const top = [...tot.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!top) return null;
    return { titulo: cardPorId(top[0])?.titulo || "Card removido", ms: top[1] };
  }, [filtrados, cardPorId]);

  // Opcoes dos filtros.
  const projetosComHoras = useMemo(() => {
    const ids = new Set(registros.map((r) => r.cardId));
    return [...ids]
      .map((id) => ({ id, titulo: cardPorId(id)?.titulo || "Card removido" }))
      .sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
  }, [registros, cardPorId]);

  const pessoas = useMemo(() => {
    const m = new Map<string, string>();
    registros.forEach((r) => m.set(r.autorId, r.autorNome || "Sem nome"));
    return [...m.entries()].map(([id, nome]) => ({ id, nome }));
  }, [registros]);

  const registrosDoDia = useMemo(
    () =>
      diaSelecionado
        ? filtrados
            .filter((r) => diaDoRegistro(r) === diaSelecionado)
            .sort((a, b) => (a.inicio < b.inicio ? -1 : 1))
        : [],
    [filtrados, diaSelecionado]
  );
  const totalDoDia = registrosDoDia.reduce((s, r) => s + duracaoMs(r), 0);

  function irMes(delta: number) {
    let m = mes + delta;
    let a = ano;
    if (m < 0) {
      m = 11;
      a -= 1;
    } else if (m > 11) {
      m = 0;
      a += 1;
    }
    setMes(m);
    setAno(a);
    setDiaSelecionado(null);
  }

  if (!montado || !pronto) {
    return <div className="p-6 text-sm text-marca-cinza">Carregando horas...</div>;
  }

  const temCards = cards.length > 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Cabecalho */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-titulo text-2xl font-bold uppercase tracking-wide text-marca-azulEscuro">
              Horas
            </h1>
            <p className="text-sm text-marca-cinza">
              Controle de horas e eficiência por projeto e por pessoa. Use o timer no topo ou lance
              manualmente.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditar("novo")}
            disabled={!temCards}
            className="flex items-center gap-1.5 rounded-marca bg-marca-laranja px-4 py-2 text-sm font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
            title={temCards ? "Lançar horas manualmente" : "Crie um card primeiro"}
          >
            <Plus size={16} aria-hidden /> Lançar manual
          </button>
        </div>

        {/* KPIs */}
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi rotulo="Hoje" valor={formatarDuracao(kpis.hojeMs)} />
          <Kpi rotulo="Esta semana" valor={formatarDuracao(kpis.semanaMs)} />
          <Kpi rotulo="Este mês" valor={formatarDuracao(kpis.mesMs)} variacao={kpis.variacaoMesPct} />
          <Kpi
            rotulo="Projeto líder (mês)"
            valor={lider ? formatarDuracao(lider.ms) : "-"}
            sub={lider?.titulo}
          />
        </div>

        {/* Filtros */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            <ChipMarca ativo={marcaFiltro === "todas"} onClick={() => setMarcaFiltro("todas")}>
              Todas
            </ChipMarca>
            {MARCAS_ORDEM.map((m) => (
              <ChipMarca
                key={m}
                ativo={marcaFiltro === m}
                cor={MARCAS[m].cor}
                onClick={() => setMarcaFiltro(m)}
              >
                {MARCAS[m].label}
              </ChipMarca>
            ))}
          </div>
          <select
            value={projetoFiltro}
            onChange={(e) => setProjetoFiltro(e.target.value)}
            className="rounded-marca border border-marca-cinza/40 bg-white px-2.5 py-1.5 text-sm text-marca-preto outline-none focus:border-marca-laranja"
          >
            <option value="todos">Todos os projetos</option>
            {projetosComHoras.map((p) => (
              <option key={p.id} value={p.id}>
                {p.titulo}
              </option>
            ))}
          </select>
          {pessoas.length > 1 && (
            <select
              value={pessoaFiltro}
              onChange={(e) => setPessoaFiltro(e.target.value)}
              className="rounded-marca border border-marca-cinza/40 bg-white px-2.5 py-1.5 text-sm text-marca-preto outline-none focus:border-marca-laranja"
            >
              <option value="todos">Todas as pessoas</option>
              {pessoas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome.includes("@") ? p.nome.split("@")[0] : p.nome}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* Coluna principal */}
          <div className="space-y-4">
            <div className="rounded-marca border border-marca-cinza/30 bg-white p-4 shadow-card">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="text-lg font-bold text-marca-azulEscuro">
                  {MESES[mes]} {ano}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => irMes(-1)}
                    aria-label="Mês anterior"
                    className="rounded-marca border border-marca-cinza/40 p-1.5 text-marca-azulEscuro transition hover:bg-marca-branco"
                  >
                    <ChevronLeft size={18} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => irMes(1)}
                    aria-label="Próximo mês"
                    className="rounded-marca border border-marca-cinza/40 p-1.5 text-marca-azulEscuro transition hover:bg-marca-branco"
                  >
                    <ChevronRight size={18} aria-hidden />
                  </button>
                </div>
              </div>
              <CalendarioHoras
                ano={ano}
                mes={mes}
                registros={filtrados}
                diaSelecionado={diaSelecionado}
                onSelecionarDia={(c) => setDiaSelecionado((atual) => (atual === c ? null : c))}
              />
            </div>

            {/* Detalhe do dia */}
            {diaSelecionado && (
              <div className="rounded-marca border border-marca-cinza/30 bg-white p-4 shadow-card">
                <div className="mb-2 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-marca-azulEscuro">
                    <CalendarDays size={16} aria-hidden />
                    {formatarData(diaSelecionado)} · {formatarDuracao(totalDoDia)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setDiaSelecionado(null)}
                    aria-label="Fechar detalhe do dia"
                    className="rounded-marca p-1 text-marca-cinza transition hover:text-marca-azulEscuro"
                  >
                    <X size={16} aria-hidden />
                  </button>
                </div>
                {registrosDoDia.length === 0 ? (
                  <p className="py-4 text-center text-xs text-marca-cinza">Nenhuma hora neste dia.</p>
                ) : (
                  <div className="space-y-2">
                    {registrosDoDia.map((r) => (
                      <CardRegistro
                        key={r.id}
                        registro={r}
                        card={cardPorId(r.cardId)}
                        marca={marcaDoRegistro(r)}
                        onAbrir={setEditar}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            <GraficoHorasPorDia
              ano={ano}
              mes={mes}
              registros={filtrados}
              modo={modoGrafico}
              onModo={setModoGrafico}
            />
          </div>

          {/* Coluna lateral */}
          <div className="space-y-4">
            <ListaRegistrosRecentes
              registros={filtrados}
              timerAtivo={timerAtivo}
              onAbrir={setEditar}
            />
            <ResumoPorProjeto registros={filtrados} />
          </div>
        </div>
      </div>

      {editar !== null && (
        <ModalEditarRegistro
          registro={editar === "novo" ? undefined : editar}
          onFechar={() => setEditar(null)}
        />
      )}
    </div>
  );
}

function Kpi({
  rotulo,
  valor,
  sub,
  variacao,
}: {
  rotulo: string;
  valor: string;
  sub?: string;
  variacao?: number | null;
}) {
  return (
    <div className="rounded-marca border border-marca-cinza/30 bg-white p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-marca-cinza">{rotulo}</p>
      <p className="mt-1 text-2xl font-bold text-marca-azulEscuro">{valor}</p>
      {sub ? (
        <p className="mt-0.5 truncate text-xs text-marca-cinza" title={sub}>
          {sub}
        </p>
      ) : variacao != null && !Number.isNaN(variacao) ? (
        <p
          className={`mt-1 flex items-center gap-0.5 text-xs font-semibold ${
            variacao > 0 ? "text-marca-verde" : variacao < 0 ? "text-marca-vermelho" : "text-marca-cinza"
          }`}
        >
          {variacao > 0 ? (
            <ArrowUp size={12} aria-hidden />
          ) : variacao < 0 ? (
            <ArrowDown size={12} aria-hidden />
          ) : null}
          {variacao > 0 ? "+" : ""}
          {variacao.toFixed(0)}% vs mês anterior
        </p>
      ) : null}
    </div>
  );
}

function ChipMarca({
  ativo,
  cor,
  onClick,
  children,
}: {
  ativo: boolean;
  cor?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-marca border px-3 py-1.5 text-sm font-semibold transition ${
        ativo ? "border-transparent text-white" : "border-marca-cinza/40 bg-white text-marca-cinza hover:text-marca-azulEscuro"
      }`}
      style={ativo ? { backgroundColor: cor ?? "#002952" } : undefined}
    >
      {cor && !ativo && (
        <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cor }} aria-hidden />
      )}
      {children}
    </button>
  );
}
