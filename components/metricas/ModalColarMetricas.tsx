"use client";

import { useEffect, useMemo, useState } from "react";
import { X, ClipboardPaste, BarChart3, AlertTriangle } from "lucide-react";
import {
  parseMetricas,
  rotuloPerfil,
  type MetricasInstagram,
  type PerfilMetrica,
} from "@/lib/metricas";

/**
 * Modal para colar o JSON de metricas gerado pelo Claude. Valida ao colar,
 * mostra uma previa ou um erro amigavel, e avisa se o perfil do JSON for
 * diferente do perfil ativo (oferecendo abrir o perfil correto).
 */
export default function ModalColarMetricas({
  perfilAtivo,
  onFechar,
  onSalvar,
}: {
  perfilAtivo: PerfilMetrica;
  onFechar: () => void;
  onSalvar: (dados: MetricasInstagram) => void;
}) {
  const [texto, setTexto] = useState("");

  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [onFechar]);

  const resultado = useMemo(() => (texto.trim() ? parseMetricas(texto) : null), [texto]);
  const dados = resultado?.ok ? resultado.dados : null;
  const erro = resultado && !resultado.ok ? resultado.erro : null;
  const divergente = !!dados && dados.perfil !== perfilAtivo;

  async function colar() {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setTexto(t);
    } catch {
      // Sem permissao de clipboard: a pessoa cola manualmente (Ctrl+V).
    }
  }

  function salvar() {
    if (dados) {
      onSalvar(dados);
      onFechar();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-marca-preto/50 p-0 animate-fadeIn sm:items-center sm:p-4"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label="Atualizar metricas"
    >
      <div
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-modal sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-marca"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecalho */}
        <div className="flex items-center justify-between gap-3 bg-marca-azulEscuro px-5 py-4 text-white">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-marca bg-marca-laranja">
              <BarChart3 size={16} aria-hidden />
            </span>
            <div>
              <p className="text-xs uppercase tracking-wide text-white/70">Metricas</p>
              <h2 className="text-base font-bold">Atualizar metricas ({rotuloPerfil(perfilAtivo)})</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-marca p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        {/* Conteudo */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
              Cole o JSON gerado pelo Claude
            </span>
            <button
              type="button"
              onClick={colar}
              className="flex items-center gap-1.5 rounded-marca border border-marca-cinza/40 px-2.5 py-1.5 text-xs font-semibold text-marca-azulEscuro transition hover:bg-marca-branco"
            >
              <ClipboardPaste size={14} aria-hidden />
              Colar da area de transferencia
            </button>
          </div>

          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            autoFocus
            placeholder='Cole aqui o JSON completo. Comeca com { "schema_version": "1.0", "perfil": ... }'
            className="min-h-[220px] w-full resize-y rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
          />

          {erro && (
            <p className="mt-3 flex items-start gap-2 rounded-marca border border-marca-vermelho/30 bg-marca-vermelho/5 px-3 py-2 text-sm text-marca-vermelho">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
              {erro}
            </p>
          )}

          {dados && (
            <div className="mt-3 rounded-marca border border-marca-cinza/30 bg-marca-branco p-3 animate-slideUp">
              <p className="text-sm font-semibold text-marca-preto">
                Perfil {rotuloPerfil(dados.perfil)}
                {dados.periodo?.inicio && dados.periodo?.fim
                  ? ` - periodo ${dados.periodo.inicio} a ${dados.periodo.fim}`
                  : ""}
              </p>
              <p className="mt-1 text-xs text-marca-cinza">
                {dados.serie_seguidores?.length ?? 0} pontos de seguidores,{" "}
                {dados.serie_alcance?.length ?? 0} pontos de alcance,{" "}
                {dados.top_posts?.length ?? 0} posts em destaque,{" "}
                {dados.recomendacoes?.length ?? 0} recomendacoes.
              </p>
              {divergente && (
                <p className="mt-2 flex items-start gap-2 text-xs font-semibold text-marca-laranja">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
                  Este JSON e do perfil {rotuloPerfil(dados.perfil)}, diferente do perfil aberto. Ao
                  salvar, vamos abrir o perfil {rotuloPerfil(dados.perfil)}.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Rodape */}
        <div className="flex items-center justify-end gap-3 border-t border-marca-cinza/30 bg-marca-branco px-5 py-3">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-marca px-4 py-2 text-sm font-semibold text-marca-cinza transition hover:text-marca-azulEscuro"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={!dados}
            className="flex items-center gap-1.5 rounded-marca bg-marca-laranja px-4 py-2 text-sm font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {divergente && dados ? `Salvar e abrir ${rotuloPerfil(dados.perfil)}` : "Salvar metricas"}
          </button>
        </div>
      </div>
    </div>
  );
}
