"use client";

import { useEffect, useState } from "react";
import { BarChart3, ClipboardPaste, Copy, Sparkles } from "lucide-react";
import {
  HANDLE_PADRAO,
  rotuloPerfil,
  type MetricasInstagram,
  type PerfilMetrica,
} from "@/lib/metricas";
import { getMetricas, saveMetricas } from "@/lib/metricasStorage";
import { useBoard } from "@/lib/store";
import { useOrg } from "@/lib/orgProvider";
import SeletorPerfil from "@/components/metricas/SeletorPerfil";
import BlocoPromptAtualizacao from "@/components/metricas/BlocoPromptAtualizacao";
import ModalColarMetricas from "@/components/metricas/ModalColarMetricas";
import Dashboard from "@/components/metricas/Dashboard";
import PainelPlanejamento from "@/components/metricas/PainelPlanejamento";

type Aba = "metricas" | "planejamento";

/** Secao de Metricas e Planejamento dos perfis de Instagram (Brusoft e Evotalks). */
export default function PaginaMetricas() {
  const { orgId } = useOrg();
  const { marcas, marcaPorId } = useBoard();
  const [perfil, setPerfil] = useState<PerfilMetrica>("brusoft");

  // Alinha o perfil ativo as marcas da organizacao (a 1a, quando o atual nao existe).
  useEffect(() => {
    if (marcas.length > 0 && !marcas.some((m) => m.id === perfil)) {
      setPerfil(marcas[0].id);
    }
  }, [marcas, perfil]);
  const [aba, setAba] = useState<Aba>("metricas");
  const [dados, setDados] = useState<MetricasInstagram | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [modalAberto, setModalAberto] = useState(false);
  const [periodoLabel, setPeriodoLabel] = useState("últimos 30 dias");

  // Periodo padrao do prompt (definido apos montar para nao divergir do SSR).
  useEffect(() => {
    const fim = new Date();
    const inicio = new Date();
    inicio.setDate(fim.getDate() - 29);
    const f = (d: Date) => d.toLocaleDateString("pt-BR");
    setPeriodoLabel(`${f(inicio)} a ${f(fim)} (30 dias)`);
  }, []);

  // Carrega as metricas do perfil ativo da organizacao.
  useEffect(() => {
    if (!orgId) return;
    let ativo = true;
    setCarregando(true);
    getMetricas(orgId, perfil)
      .then((d) => {
        if (ativo) {
          setDados(d);
          setCarregando(false);
        }
      })
      .catch(() => {
        if (ativo) {
          setDados(null);
          setCarregando(false);
        }
      });
    return () => {
      ativo = false;
    };
  }, [perfil, orgId]);

  const cor = marcaPorId(perfil).cor;
  const handle = dados?.handle || HANDLE_PADRAO[perfil] || "";

  async function salvar(d: MetricasInstagram) {
    if (orgId) await saveMetricas(orgId, d.perfil, d);
    setDados(d);
    setPerfil(d.perfil); // se o JSON for de outro perfil, abre o perfil correto
    setAba("metricas");
  }

  const semDados = !carregando && !dados;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {/* Cabecalho */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-titulo text-2xl font-bold uppercase tracking-wide text-marca-azulEscuro">
              Métricas e Planejamento
            </h1>
            <p className="text-sm text-marca-cinza">
              Desempenho do Instagram de {rotuloPerfil(perfil)} e próximas ações de conteúdo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalAberto(true)}
            className="flex items-center gap-1.5 rounded-marca bg-marca-laranja px-4 py-2 text-sm font-bold text-white transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-marca-azulEscuro"
          >
            <ClipboardPaste size={16} aria-hidden />
            Atualizar métricas
          </button>
        </div>

        {/* Seletor de perfil */}
        <div className="mb-5">
          <SeletorPerfil perfil={perfil} onChange={setPerfil} />
        </div>

        {/* Abas */}
        <div className="mb-5 flex border-b border-marca-cinza/30" role="tablist">
          {(
            [
              { id: "metricas", rotulo: "Métricas" },
              { id: "planejamento", rotulo: "Planejamento" },
            ] as { id: Aba; rotulo: string }[]
          ).map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={aba === a.id}
              onClick={() => setAba(a.id)}
              className={`relative px-4 py-2.5 text-sm font-semibold transition ${
                aba === a.id ? "text-marca-laranja" : "text-marca-cinza hover:text-marca-azulEscuro"
              }`}
            >
              {a.rotulo}
              {aba === a.id && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-marca-laranja" />
              )}
            </button>
          ))}
        </div>

        {carregando ? (
          <p className="text-sm text-marca-cinza">Carregando métricas...</p>
        ) : aba === "metricas" ? (
          semDados ? (
            <Onboarding
              perfil={perfil}
              handle={handle}
              periodoLabel={periodoLabel}
              onAbrirModal={() => setModalAberto(true)}
            />
          ) : (
            <div className="space-y-5">
              <details className="group rounded-marca border border-marca-cinza/30 bg-white">
                <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm font-semibold text-marca-azulEscuro">
                  <Sparkles size={15} aria-hidden />
                  Ver prompt para atualizar com o Claude
                </summary>
                <div className="border-t border-marca-cinza/20 p-3">
                  <BlocoPromptAtualizacao perfil={perfil} handle={handle} periodoLabel={periodoLabel} />
                </div>
              </details>
              {dados && <Dashboard dados={dados} cor={cor} />}
            </div>
          )
        ) : dados ? (
          <PainelPlanejamento dados={dados} perfil={perfil} />
        ) : (
          <p className="rounded-marca border border-dashed border-marca-cinza/40 px-4 py-10 text-center text-sm text-marca-cinza">
            Atualize as métricas deste perfil para ver o planejamento.
          </p>
        )}
      </div>

      {modalAberto && (
        <ModalColarMetricas
          perfilAtivo={perfil}
          onFechar={() => setModalAberto(false)}
          onSalvar={salvar}
        />
      )}
    </div>
  );
}

/** Estado vazio com o passo a passo (copiar prompt, colar no Claude, colar JSON). */
function Onboarding({
  perfil,
  handle,
  periodoLabel,
  onAbrirModal,
}: {
  perfil: PerfilMetrica;
  handle: string;
  periodoLabel: string;
  onAbrirModal: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-3 rounded-marca border border-dashed border-marca-cinza/40 bg-white px-4 py-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-marca-branco text-marca-cinza">
          <BarChart3 size={26} aria-hidden />
        </span>
        <h2 className="text-lg font-bold text-marca-azulEscuro">
          Ainda sem métricas de {rotuloPerfil(perfil)}
        </h2>
        <p className="max-w-md text-sm text-marca-cinza">
          Como funciona: <strong>1.</strong> copie o prompt abaixo. <strong>2.</strong> cole num
          Claude conectado ao Instagram (ou com prints do Insights). <strong>3.</strong> traga o JSON
          de volta e clique em Atualizar métricas.
        </p>
        <button
          type="button"
          onClick={onAbrirModal}
          className="flex items-center gap-1.5 rounded-marca bg-marca-laranja px-4 py-2 text-sm font-bold text-white transition hover:brightness-95"
        >
          <Copy size={15} aria-hidden />
          Já tenho o JSON, atualizar métricas
        </button>
      </div>

      <BlocoPromptAtualizacao perfil={perfil} handle={handle} periodoLabel={periodoLabel} />
    </div>
  );
}
