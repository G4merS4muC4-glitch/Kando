"use client";

import { useMemo, useState } from "react";
import { Plus, FolderOpen } from "lucide-react";
import { MARCAS, MARCAS_ORDEM } from "@/lib/config";
import { useBoard } from "@/lib/store";
import type { MarcaFiltro } from "@/lib/types";
import CampanhaCard from "@/components/CampanhaCard";
import ModalCampanha from "@/components/ModalCampanha";

/**
 * Tela inicial: grade unica de campanhas com filtro de marca.
 * Cada campanha abre o seu proprio quadro Kanban de conteudos.
 */
export default function Inicial() {
  const { campanhas, cardsDaCampanha, campanhaPorId, pronto } = useBoard();
  const [marcaFiltro, setMarcaFiltro] = useState<MarcaFiltro>("todas");
  const [criando, setCriando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const campanhasFiltradas = useMemo(() => {
    if (marcaFiltro === "todas") return campanhas;
    return campanhas.filter((c) => c.marca === marcaFiltro);
  }, [campanhas, marcaFiltro]);

  const campanhaEmEdicao = editandoId ? campanhaPorId(editandoId) : undefined;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Cabecalho da pagina */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-titulo text-2xl font-bold uppercase tracking-wide text-marca-azulEscuro">
              Campanhas
            </h1>
            <p className="text-sm text-marca-cinza">
              Escolha uma campanha para abrir o quadro de conteudos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCriando(true)}
            className="flex items-center gap-1.5 rounded-marca bg-marca-laranja px-4 py-2 text-sm font-bold text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-azulEscuro"
          >
            <Plus size={16} aria-hidden />
            Nova campanha
          </button>
        </div>

        {/* Filtro de marca */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <FiltroMarca ativo={marcaFiltro === "todas"} onClick={() => setMarcaFiltro("todas")}>
            Todas
          </FiltroMarca>
          {MARCAS_ORDEM.map((m) => (
            <FiltroMarca
              key={m}
              ativo={marcaFiltro === m}
              cor={MARCAS[m].cor}
              onClick={() => setMarcaFiltro(m)}
            >
              {MARCAS[m].label}
            </FiltroMarca>
          ))}
        </div>

        {/* Grade de campanhas */}
        {!pronto ? (
          <p className="text-sm text-marca-cinza">Carregando campanhas...</p>
        ) : campanhasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-marca border border-dashed border-marca-cinza/40 py-16 text-center">
            <FolderOpen size={36} className="mb-3 text-marca-cinza" aria-hidden />
            <p className="text-sm text-marca-cinza">Nenhuma campanha por aqui ainda.</p>
            <button
              type="button"
              onClick={() => setCriando(true)}
              className="mt-3 flex items-center gap-1.5 rounded-marca bg-marca-laranja px-4 py-2 text-sm font-bold text-white transition hover:brightness-95"
            >
              <Plus size={16} aria-hidden />
              Criar a primeira campanha
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {campanhasFiltradas.map((campanha) => (
              <CampanhaCard
                key={campanha.id}
                campanha={campanha}
                cards={cardsDaCampanha(campanha.id)}
                onEditar={setEditandoId}
              />
            ))}
          </div>
        )}
      </div>

      {criando && (
        <ModalCampanha
          onCriada={(m) => setMarcaFiltro(m)}
          onFechar={() => setCriando(false)}
        />
      )}
      {campanhaEmEdicao && (
        <ModalCampanha
          key={campanhaEmEdicao.id}
          campanha={campanhaEmEdicao}
          onFechar={() => setEditandoId(null)}
        />
      )}
    </div>
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
