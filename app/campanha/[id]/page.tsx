"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useBoard } from "@/lib/store";
import type { Etapa, FiltrosState } from "@/lib/types";
import BarraCampanha from "@/components/BarraCampanha";
import Filtros from "@/components/Filtros";
import Board from "@/components/Board";
import ModalCard from "@/components/ModalCard";
import ColarDoClaude from "@/components/ColarDoClaude";

const FILTROS_INICIAIS: FiltrosState = {
  busca: "",
  tipo: "todos",
  canal: "todos",
  tema: "todos",
};

/** Quadro Kanban de uma campanha especifica. */
export default function PaginaCampanha() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const { campanhaPorId, cardsDaCampanha, temasDaCampanha, adicionarCard, cardPorId, pronto } =
    useBoard();

  const [filtros, setFiltros] = useState<FiltrosState>(FILTROS_INICIAIS);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [colarAberto, setColarAberto] = useState(false);

  const campanha = campanhaPorId(id);
  const cardsCampanha = cardsDaCampanha(id);
  const temas = temasDaCampanha(id);

  function aplicarFiltros(parcial: Partial<FiltrosState>) {
    setFiltros((atual) => ({ ...atual, ...parcial }));
  }

  // Busca por titulo + filtros (em conjunto), escopados a campanha.
  const cardsFiltrados = useMemo(() => {
    const termo = filtros.busca.trim().toLowerCase();
    return cardsCampanha.filter((card) => {
      if (termo && !card.titulo.toLowerCase().includes(termo)) return false;
      if (filtros.tipo !== "todos" && card.tipo !== filtros.tipo) return false;
      if (filtros.canal !== "todos" && !card.canais.includes(filtros.canal)) return false;
      if (filtros.tema !== "todos" && (card.tema ?? "") !== filtros.tema) return false;
      return true;
    });
  }, [cardsCampanha, filtros]);

  // Busca global (e nao so na campanha atual) para o modal continuar aberto
  // mesmo se o card for movido para outra campanha pelo seletor.
  const cardSelecionado = selecionadoId ? cardPorId(selecionadoId) ?? null : null;

  function novoConteudo(etapa: Etapa) {
    const card = adicionarCard(id, etapa);
    setSelecionadoId(card.id);
  }

  function novoProjeto() {
    const card = adicionarCard(id, "ideias", "projeto");
    setSelecionadoId(card.id);
  }

  // Estados de carregamento e campanha inexistente.
  if (!pronto) {
    return <p className="px-4 py-6 text-sm text-marca-cinza">Carregando...</p>;
  }
  if (!campanha) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <p className="text-marca-cinza">Campanha não encontrada.</p>
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-marca bg-marca-laranja px-4 py-2 text-sm font-bold text-white"
        >
          <ArrowLeft size={16} aria-hidden />
          Voltar para campanhas
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <BarraCampanha
        campanha={campanha}
        onNovo={() => novoConteudo("ideias")}
        onNovoProjeto={novoProjeto}
        onColar={() => setColarAberto(true)}
      >
        <Filtros filtros={filtros} onChange={aplicarFiltros} temas={temas} />
      </BarraCampanha>

      <main className="flex min-h-0 flex-1 flex-col">
        <Board cards={cardsFiltrados} onAbrir={setSelecionadoId} onNovo={novoConteudo} />
      </main>

      {cardSelecionado && (
        <ModalCard
          key={cardSelecionado.id}
          card={cardSelecionado}
          onFechar={() => setSelecionadoId(null)}
        />
      )}

      {colarAberto && (
        <ColarDoClaude
          campanhaId={id}
          onFechar={() => setColarAberto(false)}
          onCriado={(primeiroId) => setSelecionadoId(primeiroId)}
        />
      )}
    </div>
  );
}
