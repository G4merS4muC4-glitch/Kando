"use client";

import { useMemo, useState } from "react";
import { campanhaArquivada, pesoPrioridade } from "@/lib/config";
import { useBoard } from "@/lib/store";
import type { CardConteudo, EtapaOrg, MarcaFiltro } from "@/lib/types";
import { CardVisual } from "@/components/Card";
import ModalCard from "@/components/ModalCard";

/**
 * Quadro Geral: um unico Kanban que junta TODAS as campanhas ativas das marcas,
 * agrupado por etapa (menos a coluna de publicado). Da a visao de cada etapa de
 * todos os projetos das duas empresas. Dentro de cada etapa, os cards vem por
 * prioridade (e depois por data). Mesmo visual e rolagem do quadro da campanha;
 * cada card mostra a campanha de origem. Clicar abre o card.
 *
 * Reaproveitado pela rota /geral e pela alternancia dentro do Painel.
 */
export default function QuadroGeral() {
  const { cards, campanhas, marcas, marcaPorId, campanhaPorId, etapas, etapaPostado, pronto } =
    useBoard();
  const [marcaFiltro, setMarcaFiltro] = useState<MarcaFiltro>("todas");
  const [abertoId, setAbertoId] = useState<string | null>(null);

  const colunas = useMemo(() => {
    const ativasIds = new Set(
      campanhas
        .filter((c) => !campanhaArquivada(c.status))
        .filter((c) => marcaFiltro === "todas" || c.marca === marcaFiltro)
        .map((c) => c.id)
    );
    const ativos = cards.filter((c) => ativasIds.has(c.campanhaId));
    const ordenar = (a: CardConteudo, b: CardConteudo) =>
      pesoPrioridade(b.prioridade) - pesoPrioridade(a.prioridade) ||
      (a.dataPublicacao ?? "9999").localeCompare(b.dataPublicacao ?? "9999");
    // Todas as etapas menos a de publicado (concluido).
    return etapas
      .filter((e) => e.id !== etapaPostado.id)
      .map((e) => ({ etapa: e, cards: ativos.filter((c) => c.etapa === e.id).sort(ordenar) }));
  }, [cards, campanhas, etapas, etapaPostado, marcaFiltro]);

  const cardAberto = abertoId ? cards.find((c) => c.id === abertoId) : undefined;

  return (
    <div className="flex h-full min-w-0 flex-col bg-marca-branco">
      {/* Cabecalho + filtro de marca (fixo; o quadro rola abaixo) */}
      <div className="shrink-0 border-b border-marca-cinza/30 bg-white px-4 py-3 sm:px-6">
        <div className="mb-2">
          <h1 className="font-titulo text-xl font-bold uppercase tracking-wide text-marca-azulEscuro">
            Quadro geral
          </h1>
          <p className="text-sm text-marca-cinza">
            Cada etapa com os conteúdos de todas as campanhas, por prioridade.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FiltroMarca ativo={marcaFiltro === "todas"} onClick={() => setMarcaFiltro("todas")}>
            Todas
          </FiltroMarca>
          {marcas.map((m) => (
            <FiltroMarca
              key={m.id}
              ativo={marcaFiltro === m.id}
              cor={m.cor}
              onClick={() => setMarcaFiltro(m.id)}
            >
              {m.nome}
            </FiltroMarca>
          ))}
        </div>
      </div>

      {/* Quadro: um scroll so (vertical no mobile, horizontal no desktop quando
          as colunas nao cabem), igual ao quadro da campanha. */}
      {!pronto ? (
        <p className="p-6 text-sm text-marca-cinza">Carregando quadro...</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-8 sm:overflow-auto sm:px-4 sm:pb-4">
          <div className="flex flex-col gap-2.5 pt-4 sm:flex-row sm:items-start sm:gap-4">
            {colunas.map(({ etapa, cards: cs }) => (
              <ColunaGeral
                key={etapa.id}
                etapa={etapa}
                cards={cs}
                marcaPorId={marcaPorId}
                campanhaNome={(id) => campanhaPorId(id)?.nome ?? ""}
                campanhaMarca={(id) => campanhaPorId(id)?.marca ?? ""}
                onAbrir={setAbertoId}
              />
            ))}
          </div>
        </div>
      )}

      {cardAberto && <ModalCard card={cardAberto} onFechar={() => setAbertoId(null)} />}
    </div>
  );
}

/** Coluna (etapa) do quadro geral. Mesmo formato das colunas da campanha. */
function ColunaGeral({
  etapa,
  cards,
  marcaPorId,
  campanhaNome,
  campanhaMarca,
  onAbrir,
}: {
  etapa: EtapaOrg;
  cards: CardConteudo[];
  marcaPorId: (id: string) => { cor: string };
  campanhaNome: (campanhaId: string) => string;
  campanhaMarca: (campanhaId: string) => string;
  onAbrir: (id: string) => void;
}) {
  const temCards = cards.length > 0;
  return (
    <section className="flex w-full shrink-0 flex-col sm:w-[300px]" aria-label={etapa.titulo}>
      <header className="hidden px-1 sm:sticky sm:top-0 sm:z-20 sm:block sm:bg-marca-branco sm:pb-2">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-marca-azulEscuro">
          {etapa.titulo}
          <span
            className={`rounded-marca px-2 py-0.5 text-xs font-semibold ${
              temCards ? "bg-marca-laranja text-white" : "bg-marca-azulEscuro/10 text-marca-azulEscuro/60"
            }`}
          >
            {cards.length}
          </span>
        </h2>
        {etapa.descricao && <p className="mt-0.5 text-xs text-marca-cinza">{etapa.descricao}</p>}
      </header>

      {/* Cabecalho compacto no mobile */}
      <div className="mb-2 flex items-center justify-between gap-2 px-1 sm:hidden">
        <span className="truncate text-sm font-bold uppercase tracking-wide text-marca-azulEscuro">
          {etapa.titulo}
        </span>
        <span
          className={`shrink-0 rounded-marca px-2 py-0.5 text-xs font-semibold ${
            temCards ? "bg-marca-laranja text-white" : "bg-marca-azulEscuro/10 text-marca-azulEscuro/60"
          }`}
        >
          {cards.length}
        </span>
      </div>

      <div className="flex min-h-[80px] flex-col gap-2 rounded-marca p-1 sm:min-h-[120px] sm:flex-1">
        {cards.map((card) => (
          <div key={card.id}>
            {/* Selo da campanha de origem (contexto que o quadro da campanha nao precisa) */}
            <div className="mb-1 flex items-center gap-1.5 px-1 text-[11px] font-medium text-marca-cinza">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: marcaPorId(campanhaMarca(card.campanhaId)).cor }}
                aria-hidden
              />
              <span className="truncate">{campanhaNome(card.campanhaId)}</span>
            </div>
            <CardVisual card={card} onAbrir={onAbrir} onClick={() => onAbrir(card.id)} />
          </div>
        ))}
        {cards.length === 0 && (
          <p className="select-none px-2 py-6 text-center text-xs text-marca-cinza/70">Vazio</p>
        )}
      </div>
    </section>
  );
}

function FiltroMarca({
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
        ativo
          ? "border-transparent text-white"
          : "border-marca-cinza/40 bg-white text-marca-cinza hover:text-marca-azulEscuro"
      }`}
      style={ativo ? { backgroundColor: cor ?? "#002952" } : undefined}
    >
      {cor && (
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: ativo ? "rgba(255,255,255,0.9)" : cor }}
          aria-hidden
        />
      )}
      {children}
    </button>
  );
}
