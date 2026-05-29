"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, CheckCircle2, Inbox, Bell, Plus } from "lucide-react";
import { MARCAS, MARCAS_ORDEM, TIPOS } from "@/lib/config";
import { useBoard } from "@/lib/store";
import type { CardConteudo, Marca, MarcaFiltro } from "@/lib/types";
import { DIAS_SEMANA, MESES, agora, chaveData, formatarData, gerarGradeMes, gerarId } from "@/lib/util";
import {
  DATAS_COMEMORATIVAS,
  ocorrenciaMaisProxima,
  textoContagem,
  type DataComemorativa,
} from "@/lib/datasComemorativas";
import ModalCard from "./ModalCard";

/**
 * Calendario geral: mostra todos os conteudos de todas as campanhas pela data
 * de publicacao, com cor por marca. Arraste um conteudo da lista "Sem data"
 * para um dia para agenda-lo (com animacao), ou entre dias para reagendar.
 */
export default function Calendario() {
  const { cards, campanhas, agendarCard, atualizarCard, cardPorId, adicionarCardCompleto } =
    useBoard();

  const hoje = useMemo(() => new Date(), []);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [marcaFiltro, setMarcaFiltro] = useState<MarcaFiltro>("todas");
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  const [diaPulsando, setDiaPulsando] = useState<string | null>(null);
  // So renderiza a grade depois de montar no cliente, evitando divergencia de
  // data entre o servidor (SSR) e o cliente (erro de hidratacao).
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  // Mapa campanhaId -> marca (memoizado), para classificar cards por marca.
  const marcaPorCampanha = useMemo(() => {
    const m = new Map<string, Marca>();
    campanhas.forEach((c) => m.set(c.id, c.marca));
    return m;
  }, [campanhas]);

  const marcaDoCard = (card: CardConteudo): Marca | undefined =>
    marcaPorCampanha.get(card.campanhaId);

  // Aplica o filtro de marca.
  const visiveis = useMemo(
    () =>
      cards.filter((c) => {
        if (marcaFiltro === "todas") return true;
        return marcaPorCampanha.get(c.campanhaId) === marcaFiltro;
      }),
    [cards, marcaFiltro, marcaPorCampanha]
  );

  const porDia = useMemo(() => {
    const mapa = new Map<string, CardConteudo[]>();
    visiveis.forEach((c) => {
      if (!c.dataPublicacao) return;
      const lista = mapa.get(c.dataPublicacao) ?? [];
      lista.push(c);
      mapa.set(c.dataPublicacao, lista);
    });
    return mapa;
  }, [visiveis]);

  const semData = useMemo(() => visiveis.filter((c) => !c.dataPublicacao), [visiveis]);
  const grade = useMemo(() => gerarGradeMes(ano, mes), [ano, mes]);
  const cardArrastado = arrastandoId ? cardPorId(arrastandoId) : null;

  // Datas comemorativas do mes em foco (filtradas pela marca), mapeadas por dia.
  const comemorativasDoMes = useMemo(() => {
    const m = new Map<string, DataComemorativa>();
    DATAS_COMEMORATIVAS.forEach((d) => {
      if (d.mes !== mes + 1) return;
      if (marcaFiltro !== "todas" && !d.sugestoes[marcaFiltro]) return;
      m.set(chaveData(new Date(ano, mes, d.dia)), d);
    });
    return m;
  }, [ano, mes, marcaFiltro]);

  // Proximas datas comemorativas (lembretes), ordenadas pela mais proxima.
  const proximas = useMemo(
    () =>
      DATAS_COMEMORATIVAS.filter((d) => marcaFiltro === "todas" || d.sugestoes[marcaFiltro])
        .map((d) => ({ data: d, ...ocorrenciaMaisProxima(d, hoje) }))
        .sort((a, b) => a.dias - b.dias)
        .slice(0, 8),
    [marcaFiltro, hoje]
  );

  const marcasComCampanha = useMemo(() => new Set(campanhas.map((c) => c.marca)), [campanhas]);

  /** Cria um card a partir da sugestao de uma data, na campanha "geral" da marca. */
  function criarDeData(d: DataComemorativa, marca: Marca, chave: string) {
    const sug = d.sugestoes[marca];
    if (!sug) return;
    const camp =
      campanhas.find((c) => c.marca === marca && c.tipo === "geral") ??
      campanhas.find((c) => c.marca === marca);
    if (!camp) return;
    const ts = agora();
    const novo: CardConteudo = {
      id: gerarId(),
      campanhaId: camp.id,
      titulo: sug.titulo,
      tipo: sug.tipo,
      canais: sug.canais,
      etapa: "ideias",
      // A data comemorativa fica so no calendario; nao vira etiqueta de tema do card.
      tema: "",
      dataPublicacao: chave,
      briefing: sug.briefing,
      roteiro: sug.roteiro ?? "",
      legenda: sug.legenda ?? "",
      criadoEm: ts,
      atualizadoEm: ts,
    };
    adicionarCardCompleto(novo);
    setSelecionadoId(novo.id);
  }

  function irPara(delta: number) {
    let m = mes + delta;
    let a = ano;
    if (m < 0) {
      m = 11;
      a -= 1;
    } else if (m > 11) {
      m = 0;
      a += 1;
    }
    setMes(m);
    setAno(a);
  }

  function hojeNoCalendario() {
    setAno(hoje.getFullYear());
    setMes(hoje.getMonth());
  }

  function aoIniciar(e: DragStartEvent) {
    setArrastandoId(String(e.active.id));
  }

  function aoTerminar(e: DragEndEvent) {
    const { active, over } = e;
    setArrastandoId(null);
    if (!over) return;
    const idCard = String(active.id);
    const destino = String(over.id);

    if (destino === "sem-data") {
      const c = cardPorId(idCard);
      if (c && c.dataPublicacao) atualizarCard({ ...c, dataPublicacao: undefined });
      return;
    }
    // Caso contrario, o destino e a chave de um dia (yyyy-mm-dd).
    const atual = cardPorId(idCard);
    if (atual?.dataPublicacao === destino) return; // ja esta neste dia
    agendarCard(idCard, destino);
    setDiaPulsando(destino);
    window.setTimeout(() => setDiaPulsando(null), 700);
  }

  const cardSelecionado = selecionadoId ? cardPorId(selecionadoId) : null;

  if (!montado) {
    return <div className="p-6 text-sm text-marca-cinza">Carregando calendario...</div>;
  }

  return (
    <div className="h-full overflow-y-auto">
      <DndContext
        sensors={sensores}
        collisionDetection={pointerWithin}
        onDragStart={aoIniciar}
        onDragEnd={aoTerminar}
        onDragCancel={() => setArrastandoId(null)}
      >
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          {/* Cabecalho */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-titulo text-2xl font-bold uppercase tracking-wide text-marca-azulEscuro">
                Calendario
              </h1>
              <p className="text-sm text-marca-cinza">
                Arraste um conteudo sem data para um dia. Datas comemorativas em amarelo,
                com sugestoes na barra lateral.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => irPara(-1)}
                aria-label="Mes anterior"
                className="rounded-marca border border-marca-cinza/40 bg-white p-2 text-marca-azulEscuro transition hover:bg-marca-branco"
              >
                <ChevronLeft size={18} aria-hidden />
              </button>
              <span className="min-w-[160px] text-center text-lg font-bold text-marca-azulEscuro">
                {MESES[mes]} {ano}
              </span>
              <button
                type="button"
                onClick={() => irPara(1)}
                aria-label="Proximo mes"
                className="rounded-marca border border-marca-cinza/40 bg-white p-2 text-marca-azulEscuro transition hover:bg-marca-branco"
              >
                <ChevronRight size={18} aria-hidden />
              </button>
              <button
                type="button"
                onClick={hojeNoCalendario}
                className="rounded-marca bg-marca-azulEscuro px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110"
              >
                Hoje
              </button>
            </div>
          </div>

          {/* Filtro de marca / legenda */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
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

          <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
            {/* Grade do mes */}
            <div key={`${ano}-${mes}`} className="animate-fadeIn">
              {/* Cabecalho dos dias da semana */}
              <div className="mb-1 grid grid-cols-7 gap-1.5">
                {DIAS_SEMANA.map((d) => (
                  <div
                    key={d}
                    className="py-1 text-center text-xs font-semibold uppercase tracking-wide text-marca-cinza"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {grade.map((dia) => (
                  <DiaCelula
                    key={dia.chave}
                    chave={dia.chave}
                    numero={dia.data.getDate()}
                    noMes={dia.noMes}
                    hoje={dia.hoje}
                    pulsando={diaPulsando === dia.chave}
                    cards={porDia.get(dia.chave) ?? []}
                    comemorativa={comemorativasDoMes.get(dia.chave)}
                    marcaDoCard={marcaDoCard}
                    onAbrir={setSelecionadoId}
                  />
                ))}
              </div>
            </div>

            {/* Barra lateral: conteudos sem data + lembretes de datas */}
            <div className="flex flex-col gap-4">
              <ListaSemData cards={semData} marcaDoCard={marcaDoCard} onAbrir={setSelecionadoId} />
              <PainelDatas
                proximas={proximas}
                marcaFiltro={marcaFiltro}
                marcasComCampanha={marcasComCampanha}
                onCriar={criarDeData}
              />
            </div>
          </div>

        </div>

        {/* Previa enquanto arrasta */}
        <DragOverlay>
          {cardArrastado ? (
            <ChipPreview titulo={cardArrastado.titulo} corTipo={TIPOS[cardArrastado.tipo].cor} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {cardSelecionado && (
        <ModalCard
          key={cardSelecionado.id}
          card={cardSelecionado}
          onFechar={() => setSelecionadoId(null)}
        />
      )}
    </div>
  );
}

/** Celula de um dia (area de drop). */
function DiaCelula({
  chave,
  numero,
  noMes,
  hoje,
  pulsando,
  cards,
  comemorativa,
  marcaDoCard,
  onAbrir,
}: {
  chave: string;
  numero: number;
  noMes: boolean;
  hoje: boolean;
  pulsando: boolean;
  cards: CardConteudo[];
  comemorativa?: DataComemorativa;
  marcaDoCard: (c: CardConteudo) => Marca | undefined;
  onAbrir: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: chave });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[104px] flex-col rounded-marca border p-1.5 transition-colors ${
        noMes ? "bg-white" : "bg-marca-branco/60"
      } ${
        isOver
          ? "border-marca-laranja ring-2 ring-marca-laranja/60"
          : "border-marca-cinza/25"
      } ${pulsando ? "animate-dropPulse" : ""}`}
    >
      <span
        className={`mb-1 inline-flex h-6 w-6 items-center justify-center self-end rounded-full text-xs font-semibold ${
          hoje
            ? "bg-marca-laranja text-white"
            : noMes
              ? "text-marca-preto"
              : "text-marca-cinza"
        }`}
      >
        {numero}
      </span>

      {/* Marcacao de data comemorativa (lembrete) */}
      {comemorativa && (
        <div
          className="mb-1 flex items-center gap-1 truncate rounded-marca px-1.5 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}
          title={comemorativa.nome}
        >
          <span aria-hidden>{comemorativa.emoji}</span>
          <span className="truncate">{comemorativa.nome}</span>
        </div>
      )}

      <div className="flex flex-col gap-1 overflow-hidden">
        {cards.map((c) => (
          <ChipCard key={c.id} card={c} marca={marcaDoCard(c)} onAbrir={onAbrir} />
        ))}
      </div>
    </div>
  );
}

/** Painel lateral de lembretes: proximas datas comemorativas com sugestao. */
function PainelDatas({
  proximas,
  marcaFiltro,
  marcasComCampanha,
  onCriar,
}: {
  proximas: { data: DataComemorativa; chave: string; dias: number }[];
  marcaFiltro: MarcaFiltro;
  marcasComCampanha: Set<Marca>;
  onCriar: (d: DataComemorativa, marca: Marca, chave: string) => void;
}) {
  return (
    <div className="flex flex-col rounded-marca border border-marca-cinza/30 bg-white p-3">
      <div className="mb-1 flex items-center gap-2 text-sm font-bold text-marca-azulEscuro">
        <Bell size={16} aria-hidden />
        Proximas datas
      </div>
      <p className="mb-3 text-xs text-marca-cinza">
        Lembretes com sugestao de conteudo. Clique para criar o card ja agendado.
      </p>
      <div className="flex flex-col gap-2">
        {proximas.map(({ data, chave, dias }) => (
          <div
            key={data.id}
            className="rounded-marca border border-marca-cinza/25 bg-marca-branco p-2"
          >
            <p className="truncate text-xs font-bold text-marca-preto" title={data.nome}>
              <span aria-hidden>{data.emoji}</span> {data.nome}
            </p>
            <p className="mb-1.5 text-[11px] text-marca-cinza">
              {formatarData(chave)} &middot; {textoContagem(dias)}
            </p>
            <div className="flex flex-wrap gap-1">
              {MARCAS_ORDEM.filter(
                (m) => data.sugestoes[m] && (marcaFiltro === "todas" || marcaFiltro === m)
              ).map((m) => {
                const semCampanha = !marcasComCampanha.has(m);
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={semCampanha}
                    onClick={() => onCriar(data, m, chave)}
                    title={
                      semCampanha
                        ? `Crie uma campanha ${MARCAS[m].label} primeiro`
                        : `Criar sugestao para ${MARCAS[m].label}`
                    }
                    className="flex items-center gap-1 rounded-marca px-2 py-1 text-[11px] font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ backgroundColor: MARCAS[m].cor }}
                  >
                    <Plus size={11} aria-hidden />
                    {MARCAS[m].label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Lista lateral de conteudos sem data (area de drop para "desagendar"). */
function ListaSemData({
  cards,
  marcaDoCard,
  onAbrir,
}: {
  cards: CardConteudo[];
  marcaDoCard: (c: CardConteudo) => Marca | undefined;
  onAbrir: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "sem-data" });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-marca border p-3 transition-colors ${
        isOver ? "border-marca-laranja bg-marca-laranja/5 ring-2 ring-marca-laranja/50" : "border-marca-cinza/30 bg-white"
      }`}
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-marca-azulEscuro">
        <Inbox size={16} aria-hidden />
        Sem data ({cards.length})
      </div>
      <p className="mb-3 text-xs text-marca-cinza">
        Arraste para um dia para agendar.
      </p>
      <div className="flex flex-col gap-1.5">
        {cards.length === 0 ? (
          <p className="rounded-marca bg-marca-branco px-2 py-6 text-center text-xs text-marca-cinza/70">
            Tudo agendado por aqui.
          </p>
        ) : (
          cards.map((c) => <ChipCard key={c.id} card={c} marca={marcaDoCard(c)} onAbrir={onAbrir} grande />)
        )}
      </div>
    </div>
  );
}

/** Chip arrastavel que representa um conteudo. */
function ChipCard({
  card,
  marca,
  onAbrir,
  grande = false,
}: {
  card: CardConteudo;
  marca: Marca | undefined;
  onAbrir: (id: string) => void;
  grande?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id });
  const corMarca = marca ? MARCAS[marca].cor : "#8790AB";
  const corTipo = TIPOS[card.tipo].cor;
  const postado = card.etapa === "publicado";

  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      onClick={() => onAbrir(card.id)}
      style={{ borderLeftColor: corMarca, opacity: isDragging ? 0.4 : 1 }}
      className={`animate-pop flex w-full items-center gap-1.5 rounded-marca border border-l-4 border-marca-cinza/25 bg-white px-1.5 py-1 text-left text-[11px] font-medium text-marca-preto shadow-sm transition hover:shadow-cardHover ${
        grande ? "py-1.5 text-xs" : ""
      } ${postado ? "bg-marca-verdeClaro" : ""}`}
      title={card.titulo}
    >
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: corTipo }}
        aria-hidden
      />
      <span className="truncate">{card.titulo}</span>
      {postado && <CheckCircle2 size={12} className="ml-auto shrink-0 text-marca-verde" aria-hidden />}
    </button>
  );
}

function ChipPreview({ titulo, corTipo }: { titulo: string; corTipo: string }) {
  return (
    <div className="flex max-w-[220px] items-center gap-1.5 rounded-marca border border-marca-laranja bg-white px-2 py-1.5 text-xs font-medium text-marca-preto shadow-cardHover">
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: corTipo }}
        aria-hidden
      />
      <span className="truncate">{titulo}</span>
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
        ativo ? "border-transparent text-white" : "border-marca-cinza/40 bg-white text-marca-cinza hover:text-marca-azulEscuro"
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
