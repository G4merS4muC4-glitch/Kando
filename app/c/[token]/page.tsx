"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Lock, MonitorPlay, Check, Loader2, AlertTriangle, Calendar, User } from "lucide-react";
import { CANAIS, MARCAS } from "@/lib/config";
import { formatarData } from "@/lib/util";
import { faseProgresso } from "@/lib/projeto";
import type { CardPublico } from "@/lib/share";
import type { Marca } from "@/lib/types";
import BadgeTipo from "@/components/BadgeTipo";
import Teleprompter from "@/components/Teleprompter";

type Estado =
  | "carregando"
  | "ok"
  | "pin"
  | "inexistente"
  | "revogado"
  | "expirado"
  | "indisponivel"
  | "erro";

type Salvamento = "idle" | "salvando" | "salvo" | "erro";

/** Painel publico do visitante (sem login). Mostra um ou varios cards (com
 *  seletor) e, se permitido, deixa editar o teleprompter de cada um. */
export default function PaginaVisitante() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";

  const [estado, setEstado] = useState<Estado>("carregando");
  const [cards, setCards] = useState<CardPublico[]>([]);
  const [selecionadoId, setSelecionadoId] = useState<string>("");
  const [edicao, setEdicao] = useState(false);
  const [marca, setMarca] = useState<Marca>("brusoft");
  const [pin, setPin] = useState("");
  const [pinErro, setPinErro] = useState<string | null>(null);
  const [tpPorCard, setTpPorCard] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState<Salvamento>("idle");
  const [tpAberto, setTpAberto] = useState(false);
  const timerSalvar = useRef<ReturnType<typeof setTimeout> | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/share/${token}`, { cache: "no-store" });
      const j = await res.json();
      setEstado(j.estado as Estado);
      if (j.estado === "ok") {
        const lista = (j.cards as CardPublico[]) ?? [];
        setCards(lista);
        setSelecionadoId(lista[0]?.id ?? "");
        setEdicao(Boolean(j.edicaoTeleprompter));
        setMarca((j.marca as Marca) ?? "brusoft");
        const mapa: Record<string, string> = {};
        for (const c of lista) if (typeof c.teleprompter === "string") mapa[c.id] = c.teleprompter;
        setTpPorCard(mapa);
      }
    } catch {
      setEstado("erro");
    }
  }, [token]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  // Ao trocar de card, zera o aviso de salvamento.
  useEffect(() => {
    setSalvando("idle");
  }, [selecionadoId]);

  async function enviarPin(e: React.FormEvent) {
    e.preventDefault();
    setPinErro(null);
    try {
      const res = await fetch(`/api/share/${token}/pin`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const j = await res.json();
      if (j.ok) {
        setPin("");
        setEstado("carregando");
        await carregar();
      } else {
        setPinErro(j.erro ?? "Codigo incorreto.");
      }
    } catch {
      setPinErro("Nao foi possivel validar agora. Tente de novo.");
    }
  }

  function onMudarTp(v: string) {
    const cardId = selecionadoId;
    setTpPorCard((m) => ({ ...m, [cardId]: v }));
    if (!edicao) return;
    setSalvando("salvando");
    if (timerSalvar.current) clearTimeout(timerSalvar.current);
    timerSalvar.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/share/${token}/teleprompter`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cardId, texto: v }),
        });
        const j = await res.json();
        if (j.ok) setSalvando("salvo");
        else {
          setSalvando("erro");
          if (j.erro === "pin") setEstado("pin");
        }
      } catch {
        setSalvando("erro");
      }
    }, 800);
  }

  const cor = MARCAS[marca]?.cor ?? "#FA611E";

  if (estado === "carregando") {
    return (
      <Centro>
        <Loader2 size={28} className="animate-spin text-marca-cinza" aria-hidden />
        <p className="text-sm text-marca-cinza">Carregando...</p>
      </Centro>
    );
  }
  if (estado === "pin") {
    return (
      <Centro>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-marca-branco text-marca-cinza">
          <Lock size={22} aria-hidden />
        </span>
        <h1 className="text-lg font-bold text-marca-azulEscuro">Conteudo protegido</h1>
        <p className="max-w-xs text-sm text-marca-cinza">Digite o codigo para abrir este conteudo.</p>
        <form onSubmit={enviarPin} className="flex w-full max-w-xs flex-col gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            autoFocus
            placeholder="Codigo"
            className="w-full rounded-marca border border-marca-cinza/40 bg-white px-3 py-2.5 text-center text-lg tracking-widest text-marca-preto outline-none focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
          />
          {pinErro && <p className="text-sm font-semibold text-marca-vermelho">{pinErro}</p>}
          <button
            type="submit"
            className="rounded-marca bg-marca-laranja px-4 py-2.5 text-sm font-bold text-white transition hover:brightness-95"
          >
            Abrir
          </button>
        </form>
      </Centro>
    );
  }
  if (estado !== "ok" || cards.length === 0) {
    const msg =
      estado === "inexistente"
        ? "Link nao encontrado."
        : estado === "revogado"
          ? "Este link foi revogado."
          : estado === "expirado"
            ? "Este link expirou."
            : estado === "indisponivel"
              ? "Link indisponivel no momento."
              : "Algo deu errado. Tente recarregar a pagina.";
    return (
      <Centro>
        <AlertTriangle size={28} className="text-marca-cinza" aria-hidden />
        <p className="max-w-xs text-sm text-marca-cinza">{msg}</p>
      </Centro>
    );
  }

  const card = cards.find((c) => c.id === selecionadoId) ?? cards[0];
  const tpTexto = tpPorCard[card.id] ?? card.teleprompter ?? "";
  const textoTp = tpTexto || card.teleprompter || card.roteiro || "";

  return (
    <div className="min-h-dvh bg-marca-branco">
      <div className="h-1.5 w-full" style={{ backgroundColor: cor }} />
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-marca-cinza">
          <span style={{ color: cor }}>Kando</span>
          <span>por {MARCAS[marca]?.label ?? "Brusoft"}</span>
        </div>

        {/* Seletor de cards quando ha mais de um */}
        {cards.length > 1 && (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {cards.map((c) => {
              const ativo = c.id === card.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelecionadoId(c.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-marca border px-2.5 py-1.5 text-sm font-medium transition ${
                    ativo
                      ? "border-transparent text-white"
                      : "border-marca-cinza/40 bg-white text-marca-cinza hover:text-marca-azulEscuro"
                  }`}
                  style={ativo ? { backgroundColor: cor } : undefined}
                >
                  <BadgeTipo tipo={c.tipo} tamanho="pequeno" />
                  <span className="max-w-[40vw] truncate">{c.titulo || "Sem titulo"}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <BadgeTipo tipo={card.tipo} />
          <h1 className="text-xl font-bold leading-tight text-marca-azulEscuro">
            {card.titulo || "Sem titulo"}
          </h1>
        </div>

        {card.visaoGeral && (
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-marca-cinza">
            {card.visaoGeral.canais.length > 0 && (
              <span className="flex items-center gap-1.5">
                {card.visaoGeral.canais.map((canal) => {
                  const Icone = CANAIS[canal]?.icone;
                  return Icone ? (
                    <Icone key={canal} size={16} style={{ color: CANAIS[canal].cor }} aria-label={CANAIS[canal].label} />
                  ) : null;
                })}
              </span>
            )}
            {card.visaoGeral.dataPublicacao && (
              <span className="flex items-center gap-1">
                <Calendar size={14} aria-hidden /> {formatarData(card.visaoGeral.dataPublicacao)}
              </span>
            )}
            {card.visaoGeral.responsavel && (
              <span className="flex items-center gap-1">
                <User size={14} aria-hidden /> {card.visaoGeral.responsavel}
              </span>
            )}
            {card.visaoGeral.tema && (
              <span className="rounded-marca border border-marca-cinza/40 bg-white px-2 py-0.5 text-xs text-marca-azulClaro">
                {card.visaoGeral.tema}
              </span>
            )}
          </div>
        )}

        {card.briefing !== undefined && <Bloco titulo="Briefing" texto={card.briefing} />}
        {card.roteiro !== undefined && <Bloco titulo="Roteiro" texto={card.roteiro} />}

        {card.teleprompter !== undefined && (
          <section className="mb-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-marca-azulEscuro">
                Teleprompter
              </span>
              <button
                type="button"
                onClick={() => setTpAberto(true)}
                disabled={!textoTp.trim()}
                className="flex items-center gap-1.5 rounded-marca bg-marca-laranja px-3 py-1.5 text-sm font-bold text-white transition hover:brightness-95 disabled:opacity-40"
              >
                <MonitorPlay size={15} aria-hidden /> Teleprompter
              </button>
            </div>
            {edicao ? (
              <>
                <textarea
                  value={tpTexto}
                  onChange={(e) => onMudarTp(e.target.value)}
                  placeholder="Ajuste as falas aqui."
                  className="min-h-[220px] w-full resize-y rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 text-base leading-loose text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
                />
                <div className="mt-1.5 flex items-center justify-between text-xs text-marca-cinza">
                  <span>Os ajustes refletem para o time.</span>
                  <span className="flex items-center gap-1">
                    {salvando === "salvando" && "Salvando..."}
                    {salvando === "salvo" && (
                      <>
                        <Check size={13} aria-hidden className="text-marca-verde" /> Salvo
                      </>
                    )}
                    {salvando === "erro" && <span className="text-marca-vermelho">Erro ao salvar</span>}
                  </span>
                </div>
              </>
            ) : (
              <p className="whitespace-pre-wrap rounded-marca border border-marca-cinza/30 bg-white px-3 py-3 text-base leading-loose text-marca-preto">
                {textoTp.trim() || "Sem texto."}
              </p>
            )}
          </section>
        )}

        {card.legenda !== undefined && <Bloco titulo="Legenda" texto={card.legenda} />}

        {card.projeto && card.projeto.fases.length > 0 && (
          <section className="mb-4">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-marca-azulEscuro">
              Fluxo de producao
            </span>
            <div className="space-y-3">
              {card.projeto.fases.map((fase) => {
                const p = faseProgresso(fase);
                return (
                  <div key={fase.id} className="rounded-marca border border-marca-cinza/30 bg-white p-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-sm font-bold text-marca-azulEscuro">{fase.nome}</span>
                      <span className="text-[11px] text-marca-cinza">{p.feitas}/{p.total}</span>
                    </div>
                    <ul className="space-y-1">
                      {fase.tarefas.map((t) => (
                        <li key={t.id} className="flex items-center gap-2 text-sm">
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-white ${
                              t.feita ? "border-marca-verde bg-marca-verde" : "border-marca-cinza/50"
                            }`}
                          >
                            {t.feita && <Check size={11} strokeWidth={3} aria-hidden />}
                          </span>
                          <span className={t.feita ? "text-marca-cinza line-through" : "text-marca-preto"}>
                            {t.texto || "Tarefa"}
                          </span>
                        </li>
                      ))}
                      {fase.tarefas.length === 0 && (
                        <li className="text-xs text-marca-cinza/70">Sem tarefas.</li>
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <p className="mt-6 text-center text-[11px] text-marca-cinza/70">
          Somente leitura. {edicao ? "O teleprompter pode ser ajustado." : ""}
        </p>
      </div>

      {tpAberto && <Teleprompter texto={textoTp} onFechar={() => setTpAberto(false)} />}
    </div>
  );
}

function Centro({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-marca-branco px-6 text-center">
      {children}
    </div>
  );
}

function Bloco({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <section className="mb-4">
      <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-marca-azulEscuro">
        {titulo}
      </span>
      <p className="whitespace-pre-wrap rounded-marca border border-marca-cinza/30 bg-white px-3 py-3 text-sm leading-relaxed text-marca-preto">
        {texto.trim() || "Sem conteudo."}
      </p>
    </section>
  );
}
