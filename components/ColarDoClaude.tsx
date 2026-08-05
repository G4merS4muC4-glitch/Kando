"use client";

import { useEffect, useMemo, useState } from "react";
import { X, ClipboardPaste, Sparkles, Plus, Copy, Check } from "lucide-react";
import { CANAIS, TIPOS } from "@/lib/config";
import { useBoard } from "@/lib/store";
import { FORMATO_SUGERIDO, PROMPT_SUGERIDO, parseClaude, type ConteudoColado } from "@/lib/parseClaude";
import { criarProjetoVazio, projetoDeRoteiro, contarProgresso } from "@/lib/projeto";
import type { CardConteudo, Etapa } from "@/lib/types";
import { agora, gerarId } from "@/lib/util";

/**
 * Modal para criar conteudo colando texto (tipicamente gerado pelo Claude).
 * Interpreta cabecalhos como Titulo, Tipo, Roteiro e Legenda e mostra uma
 * previa antes de criar um ou varios cards de uma vez.
 */
export default function ColarDoClaude({
  campanhaId,
  onFechar,
  onCriado,
}: {
  campanhaId: string;
  onFechar: () => void;
  onCriado?: (primeiroId: string) => void;
}) {
  const { adicionarCardCompleto, etapas, etapaInicial } = useBoard();
  const [texto, setTexto] = useState("");
  const [etapa, setEtapa] = useState<Etapa>(etapaInicial.id);
  const [mostrarFormato, setMostrarFormato] = useState(true);
  const [copiado, setCopiado] = useState(false);

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

  // Interpreta o texto colado em tempo real.
  const previa = useMemo(() => (texto.trim() ? parseClaude(texto) : []), [texto]);

  async function colarDaAreaTransferencia() {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setTexto(t);
    } catch {
      // Sem permissao de clipboard: o usuario pode colar manualmente (Ctrl+V).
    }
  }

  /** Copia o prompt do formato pronto para colar no Claude. */
  async function copiarFormato() {
    try {
      await navigator.clipboard.writeText(PROMPT_SUGERIDO);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 1800);
    } catch {
      // Sem permissao de clipboard: o usuario pode copiar manualmente do bloco.
    }
  }

  function montarCard(c: ConteudoColado): CardConteudo {
    const ts = agora();
    const tipo = c.tipo ?? "post";
    const ehProjeto = tipo === "projeto";
    // Projeto: transforma o roteiro (FASE... + tarefas) nas fases/tarefas do
    // fluxo. Se der para montar, o roteiro em texto fica vazio (o conteudo vive
    // nas fases); se nao der, mantem o roteiro e cai no projeto padrao.
    const projetoParseado = ehProjeto ? projetoDeRoteiro(c.roteiro) : null;
    return {
      id: gerarId(),
      campanhaId,
      titulo: c.titulo || "Conteúdo colado",
      tipo,
      canais: ehProjeto ? [] : c.canais.length ? c.canais : ["instagram"],
      etapa,
      tema: c.tema,
      dataPublicacao: c.dataPublicacao,
      briefing: c.briefing,
      roteiro: ehProjeto && projetoParseado ? "" : c.roteiro,
      teleprompter: c.teleprompter,
      legenda: c.legenda,
      responsavel: c.responsavel,
      projeto: ehProjeto ? projetoParseado ?? criarProjetoVazio() : undefined,
      criadoEm: ts,
      atualizadoEm: ts,
    };
  }

  function criar() {
    if (previa.length === 0) return;
    const cards = previa.map(montarCard);
    cards.forEach((card) => adicionarCardCompleto(card));
    onFechar();
    if (cards.length === 1 && onCriado) onCriado(cards[0].id);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-marca-preto/50 p-0 animate-fadeIn sm:items-center sm:p-4"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label="Colar conteúdo do Claude"
    >
      <div
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-modal sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-marca"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecalho */}
        <div className="flex items-center justify-between gap-3 bg-marca-azulEscuro px-5 py-4 text-white">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-marca bg-marca-laranja">
              <Sparkles size={16} aria-hidden />
            </span>
            <div>
              <p className="text-xs uppercase tracking-wide text-white/70">Importar</p>
              <h2 className="text-base font-bold">Colar do Claude</h2>
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
              Cole o conteúdo gerado
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={colarDaAreaTransferencia}
                className="flex items-center gap-1.5 rounded-marca border border-marca-cinza/40 px-2.5 py-1.5 text-xs font-semibold text-marca-azulEscuro transition hover:bg-marca-branco"
              >
                <ClipboardPaste size={14} aria-hidden />
                Colar da área de transferência
              </button>
              <button
                type="button"
                onClick={() => setMostrarFormato((v) => !v)}
                className="text-xs font-semibold text-marca-azulClaro underline-offset-2 hover:underline"
              >
                {mostrarFormato ? "Ocultar formato" : "Ver formato sugerido"}
              </button>
            </div>
          </div>

          {mostrarFormato && (
            <div className="mb-3 overflow-hidden rounded-marca border border-marca-cinza/30 bg-marca-branco">
              <div className="flex items-center justify-between gap-2 border-b border-marca-cinza/20 px-3 py-2">
                <span className="text-xs font-bold uppercase tracking-wide text-marca-azulEscuro">
                  Formato para pedir ao Claude
                </span>
                <button
                  type="button"
                  onClick={copiarFormato}
                  className={`flex items-center gap-1.5 rounded-marca px-2.5 py-1.5 text-xs font-bold transition ${
                    copiado
                      ? "bg-marca-verde text-white"
                      : "bg-marca-laranja text-white hover:brightness-95"
                  }`}
                >
                  {copiado ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                  {copiado ? "Copiado!" : "Copiar formato"}
                </button>
              </div>
              <pre className="whitespace-pre-wrap break-words p-3 text-xs leading-relaxed text-marca-preto">
                {FORMATO_SUGERIDO}
              </pre>
            </div>
          )}

          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            autoFocus
            placeholder="Cole aqui o texto do conteúdo. Dica: peça ao Claude para usar Título, Tipo, Canais, Tema, Data, Briefing, Roteiro e Legenda. Separe vários conteúdos com uma linha de traços (---)."
            className="min-h-[200px] w-full resize-y rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 text-sm leading-relaxed text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
          />

          {/* Previa do que sera criado */}
          {previa.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
                Prévia ({previa.length} {previa.length === 1 ? "conteúdo" : "conteúdos"})
              </p>
              <div className="space-y-2">
                {previa.map((c, i) => (
                  <div
                    key={i}
                    className="rounded-marca border border-marca-cinza/30 bg-marca-branco p-3 animate-slideUp"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded-marca px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white"
                        style={{ backgroundColor: TIPOS[c.tipo ?? "post"].cor }}
                      >
                        {TIPOS[c.tipo ?? "post"].label}
                      </span>
                      <span className="text-sm font-semibold text-marca-preto">{c.titulo}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-marca-cinza">
                      {(c.tipo ?? "post") === "projeto" ? (
                        (() => {
                          const proj = projetoDeRoteiro(c.roteiro);
                          const p = contarProgresso(proj ?? undefined);
                          return p.total > 0 ? (
                            <span className="font-semibold text-marca-azulEscuro">
                              {p.fases} {p.fases === 1 ? "fase" : "fases"} · {p.total}{" "}
                              {p.total === 1 ? "tarefa" : "tarefas"}
                            </span>
                          ) : (
                            <span>projeto sem fases detectadas</span>
                          );
                        })()
                      ) : (
                        <>
                          <span>
                            Canais:{" "}
                            {(c.canais.length ? c.canais : (["instagram"] as const))
                              .map((ca) => CANAIS[ca].label)
                              .join(", ")}
                          </span>
                          {c.tema && <span>Tema: {c.tema}</span>}
                          {c.dataPublicacao && <span>Data: {c.dataPublicacao}</span>}
                          <span>{c.roteiro ? "com roteiro" : "sem roteiro"}</span>
                          <span>{c.legenda ? "com legenda" : "sem legenda"}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Rodape */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-marca-cinza/30 bg-marca-branco px-5 py-3">
          <label className="flex items-center gap-2 text-sm text-marca-preto">
            <span className="font-semibold text-marca-azulEscuro">Criar em:</span>
            <select
              value={etapa}
              onChange={(e) => setEtapa(e.target.value as Etapa)}
              className="rounded-marca border border-marca-cinza/40 bg-white px-2.5 py-2 text-sm text-marca-preto outline-none focus:ring-2 focus:ring-marca-laranja"
            >
              {etapas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titulo}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onFechar}
              className="rounded-marca px-4 py-2 text-sm font-semibold text-marca-cinza transition hover:text-marca-azulEscuro"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={criar}
              disabled={previa.length === 0}
              className="flex items-center gap-1.5 rounded-marca bg-marca-laranja px-4 py-2 text-sm font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus size={16} aria-hidden />
              {previa.length > 1 ? `Criar ${previa.length} cards` : "Criar card"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
