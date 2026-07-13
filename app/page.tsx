"use client";

import { useMemo, useState } from "react";
import {
  Layers,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flag,
  Calendar,
  Columns3,
  LayoutDashboard,
  Settings,
  Timer,
} from "lucide-react";
import { CANAIS, PRIORIDADES, campanhaArquivada, pesoPrioridade } from "@/lib/config";
import { useBoard } from "@/lib/store";
import { useApontamentos } from "@/lib/apontamentosProvider";
import type { CardConteudo } from "@/lib/types";
import { chaveData, formatarData, prazoVencido } from "@/lib/util";
import BadgeTipo from "@/components/BadgeTipo";
import ModalCard from "@/components/ModalCard";
import QuadroGeral from "@/components/QuadroGeral";
import CartaoProjetoAtual from "@/components/apontamentos/CartaoProjetoAtual";
import CartaoTimerColega from "@/components/apontamentos/CartaoTimerColega";
import ModalConfigTempo from "@/components/apontamentos/ModalConfigTempo";

/** Remove acentos e caixa, para casar o nome da etapa de produção. */
function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/**
 * Painel organizacional: a tela inicial. Visao geral dos conteudos de todas as
 * campanhas ativas (todas as marcas): KPIs, o projeto atual (em produção, com
 * cronometro), a fila em ordem de prioridade, as proximas publicacoes, os
 * atrasados e a distribuicao por etapa. O "Quadro geral" abre aqui mesmo, sem
 * trocar de pagina. Clicar em qualquer card abre o detalhe.
 */
export default function Painel() {
  const { cards, campanhas, marcaPorId, campanhaPorId, etapas, etapaPorId, etapaPostado, pronto } =
    useBoard();
  const { timerAtivo, timersEquipe, autor } = useApontamentos();
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const [vista, setVista] = useState<"painel" | "geral">("painel");
  const [configAberto, setConfigAberto] = useState(false);

  const dados = useMemo(() => {
    const ativasIds = new Set(
      campanhas.filter((c) => !campanhaArquivada(c.status)).map((c) => c.id)
    );
    const ativos = cards.filter((c) => ativasIds.has(c.campanhaId));
    const ehPostado = (c: CardConteudo) => c.etapa === etapaPostado.id;
    const emProducao = ativos.filter((c) => !ehPostado(c));
    const vencido = (c: CardConteudo) => prazoVencido(c.dataPublicacao, c.etapa, etapaPostado.id);
    const hoje = chaveData(new Date());

    const porData = (a: CardConteudo, b: CardConteudo) =>
      (a.dataPublicacao ?? "9999").localeCompare(b.dataPublicacao ?? "9999");
    const porPrioridade = (a: CardConteudo, b: CardConteudo) =>
      pesoPrioridade(b.prioridade) - pesoPrioridade(a.prioridade) || porData(a, b);
    // Ordem de trabalho: urgentes no topo; logo abaixo os atrasados; depois por
    // prioridade e data (a data vermelha ja sinaliza o atraso).
    const ehUrgente = (c: CardConteudo) => (c.prioridade === "urgente" ? 1 : 0);
    const ehAtrasado = (c: CardConteudo) => (vencido(c) ? 1 : 0);
    const ordemTrabalho = (a: CardConteudo, b: CardConteudo) =>
      ehUrgente(b) - ehUrgente(a) || ehAtrasado(b) - ehAtrasado(a) || porPrioridade(a, b);

    // Etapa de produção do quadro (por id padrao, senao pelo nome; senao tudo o
    // que nao esta publicado como fallback).
    const etapaProd =
      etapas.find((e) => e.id === "producao") ??
      etapas.find((e) => semAcento(e.titulo).includes("produc")) ??
      null;
    const producao = (etapaProd ? emProducao.filter((c) => c.etapa === etapaProd.id) : [...emProducao]).sort(
      porPrioridade
    );

    return {
      total: ativos.length,
      publicados: ativos.filter(ehPostado).length,
      emProducao: emProducao.length,
      atrasadosQtd: emProducao.filter(vencido).length,
      // Projeto atual: os conteudos em produção, por prioridade.
      producao,
      // Fila de trabalho: urgentes, depois atrasados, depois prioridade/data.
      ordem: [...emProducao].sort(ordemTrabalho).slice(0, 14),
      // Cards com prazo vencido (nao publicados), do mais antigo ao mais recente.
      atrasados: emProducao.filter(vencido).sort(porData).slice(0, 12),
      // Publicacoes com data marcada a frente.
      proximas: emProducao
        .filter((c) => c.dataPublicacao && c.dataPublicacao >= hoje)
        .sort(porData)
        .slice(0, 8),
      porEtapa: etapas.map((e) => ({ etapa: e, qtd: ativos.filter((c) => c.etapa === e.id).length })),
      maxEtapa: Math.max(1, ...etapas.map((e) => ativos.filter((c) => c.etapa === e.id).length)),
    };
  }, [cards, campanhas, etapas, etapaPostado]);

  const cardAberto = abertoId ? cards.find((c) => c.id === abertoId) : undefined;

  // Card em destaque do "Projeto atual": prioriza o que estiver com o timer
  // rodando (mesmo fora da etapa de produção, para nao sumir o relogio ao vivo nem
  // oferecer um "Iniciar" que encerraria o timer em andamento); senao, o mais
  // prioritario em produção. Abaixo, o resto da produção.
  const cardTimando = timerAtivo?.cardId ? cards.find((c) => c.id === timerAtivo.cardId) : null;
  const destaque = cardTimando ?? dados.producao[0] ?? null;
  const restoProducao = destaque
    ? dados.producao.filter((c) => c.id !== destaque.id).slice(0, 8)
    : [];
  // Colegas com timer rodando agora (exclui o meu proprio), para o "Projeto atual"
  // mostrar quem mais esta trabalhando, ao vivo.
  const colegasTrabalhando = timersEquipe.filter((t) => t.userId !== autor.id);

  function linhaDeCard(card: CardConteudo, lado: "direita" | "esquerda" = "direita") {
    const camp = campanhaPorId(card.campanhaId);
    const marca = camp ? marcaPorId(camp.marca) : undefined;
    const prio = card.prioridade ? PRIORIDADES[card.prioridade] : null;
    const vencido = prazoVencido(card.dataPublicacao, card.etapa, etapaPostado.id);
    return (
      <div key={card.id} className="group relative">
        <button
          type="button"
          onClick={() => setAbertoId(card.id)}
          className="flex w-full items-center gap-2.5 rounded-marca border border-marca-cinza/30 bg-white p-2.5 text-left transition hover:border-marca-cinza/60 hover:shadow-card"
        >
          <span
            className="h-9 w-1 shrink-0 rounded-full"
            style={{ backgroundColor: prio?.cor ?? marca?.cor ?? "#8790AB" }}
            aria-hidden
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <BadgeTipo tipo={card.tipo} tamanho="pequeno" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-marca-preto">
                {card.titulo || "Sem título"}
              </span>
              {prio && (
                <span
                  className="inline-flex shrink-0 items-center gap-1 rounded-marca px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                  style={{ backgroundColor: prio.cor }}
                >
                  <Flag size={10} aria-hidden /> {prio.label}
                </span>
              )}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-marca-cinza">
              {marca && (
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: marca.cor }} aria-hidden />
                  {marca.nome}
                </span>
              )}
              {camp && <span className="min-w-0 truncate">· {camp.nome}</span>}
              {card.dataPublicacao && (
                <span
                  className={`inline-flex items-center gap-1 ${vencido ? "font-semibold" : ""}`}
                  style={vencido ? { color: "#EC1313" } : undefined}
                >
                  {vencido ? <AlertTriangle size={11} aria-hidden /> : <Calendar size={11} aria-hidden />}
                  {formatarData(card.dataPublicacao)}
                </span>
              )}
            </span>
          </span>
        </button>

        {/* Mini janela ao passar o mouse (desktop): briefing e infos rapidas */}
        <div
          className={`pointer-events-none absolute top-1/2 z-40 hidden w-72 -translate-y-1/2 opacity-0 transition-all duration-150 group-hover:opacity-100 lg:block ${
            lado === "esquerda"
              ? "right-full mr-3 translate-x-2 group-hover:translate-x-0"
              : "left-full ml-3 -translate-x-2 group-hover:translate-x-0"
          }`}
        >
          <div className="rounded-marca border border-marca-cinza/30 bg-white p-3 shadow-modal">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <BadgeTipo tipo={card.tipo} tamanho="pequeno" />
              {marca && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-marca-cinza">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: marca.cor }} aria-hidden />
                  {marca.nome}
                </span>
              )}
              {prio && (
                <span
                  className="ml-auto inline-flex items-center gap-1 rounded-marca px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                  style={{ backgroundColor: prio.cor }}
                >
                  <Flag size={10} aria-hidden /> {prio.label}
                </span>
              )}
            </div>
            <p className="mb-1 text-sm font-bold leading-snug text-marca-azulEscuro">
              {card.titulo || "Sem título"}
            </p>
            <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-marca-cinza">
              {camp && <span className="truncate">{camp.nome}</span>}
              <span>· {etapaPorId(card.etapa).titulo}</span>
              {card.dataPublicacao && (
                <span className={`inline-flex items-center gap-1 ${vencido ? "font-semibold" : ""}`} style={vencido ? { color: "#EC1313" } : undefined}>
                  {vencido ? <AlertTriangle size={11} aria-hidden /> : <Calendar size={11} aria-hidden />}
                  {formatarData(card.dataPublicacao)}
                </span>
              )}
              {card.canais.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  {card.canais.map((canal) => {
                    const IconeCanal = CANAIS[canal].icone;
                    return <IconeCanal key={canal} size={12} style={{ color: CANAIS[canal].cor }} aria-label={CANAIS[canal].label} />;
                  })}
                </span>
              )}
            </div>
            <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-marca-cinza">Briefing</p>
            <p className="line-clamp-5 whitespace-pre-wrap text-xs leading-relaxed text-marca-preto">
              {card.briefing?.trim() || "Sem briefing."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      {/* Cabecalho: titulo + alternador Painel/Quadro geral (mesma pagina) + Campanhas */}
      <div className="w-full px-4 pb-4 pt-6 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {vista === "painel" ? (
            <div>
              <h1 className="font-titulo text-2xl font-bold uppercase tracking-wide text-marca-azulEscuro">
                Painel
              </h1>
              <p className="text-sm text-marca-cinza">Visão geral dos conteúdos de todas as marcas.</p>
            </div>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <div className="flex rounded-marca border border-marca-cinza/30 bg-white p-0.5">
              <BotaoVista
                ativo={vista === "painel"}
                onClick={() => setVista("painel")}
                icone={<LayoutDashboard size={15} aria-hidden />}
              >
                Painel
              </BotaoVista>
              <BotaoVista
                ativo={vista === "geral"}
                onClick={() => setVista("geral")}
                icone={<Columns3 size={15} aria-hidden />}
              >
                Quadro geral
              </BotaoVista>
            </div>
          </div>
        </div>
      </div>

      {vista === "geral" ? (
        <div className="min-h-0 flex-1">
          <QuadroGeral />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="w-full px-4 pb-10 sm:px-6 lg:px-8">
            {!pronto ? (
              <p className="text-sm text-marca-cinza">Carregando painel...</p>
            ) : (
              <>
                {/* KPIs */}
                <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Kpi icone={Layers} rotulo="Conteúdos ativos" valor={dados.total} cor="#044B8C" />
                  <Kpi icone={Clock} rotulo="Em produção" valor={dados.emProducao} cor="#FA611E" />
                  <Kpi icone={CheckCircle2} rotulo="Publicados" valor={dados.publicados} cor="#16A34A" />
                  <Kpi icone={AlertTriangle} rotulo="Atrasados" valor={dados.atrasadosQtd} cor="#EC1313" />
                </div>

                {/* 4 colunas de uma vez (ocupando a largura do monitor); Por etapa
                    no final, em toda a largura. */}
                <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 xl:grid-cols-4">
                  <Secao
                    titulo="Projeto atual"
                    icone={<Timer size={15} aria-hidden />}
                    acao={
                      <button
                        type="button"
                        onClick={() => setConfigAberto(true)}
                        title="Configurações de tempo"
                        aria-label="Configurações de tempo"
                        className="flex items-center gap-1 rounded-marca border border-marca-cinza/40 px-2 py-1 text-xs font-semibold text-marca-cinza transition hover:border-marca-azulEscuro hover:text-marca-azulEscuro"
                      >
                        <Settings size={14} aria-hidden />
                        <span className="hidden sm:inline">Tempo</span>
                      </button>
                    }
                    vazio={
                      !destaque && colegasTrabalhando.length === 0 ? "Nada em produção agora." : undefined
                    }
                  >
                    {destaque && <CartaoProjetoAtual card={destaque} onAbrir={setAbertoId} />}
                    {restoProducao.length > 0 && (
                      <div className="space-y-2">{restoProducao.map((c) => linhaDeCard(c, "direita"))}</div>
                    )}
                    {colegasTrabalhando.length > 0 && (
                      <div>
                        <p className="mb-2 mt-1 text-[11px] font-bold uppercase tracking-wide text-marca-cinza">
                          Equipe trabalhando agora
                        </p>
                        <div className="space-y-2">
                          {colegasTrabalhando.map((t) => (
                            <CartaoTimerColega key={t.userId} timer={t.timer} />
                          ))}
                        </div>
                      </div>
                    )}
                  </Secao>

                  <Secao
                    titulo="Ordem de prioridade"
                    icone={<Flag size={15} aria-hidden />}
                    vazio={dados.ordem.length === 0 ? "Nenhum conteúdo em produção." : undefined}
                  >
                    {dados.ordem.map((c) => linhaDeCard(c, "direita"))}
                  </Secao>

                  <Secao
                    titulo="Próximas publicações"
                    icone={<Calendar size={15} aria-hidden />}
                    vazio={dados.proximas.length === 0 ? "Nenhuma publicação com data marcada à frente." : undefined}
                  >
                    {dados.proximas.map((c) => linhaDeCard(c, "esquerda"))}
                  </Secao>

                  <Secao titulo="Por etapa" icone={<Columns3 size={15} aria-hidden />}>
                    <div className="space-y-2">
                      {dados.porEtapa.map(({ etapa, qtd }) => (
                        <div key={etapa.id} className="flex items-center gap-2">
                          <span className="w-24 shrink-0 truncate text-sm text-marca-preto">{etapa.titulo}</span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-marca-cinza/15">
                            <div
                              className="h-full rounded-full bg-marca-azulEscuro/70 transition-[width] duration-500"
                              style={{ width: `${Math.round((qtd / dados.maxEtapa) * 100)}%` }}
                            />
                          </div>
                          <span className="w-6 shrink-0 text-right text-sm font-semibold text-marca-azulEscuro">
                            {qtd}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Secao>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {cardAberto && <ModalCard card={cardAberto} onFechar={() => setAbertoId(null)} />}
      {configAberto && <ModalConfigTempo onFechar={() => setConfigAberto(false)} />}
    </div>
  );
}

/** Botao do alternador de vista (Painel / Quadro geral). */
function BotaoVista({
  ativo,
  onClick,
  icone,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  icone: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`flex items-center gap-1.5 rounded-marca px-3 py-1.5 text-sm font-semibold transition ${
        ativo ? "bg-marca-laranja text-white" : "text-marca-cinza hover:text-marca-azulEscuro"
      }`}
    >
      {icone}
      <span className="hidden sm:inline">{children}</span>
    </button>
  );
}

/** Cartao de indicador (KPI) com icone e cor de destaque. */
function Kpi({
  icone: Icone,
  rotulo,
  valor,
  cor,
}: {
  icone: typeof Layers;
  rotulo: string;
  valor: number;
  cor: string;
}) {
  return (
    <div className="rounded-marca border border-marca-cinza/30 bg-white p-4 shadow-card">
      <div className="mb-2 flex items-center gap-2">
        <span
          className="flex h-8 w-8 items-center justify-center rounded-marca text-white"
          style={{ backgroundColor: cor }}
        >
          <Icone size={16} aria-hidden />
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-marca-cinza">{rotulo}</span>
      </div>
      <p className="text-2xl font-bold text-marca-azulEscuro">{valor}</p>
    </div>
  );
}

/** Bloco de secao do painel, com titulo, acao opcional e conteudo (ou vazio). */
function Secao({
  titulo,
  icone,
  vazio,
  acao,
  children,
}: {
  titulo: string;
  icone: React.ReactNode;
  vazio?: string;
  acao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-marca border border-marca-cinza/30 bg-white p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-marca-azulEscuro">
          {icone} {titulo}
        </h2>
        {acao}
      </div>
      {vazio ? (
        <p className="rounded-marca border border-dashed border-marca-cinza/40 px-3 py-6 text-center text-sm text-marca-cinza">
          {vazio}
        </p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  );
}
