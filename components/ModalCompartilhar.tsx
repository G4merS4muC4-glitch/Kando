"use client";

import { useEffect, useState } from "react";
import {
  X,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Lock,
  AlertTriangle,
  Link2,
  Ban,
} from "lucide-react";
import { BLOCOS, VISIBILIDADE_PADRAO, estaExpirado, type Compartilhamento, type VisibilidadeShare } from "@/lib/share";
import {
  criarCompartilhamento,
  listarCompartilhamentosDoCard,
  revogarCompartilhamento,
  supabaseConfigurado,
} from "@/lib/shareClient";
import type { CardConteudo } from "@/lib/types";

const inputClasse =
  "w-full rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 text-sm text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40";

/** Cria e gerencia os links publicos de um card (visibilidade, PIN, validade). */
export default function ModalCompartilhar({
  card,
  onFechar,
}: {
  card: CardConteudo;
  onFechar: () => void;
}) {
  const disponivel = supabaseConfigurado();
  const [lista, setLista] = useState<Compartilhamento[]>([]);
  const [visibilidade, setVisibilidade] = useState<VisibilidadeShare>({ ...VISIBILIDADE_PADRAO });
  const [edicaoTeleprompter, setEdicao] = useState(false);
  const [usarPin, setUsarPin] = useState(false);
  const [pin, setPin] = useState("");
  const [expiraData, setExpiraData] = useState("");
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
    listarCompartilhamentosDoCard(card.id)
      .then(setLista)
      .catch(() =>
        setErro(
          "Nao foi possivel carregar os links. Rode o supabase/share.sql no Supabase (cria a tabela de compartilhamentos)."
        )
      );
  }, [card.id, disponivel]);

  const origem = typeof window !== "undefined" ? window.location.origin : "";
  const linkDe = (token: string) => `${origem}/c/${token}`;

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
    const algumBloco = Object.values(visibilidade).some(Boolean);
    if (!algumBloco) {
      setErro("Escolha pelo menos um bloco para mostrar.");
      return;
    }
    if (edicaoTeleprompter && !visibilidade.teleprompter) {
      setErro("Para liberar a edicao, o bloco Teleprompter precisa estar visivel.");
      return;
    }
    if (usarPin && pin.trim().length < 4) {
      setErro("O codigo (PIN) precisa de pelo menos 4 caracteres.");
      return;
    }
    setGerando(true);
    try {
      const expiraEm = expiraData ? new Date(`${expiraData}T23:59:59`).toISOString() : undefined;
      const novo = await criarCompartilhamento({
        cardId: card.id,
        campanhaId: card.campanhaId,
        visibilidade,
        edicaoTeleprompter,
        pin: usarPin ? pin.trim() : undefined,
        expiraEm,
      });
      setLista((l) => [novo, ...l]);
      setPin("");
      void copiar(novo.token);
    } catch {
      setErro(
        "Nao foi possivel gerar o link. Confira se o supabase/share.sql ja foi rodado no Supabase, e tente de novo."
      );
    } finally {
      setGerando(false);
    }
  }

  async function revogar(token: string) {
    try {
      await revogarCompartilhamento(token);
      setLista((l) => l.map((s) => (s.token === token ? { ...s, revogado: true } : s)));
    } catch {
      setErro("Nao foi possivel revogar o link.");
    }
  }

  const ativos = lista.filter((s) => !s.revogado && !estaExpirado(s.expira_em));

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-marca-preto/50 p-0 animate-fadeIn sm:items-center sm:p-4"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label="Compartilhar card"
    >
      <div
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-modal sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-marca"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecalho */}
        <div className="flex items-center justify-between gap-3 bg-marca-azulEscuro px-5 py-4 text-white">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-marca bg-marca-laranja">
              <Share2 size={16} aria-hidden />
            </span>
            <div>
              <p className="text-xs uppercase tracking-wide text-white/70">Compartilhar</p>
              <h2 className="max-w-[60vw] truncate text-base font-bold sm:max-w-sm">
                {card.titulo || "Sem titulo"}
              </h2>
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

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
          {!disponivel ? (
            <p className="flex items-start gap-2 rounded-marca border border-marca-cinza/30 bg-marca-branco p-3 text-sm text-marca-cinza">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
              O compartilhamento por link funciona apenas no site publicado (com login). No modo
              local nao ha como gerar um link publico.
            </p>
          ) : (
            <>
              {/* Visibilidade por bloco */}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-marca-azulEscuro">
                  O que o visitante ve
                </p>
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {BLOCOS.map((b) => (
                    <label
                      key={b.chave}
                      className="flex items-center gap-2 rounded-marca border border-marca-cinza/30 bg-white px-3 py-2 text-sm text-marca-preto"
                    >
                      <input
                        type="checkbox"
                        checked={visibilidade[b.chave]}
                        onChange={(e) =>
                          setVisibilidade((v) => ({ ...v, [b.chave]: e.target.checked }))
                        }
                        className="h-4 w-4 accent-marca-laranja"
                      />
                      {b.rotulo}
                    </label>
                  ))}
                </div>
              </div>

              {/* Edicao do teleprompter */}
              <label className="flex items-start gap-2 rounded-marca border border-marca-cinza/30 bg-marca-branco p-3 text-sm">
                <input
                  type="checkbox"
                  checked={edicaoTeleprompter}
                  onChange={(e) => setEdicao(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-marca-laranja"
                />
                <span>
                  <span className="font-semibold text-marca-azulEscuro">
                    Permitir editar o teleprompter
                  </span>
                  <span className="block text-xs text-marca-cinza">
                    O visitante ajusta so as falas, e a mudanca reflete no card do time.
                  </span>
                </span>
              </label>

              {/* PIN */}
              <div className="rounded-marca border border-marca-cinza/30 bg-white p-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={usarPin}
                    onChange={(e) => setUsarPin(e.target.checked)}
                    className="h-4 w-4 accent-marca-laranja"
                  />
                  <Lock size={14} aria-hidden className="text-marca-cinza" />
                  <span className="font-semibold text-marca-azulEscuro">Exigir codigo (PIN)</span>
                </label>
                {usarPin && (
                  <input
                    type="text"
                    inputMode="numeric"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Ex: 4823"
                    className={`${inputClasse} mt-2`}
                  />
                )}
              </div>

              {/* Validade */}
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-marca-azulEscuro">
                  Validade (opcional)
                </span>
                <input
                  type="date"
                  value={expiraData}
                  onChange={(e) => setExpiraData(e.target.value)}
                  className={inputClasse}
                />
              </label>

              {edicaoTeleprompter && !usarPin && (
                <p className="flex items-start gap-2 rounded-marca border border-marca-laranja/40 bg-marca-laranja/5 p-3 text-xs font-semibold text-marca-laranja">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
                  Sem PIN, qualquer pessoa com o link podera alterar o teleprompter. Para liberar a
                  edicao com seguranca, ligue o codigo (PIN).
                </p>
              )}

              {erro && <p className="text-sm font-semibold text-marca-vermelho">{erro}</p>}

              <button
                type="button"
                onClick={gerar}
                disabled={gerando}
                className="flex w-full items-center justify-center gap-1.5 rounded-marca bg-marca-laranja px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-95 disabled:opacity-50"
              >
                <Link2 size={16} aria-hidden />
                {gerando ? "Gerando..." : "Gerar link"}
              </button>

              {/* Links ativos */}
              {ativos.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-marca-azulEscuro">
                    Links ativos
                  </p>
                  <div className="space-y-2">
                    {ativos.map((s) => (
                      <div
                        key={s.token}
                        className="rounded-marca border border-marca-cinza/30 bg-marca-branco p-3"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            readOnly
                            value={linkDe(s.token)}
                            className="min-w-0 flex-1 truncate rounded-marca border border-marca-cinza/30 bg-white px-2 py-1.5 text-xs text-marca-preto"
                          />
                          <button
                            type="button"
                            onClick={() => copiar(s.token)}
                            title="Copiar link"
                            className="shrink-0 rounded-marca border border-marca-cinza/40 p-2 text-marca-azulEscuro transition hover:bg-white"
                          >
                            {copiado === s.token ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
                          </button>
                          <a
                            href={linkDe(s.token)}
                            target="_blank"
                            rel="noreferrer"
                            title="Abrir link"
                            className="shrink-0 rounded-marca border border-marca-cinza/40 p-2 text-marca-azulEscuro transition hover:bg-white"
                          >
                            <ExternalLink size={15} aria-hidden />
                          </a>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-marca-cinza">
                          <span className="flex flex-wrap items-center gap-2">
                            {s.edicao_teleprompter && (
                              <span className="font-semibold text-marca-laranja">edicao do teleprompter</span>
                            )}
                            {s.pin_hash && (
                              <span className="flex items-center gap-1">
                                <Lock size={11} aria-hidden /> com PIN
                              </span>
                            )}
                            {s.expira_em && <span>expira {new Date(s.expira_em).toLocaleDateString("pt-BR")}</span>}
                          </span>
                          <button
                            type="button"
                            onClick={() => revogar(s.token)}
                            className="flex items-center gap-1 font-semibold text-marca-vermelho transition hover:underline"
                          >
                            <Ban size={12} aria-hidden /> Revogar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end border-t border-marca-cinza/30 bg-marca-branco px-5 py-3">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-marca px-4 py-2 text-sm font-semibold text-marca-cinza transition hover:text-marca-azulEscuro"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
