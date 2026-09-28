"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Hourglass, Trash2, CalendarClock, Timer } from "lucide-react";
import { campanhaArquivada } from "@/lib/config";
import { useBoard } from "@/lib/store";
import { useContagens } from "@/lib/contagensProvider";
import type { Contagem } from "@/lib/types";
import {
  alvoDaquiHoras,
  combinarDataHora,
  formatarRestanteLongo,
  rotuloAlvo,
  separarDataHora,
} from "@/lib/contagens";
import { chaveData } from "@/lib/util";
import SeletorData from "@/components/SeletorData";
import SeletorHora from "@/components/SeletorHora";

type Modo = "dataHora" | "daqui";
type Unidade = "minutos" | "horas" | "dias";

const ATALHOS: { rotulo: string; horas: number }[] = [
  { rotulo: "1 hora", horas: 1 },
  { rotulo: "4 horas", horas: 4 },
  { rotulo: "Amanhã", horas: 24 },
  { rotulo: "3 dias", horas: 72 },
  { rotulo: "1 semana", horas: 168 },
];

const EM_HORAS: Record<Unidade, number> = { minutos: 1 / 60, horas: 1, dias: 24 };

/**
 * Cria ou edita uma contagem regressiva. O prazo pode ser marcado de duas
 * formas: escolhendo data e hora no calendario, ou dizendo "daqui a X" (o modo
 * rapido, para quando o que importa e o tanto de tempo, nao a data exata).
 * A previa embaixo mostra, ao vivo, quanto vai faltar.
 */
export default function ModalContagem({
  contagem,
  cardIdSugerido,
  onFechar,
}: {
  contagem?: Contagem; // ausente = criando uma nova
  cardIdSugerido?: string; // ja vem vinculada a este projeto/conteudo
  onFechar: () => void;
}) {
  const { cards, campanhas, cardPorId, campanhaPorId } = useBoard();
  const { criar, atualizar, excluir } = useContagens();
  const editando = Boolean(contagem);

  const inicial = useMemo(
    () => (contagem ? separarDataHora(contagem.alvo) : { data: "", hora: "" }),
    [contagem]
  );

  const [titulo, setTitulo] = useState(contagem?.titulo ?? "");
  const [cardId, setCardId] = useState(contagem?.cardId ?? cardIdSugerido ?? "");
  const [modo, setModo] = useState<Modo>(editando ? "dataHora" : "daqui");
  const [data, setData] = useState<string | undefined>(inicial.data || undefined);
  const [hora, setHora] = useState<string | undefined>(inicial.hora || undefined);
  const [quanto, setQuanto] = useState("4");
  const [unidade, setUnidade] = useState<Unidade>("horas");
  const [erro, setErro] = useState<string | null>(null);

  // Cards de campanhas ativas, para vincular o prazo a um projeto/conteudo.
  const disponiveis = useMemo(() => {
    const arquivadas = new Set(
      campanhas.filter((c) => campanhaArquivada(c.status)).map((c) => c.id)
    );
    return cards
      .filter((c) => !arquivadas.has(c.campanhaId))
      .sort((a, b) => (a.titulo || "").localeCompare(b.titulo || "", "pt-BR"));
  }, [cards, campanhas]);

  // Previa ao vivo: o relogio anda enquanto o modal esta aberto (no modo "daqui
  // a X" o alvo e relativo ao agora, entao ele acompanha).
  const [agoraMs, setAgoraMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setAgoraMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Alvo em ISO conforme o modo escolhido ("" quando ainda falta preencher).
  const horasDaqui = Number(quanto.replace(",", ".")) * EM_HORAS[unidade];
  const alvo =
    modo === "dataHora"
      ? combinarDataHora(data ?? "", hora ?? "")
      : Number.isFinite(horasDaqui) && horasDaqui > 0
        ? alvoDaquiHoras(horasDaqui, agoraMs)
        : "";
  const restante = alvo ? new Date(alvo).getTime() - agoraMs : 0;

  function aoEscolherCard(id: string) {
    setCardId(id);
    // Titulo em branco: aproveita o nome do card (da para trocar depois).
    if (!titulo.trim() && id) setTitulo(cardPorId(id)?.titulo ?? "");
  }

  function aplicarAtalho(horas: number) {
    setModo("daqui");
    setUnidade(horas % 24 === 0 && horas >= 24 ? "dias" : "horas");
    setQuanto(String(horas % 24 === 0 && horas >= 24 ? horas / 24 : horas));
    setErro(null);
  }

  function salvar() {
    const nome = titulo.trim();
    if (!nome) {
      setErro("Dê um nome ao prazo (ex.: entregar o vídeo institucional).");
      return;
    }
    if (!alvo) {
      setErro(
        modo === "dataHora"
          ? "Escolha a data e a hora do prazo."
          : "Diga quanto tempo falta (um número maior que zero)."
      );
      return;
    }
    // Prazo no passado so faz sentido em algo que ja existia (editando).
    if (!editando && new Date(alvo).getTime() <= agoraMs) {
      setErro("Esse horário já passou. Escolha um prazo no futuro.");
      return;
    }
    if (contagem) atualizar({ ...contagem, titulo: nome, alvo, cardId: cardId || undefined });
    else criar({ titulo: nome, alvo, cardId: cardId || undefined });
    onFechar();
  }

  function apagar() {
    if (!contagem) return;
    excluir(contagem.id);
    onFechar();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-stretch justify-center bg-marca-preto/50 p-0 animate-fadeIn sm:items-center sm:p-4"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label={editando ? "Editar prazo" : "Nova contagem regressiva"}
    >
      <div
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-modal sm:h-auto sm:max-h-[88vh] sm:max-w-lg sm:rounded-marca"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecalho */}
        <div className="flex items-center justify-between gap-3 bg-marca-azulEscuro px-5 py-4 text-white">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Hourglass size={18} aria-hidden />
            {editando ? "Editar prazo" : "Nova contagem regressiva"}
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

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Nome */}
          <div>
            <label
              htmlFor="contagem-titulo"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro"
            >
              O que vence
            </label>
            <input
              id="contagem-titulo"
              type="text"
              value={titulo}
              onChange={(e) => {
                setTitulo(e.target.value);
                setErro(null);
              }}
              autoFocus
              placeholder="Ex: entregar o vídeo institucional"
              className="w-full rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 text-sm text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
            />
          </div>

          {/* Como marcar o prazo */}
          <div>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro">
              Prazo
            </span>
            <div className="mb-3 flex gap-1.5">
              <BotaoModo
                ativo={modo === "daqui"}
                icone={<Timer size={14} aria-hidden />}
                onClick={() => {
                  setModo("daqui");
                  setErro(null);
                }}
              >
                Daqui a
              </BotaoModo>
              <BotaoModo
                ativo={modo === "dataHora"}
                icone={<CalendarClock size={14} aria-hidden />}
                onClick={() => {
                  setModo("dataHora");
                  setErro(null);
                }}
              >
                Dia e hora
              </BotaoModo>
            </div>

            {modo === "daqui" ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={quanto}
                    onChange={(e) => {
                      setQuanto(e.target.value);
                      setErro(null);
                    }}
                    aria-label="Quantidade de tempo"
                    className="w-24 rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 text-sm tabular-nums text-marca-preto outline-none transition focus:border-marca-laranja focus:ring-2 focus:ring-marca-laranja/40"
                  />
                  <select
                    value={unidade}
                    onChange={(e) => setUnidade(e.target.value as Unidade)}
                    aria-label="Unidade de tempo"
                    className="flex-1 rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 text-sm text-marca-preto outline-none transition focus:border-marca-laranja"
                  >
                    <option value="minutos">minutos</option>
                    <option value="horas">horas</option>
                    <option value="dias">dias</option>
                  </select>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ATALHOS.map((a) => (
                    <button
                      key={a.rotulo}
                      type="button"
                      onClick={() => aplicarAtalho(a.horas)}
                      className="rounded-marca border border-marca-cinza/40 bg-white px-2.5 py-1 text-xs font-semibold text-marca-cinza transition hover:border-marca-laranja hover:text-marca-azulEscuro"
                    >
                      {a.rotulo}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <SeletorData
                  value={data}
                  onChange={(v) => {
                    setData(v);
                    setErro(null);
                    // Data sem hora escolhida: assume fim do dia comercial.
                    if (v && !hora) setHora("18:00");
                  }}
                  placeholder="Dia do prazo"
                />
                <SeletorHora
                  value={hora}
                  onChange={(v) => {
                    setHora(v);
                    setErro(null);
                    // Hora sem dia escolhido: assume hoje.
                    if (v && !data) setData(chaveData(new Date()));
                  }}
                  placeholder="Hora do prazo"
                />
              </div>
            )}
          </div>

          {/* Previa: o que vai aparecer na contagem */}
          <div className="rounded-marca border border-marca-cinza/30 bg-marca-branco px-3 py-2.5">
            {alvo ? (
              <>
                <p className="text-sm font-bold text-marca-azulEscuro">
                  {restante >= 0
                    ? `Faltam ${formatarRestanteLongo(restante)}`
                    : `Passou ${formatarRestanteLongo(restante)} do prazo`}
                </p>
                <p className="mt-0.5 text-xs text-marca-cinza">
                  Vence {rotuloAlvo(alvo, agoraMs)}
                </p>
              </>
            ) : (
              <p className="text-xs text-marca-cinza">
                Escolha o prazo para ver quanto tempo falta.
              </p>
            )}
          </div>

          {/* Vinculo opcional com um projeto/conteudo */}
          <div>
            <label
              htmlFor="contagem-card"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-marca-azulEscuro"
            >
              Projeto (opcional)
            </label>
            <select
              id="contagem-card"
              value={cardId}
              onChange={(e) => aoEscolherCard(e.target.value)}
              className="w-full rounded-marca border border-marca-cinza/40 bg-white px-3 py-2 text-sm text-marca-preto outline-none transition focus:border-marca-laranja"
            >
              <option value="">Sem projeto (prazo solto)</option>
              {disponiveis.map((c) => {
                const camp = campanhaPorId(c.campanhaId);
                return (
                  <option key={c.id} value={c.id}>
                    {c.titulo || "Sem título"}
                    {camp ? ` · ${camp.nome}` : ""}
                  </option>
                );
              })}
            </select>
          </div>

          {erro && (
            <p className="rounded-marca border border-marca-vermelho/40 bg-marca-vermelho/5 px-3 py-2 text-sm font-semibold text-marca-vermelho">
              {erro}
            </p>
          )}
        </div>

        {/* Rodape */}
        <div className="flex items-center justify-between gap-3 border-t border-marca-cinza/30 bg-marca-branco px-5 py-3">
          {editando ? (
            <button
              type="button"
              onClick={apagar}
              className="flex items-center gap-1.5 rounded-marca px-2 py-2 text-sm font-semibold text-marca-cinza transition hover:text-marca-vermelho"
            >
              <Trash2 size={15} aria-hidden /> Excluir
            </button>
          ) : (
            <span />
          )}
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
              onClick={salvar}
              className="flex items-center gap-1.5 rounded-marca bg-marca-laranja px-4 py-2 text-sm font-bold text-white transition hover:brightness-95"
            >
              <Hourglass size={15} aria-hidden /> {editando ? "Salvar" : "Começar a contar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BotaoModo({
  ativo,
  icone,
  onClick,
  children,
}: {
  ativo: boolean;
  icone: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`flex items-center gap-1.5 rounded-marca border px-3 py-1.5 text-sm font-semibold transition ${
        ativo
          ? "border-transparent bg-marca-azulEscuro text-white"
          : "border-marca-cinza/40 bg-white text-marca-cinza hover:text-marca-azulEscuro"
      }`}
    >
      {icone}
      {children}
    </button>
  );
}
