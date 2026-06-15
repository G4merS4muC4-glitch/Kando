"use client";

import { useEffect, useState } from "react";
import { X, Lightbulb, Plus, Copy, Check, ExternalLink, Ban, Link2 } from "lucide-react";
import { useOrg } from "@/lib/orgProvider";
import {
  criarLinkSugestao,
  listarLinksSugestao,
  revogarLinkSugestao,
  supabaseConfigurado,
  type LinkSugestao,
} from "@/lib/sugestoesClient";
import type { Campanha } from "@/lib/types";

/**
 * Gera e gerencia os links de sugestao de uma campanha. Quem abrir o link (com
 * ou sem login) manda uma ideia, que cai como card de "sugestao externa" na
 * coluna inicial desta campanha. Cada link pode ser revogado.
 */
export default function ModalSugestoes({
  campanha,
  onFechar,
}: {
  campanha: Campanha;
  onFechar: () => void;
}) {
  const { orgId } = useOrg();
  const disponivel = supabaseConfigurado();
  const [lista, setLista] = useState<LinkSugestao[]>([]);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

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

  useEffect(() => {
    if (!disponivel) return;
    listarLinksSugestao(campanha.id)
      .then(setLista)
      .catch(() =>
        setErro(
          "Não foi possível carregar os links. Rode o supabase/sugestoes.sql no Supabase."
        )
      );
  }, [campanha.id, disponivel]);

  const origem = typeof window !== "undefined" ? window.location.origin : "";
  const linkDe = (token: string) => `${origem}/sugerir/${token}`;

  async function copiar(token: string) {
    try {
      await navigator.clipboard.writeText(linkDe(token));
      setCopiado(token);
      window.setTimeout(() => setCopiado(null), 1800);
    } catch {
      // sem permissao de clipboard
    }
  }

  async function gerar() {
    setErro(null);
    if (!orgId) {
      setErro("Organização não identificada. Recarregue a página.");
      return;
    }
    setGerando(true);
    try {
      const novo = await criarLinkSugestao(orgId, campanha.id);
      setLista((l) => [novo, ...l]);
      void copiar(novo.token);
    } catch {
      setErro("Não foi possível gerar o link. Confira se o supabase/sugestoes.sql já foi rodado.");
    } finally {
      setGerando(false);
    }
  }

  async function revogar(token: string) {
    try {
      await revogarLinkSugestao(token);
      setLista((l) => l.map((x) => (x.token === token ? { ...x, revogado: true } : x)));
    } catch {
      // ignora
    }
  }

  const ativos = lista.filter((l) => !l.revogado);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-stretch justify-center bg-marca-preto/50 p-0 animate-fadeIn sm:items-center sm:p-4"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label="Links de sugestao"
    >
      <div
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-modal sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-marca"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 bg-marca-azulEscuro px-5 py-4 text-white">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Lightbulb size={18} aria-hidden /> Link de sugestões
          </h2>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-marca p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
          <p className="text-sm text-marca-cinza">
            Compartilhe um link para colegas (com ou sem login) mandarem ideias de vídeo, com o link
            da referência. Elas caem na coluna inicial de <strong>{campanha.nome}</strong>, marcadas
            como sugestão de fora.
          </p>

          {!disponivel ? (
            <p className="rounded-marca border border-dashed border-marca-cinza/40 px-4 py-6 text-center text-sm text-marca-cinza">
              Os links de sugestão só funcionam com o login configurado (Supabase).
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={gerar}
                disabled={gerando}
                className="flex items-center gap-1.5 rounded-marca bg-marca-laranja px-4 py-2 text-sm font-bold text-white transition hover:brightness-95 disabled:opacity-60"
              >
                <Plus size={16} aria-hidden /> Gerar link de sugestões
              </button>

              {erro && (
                <p
                  className="rounded-marca px-3 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: "#EC1313" }}
                >
                  {erro}
                </p>
              )}

              {ativos.length === 0 ? (
                <p className="rounded-marca bg-marca-branco px-3 py-5 text-center text-sm text-marca-cinza/80">
                  Nenhum link ativo. Gere um para começar a receber sugestões.
                </p>
              ) : (
                <div className="space-y-2">
                  {ativos.map((l) => (
                    <div
                      key={l.token}
                      className="rounded-marca border border-marca-cinza/30 bg-white p-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <Link2 size={15} className="shrink-0 text-marca-cinza" aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-xs text-marca-azulClaro">
                          {linkDe(l.token)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => copiar(l.token)}
                          className="flex items-center gap-1.5 rounded-marca border border-marca-cinza/40 px-2.5 py-1.5 text-xs font-semibold text-marca-azulEscuro transition hover:bg-marca-branco"
                        >
                          {copiado === l.token ? (
                            <>
                              <Check size={14} aria-hidden /> Copiado
                            </>
                          ) : (
                            <>
                              <Copy size={14} aria-hidden /> Copiar link
                            </>
                          )}
                        </button>
                        <a
                          href={linkDe(l.token)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 rounded-marca border border-marca-cinza/40 px-2.5 py-1.5 text-xs font-semibold text-marca-azulEscuro transition hover:bg-marca-branco"
                        >
                          <ExternalLink size={14} aria-hidden /> Abrir
                        </a>
                        <button
                          type="button"
                          onClick={() => revogar(l.token)}
                          className="flex items-center gap-1.5 rounded-marca px-2.5 py-1.5 text-xs font-semibold text-marca-vermelho transition hover:bg-marca-vermelho/10"
                        >
                          <Ban size={14} aria-hidden /> Revogar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end border-t border-marca-cinza/30 bg-marca-branco px-5 py-3">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-marca bg-marca-laranja px-4 py-2 text-sm font-bold text-white transition hover:brightness-95"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}
