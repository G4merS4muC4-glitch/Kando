"use client";

import { useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";
import { gerarPromptAtualizacao, type PerfilMetrica } from "@/lib/metricas";

/**
 * Bloco com o prompt pronto para a pessoa copiar e colar num Claude. O prompt e
 * montado com o perfil, handle e periodo da selecao atual.
 */
export default function BlocoPromptAtualizacao({
  perfil,
  handle,
  periodoLabel,
}: {
  perfil: PerfilMetrica;
  handle: string;
  periodoLabel: string;
}) {
  const prompt = useMemo(
    () => gerarPromptAtualizacao(perfil, handle, periodoLabel),
    [perfil, handle, periodoLabel]
  );
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1800);
    } catch {
      // Sem permissao de clipboard: a pessoa pode selecionar e copiar manualmente.
    }
  }

  return (
    <div className="overflow-hidden rounded-marca border border-marca-cinza/30 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-marca-cinza/20 bg-marca-branco px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
          Prompt de atualização
        </span>
        <button
          type="button"
          onClick={copiar}
          className="flex items-center gap-1.5 rounded-marca border border-marca-cinza/40 bg-white px-3 py-1.5 text-xs font-semibold text-marca-azulEscuro transition hover:bg-marca-branco"
        >
          {copiado ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
          {copiado ? "Copiado" : "Copiar prompt"}
        </button>
      </div>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap px-4 py-3 text-xs leading-relaxed text-marca-preto">
        {prompt}
      </pre>
    </div>
  );
}
