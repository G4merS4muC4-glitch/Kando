"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Inbox,
  Bell,
  Plus,
  X,
  LayoutGrid,
  ListChecks,
  CalendarDays,
  Shuffle,
} from "lucide-react";
import { TIPOS } from "@/lib/config";
import { useBoard } from "@/lib/store";
import type { CardConteudo, Marca, MarcaFiltro, MarcaOrg } from "@/lib/types";
import {
  DIAS_SEMANA,
  MESES,
  agora,
  chaveData,
  dataDeISO,
  formatarData,
  gerarGradeMes,
  gerarId,
} from "@/lib/util";
import {
  DATAS_COMEMORATIVAS,
  ocorrenciaMaisProxima,
  textoContagem,
  type DataComemorativa,
} from "@/lib/datasComemorativas";
import ModalCard from "./ModalCard";
import ModalRedistribuir from "./ModalRedistribuir";

const COR_COMEMORATIVA = "#F59E0B"; // amarelo das datas comemorativas
const COR_POSTADO = "#8790AB"; // cinza dos conteudos ja publicados (concluidos)

/** Cor do ponto/etiqueta de um card pela marca da organizacao (cinza se sem marca). */
function corDoCard(marcaPorId: (id: string) => MarcaOrg, marca: Marca | undefined): string {
  return marcaPorId(marca ?? "").cor;
}

/**
 * Calendario geral: mostra todos os conteudos pela data de publicacao, com cor
 * por marca. Grade quadrada que cabe na largura (pontos no mobile, mini etiquetas
 * no desktop), troca de mes deslizando (com swipe no celular) e detalhe do dia
 * em bottom sheet. Arraste um conteudo sem data para um dia para agenda-lo.
 */
export default function Calendario() {
  const {
    cards,
    campanhas,
    marcas,
    marcaPorId,
    etapaInicial,
    etapaPostado,
    agendarCard,
    atualizarCard,
    cardPorId,
    adicionarCardCompleto,
  } = useBoard();

  const hoje = useMemo(() => new Date(), []);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth());
  const [direcao, setDirecao] = useState(1); // +1 proximo mes, -1 anterior (para o deslize)
  const [marcaFiltro, setMarcaFiltro] = useState<MarcaFiltro>("todas");
  const [visao, setVisao] = useState<"mes" | "agenda">("mes");
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [arrastandoId, setArrastandoId] = useState<string | null>(null);
  // Tamanho exato do card arrastado, para o fantasma do arraste nao mudar de tamanho.
  const [tamanhoArrasto, setTamanhoArrasto] = useState<{ w?: number; h?: number }>({});
  const [diaPulsando, setDiaPulsando] = useState<string | null>(null);
  const [diaAberto, setDiaAberto] = useState<string | null>(null);
  const [redistribuirAberto, setRedistribuirAberto] = useState(false);
  // So renderiza a grade depois de montar no cliente (evita divergencia de data).
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const marcaPorCampanha = useMemo(() => {
    const m = new Map<string, Marca>();
    campanhas.forEach((c) => m.set(c.id, c.marca));
    return m;
  }, [campanhas]);

  const marcaDoCard = (card: CardConteudo): Marca | undefined =>
    marcaPorCampanha.get(card.campanhaId);

  const visiveis = useMemo(
    () =>
      cards.filter((c) =>
        marcaFiltro === "todas" ? true : marcaPorCampanha.get(c.campanhaId) === marcaFiltro
      ),
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

  const comemorativasDoMes = useMemo(() => {
    const m = new Map<string, DataComemorativa>();
    DATAS_COMEMORATIVAS.forEach((d) => {
      if (d.mes !== mes + 1) return;
      if (marcaFiltro !== "todas" && !d.sugestoes[marcaFiltro]) return;
      m.set(chaveData(new Date(ano, mes, d.dia)), d);
    });
    return m;
  }, [ano, mes, marcaFiltro]);

  const proximas = useMemo(
    () =>
      DATAS_COMEMORATIVAS.filter((d) => marcaFiltro === "todas" || d.sugestoes[marcaFiltro])
        .map((d) => ({ data: d, ...ocorrenciaMaisProxima(d, hoje) }))
        .sort((a, b) => a.dias - b.dias)
        .slice(0, 8),
    [marcaFiltro, hoje]
  );

  const marcasComCampanha = useMemo(() => new Set(campanhas.map((c) => c.marca)), [campanhas]);

  // Agenda: cards com data, em ordem cronologica, agrupados por dia.
  const agenda = useMemo(() => {
    const grupos = new Map<string, CardConteudo[]>();
    visiveis
      .filter((c) => c.dataPublicacao)
      .sort((a, b) => (a.dataPublicacao! < b.dataPublicacao! ? -1 : 1))
      .forEach((c) => {
        const k = c.dataPublicacao!;
        const lista = grupos.get(k) ?? [];
        lista.push(c);
        grupos.set(k, lista);
      });
    return [...grupos.entries()];
  }, [visiveis]);

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
      etapa: etapaInicial.id,
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
    setDirecao(delta);
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
    setDirecao(hoje.getFullYear() * 12 + hoje.getMonth() >= ano * 12 + mes ? 1 : -1);
    setAno(hoje.getFullYear());
    setMes(hoje.getMonth());
  }

  /** Agenda um card sem data no dia escolhido (a partir do detalhe do dia). */
  function agendarNoDia(idCard: string, chave: string) {
    agendarCard(idCard, chave);
    setDiaPulsando(chave);
    window.setTimeout(() => setDiaPulsando(null), 700);
  }

  // Swipe lateral no celular para trocar de mes (sem atrapalhar o toque/arraste).
  const toque = useRef<{ x: number; y: number } | null>(null);
  function aoToqueInicio(e: React.TouchEvent) {
    const t = e.touches[0];
    toque.current = { x: t.clientX, y: t.clientY };
  }
  function aoToqueFim(e: React.TouchEvent) {
    if (!toque.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - toque.current.x;
    const dy = t.clientY - toque.current.y;
    toque.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      irPara(dx < 0 ? 1 : -1);
    }
  }

  function aoIniciar(e: DragStartEvent) {
    const r = e.active.rect.current.initial;
    setTamanhoArrasto({ w: r?.width, h: r?.height });
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
    const atual = cardPorId(idCard);
    if (atual?.dataPublicacao === destino) return;
    agendarNoDia(idCard, destino);
  }

  const cardSelecionado = selecionadoId ? cardPorId(selecionadoId) : null;
  const cardsDoDiaAberto = diaAberto ? porDia.get(diaAberto) ?? [] : [];

  if (!montado) {
    return <div className="p-6 text-sm text-marca-cinza">Carregando calendário...</div>;
  }

  return (
    // min-w-0 + overflow-x-hidden: garante que o conteudo encolhe e cabe na
    // largura, sem corte nem rolagem lateral em nenhuma tela.
    <div className="h-full min-w-0 overflow-y-auto overflow-x-hidden">
      <DndContext
        sensors={sensores}
        collisionDetection={pointerWithin}
        onDragStart={aoIniciar}
        onDragEnd={aoTerminar}
        onDragCancel={() => setArrastandoId(null)}
      >
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
          {/* Cabecalho: titulo + navegacao de mes + alternador de visao */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-titulo text-2xl font-bold uppercase tracking-wide text-marca-azulEscuro">
                Calendário
              </h1>
              <p className="hidden text-sm text-marca-cinza sm:block">
                Arraste um conteúdo entre os dias para reagendar, ou para a lista &ldquo;Sem data&rdquo; para tirar a data. Toque em um dia para ver e agendar.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Redistribuir automaticamente */}
              <button
                type="button"
                onClick={() => setRedistribuirAberto(true)}
                title="Redistribuir os conteúdos pelos dias automaticamente"
                className="flex items-center gap-1.5 rounded-marca border border-marca-cinza/40 bg-white px-3 py-1.5 text-sm font-semibold text-marca-azulEscuro transition hover:border-marca-laranja hover:text-marca-laranja"
              >
                <Shuffle size={15} aria-hidden />
                <span className="hidden sm:inline">Redistribuir</span>
              </button>
              {/* Alternador Mes / Agenda */}
              <div className="flex rounded-marca border border-marca-cinza/30 bg-white p-0.5">
                <BotaoVisao ativo={visao === "mes"} onClick={() => setVisao("mes")} icone={<LayoutGrid size={15} aria-hidden />}>
                  Mês
                </BotaoVisao>
                <BotaoVisao ativo={visao === "agenda"} onClick={() => setVisao("agenda")} icone={<ListChecks size={15} aria-hidden />}>
                  Agenda
                </BotaoVisao>
              </div>
            </div>
          </div>

          {/* Linha do mes + setas + hoje + filtro de marca */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => irPara(-1)}
                aria-label="Mês anterior"
                className="rounded-marca border border-marca-cinza/40 bg-white p-2 text-marca-azulEscuro transition hover:border-marca-laranja hover:text-marca-laranja"
              >
                <ChevronLeft size={18} aria-hidden />
              </button>
              <span className="min-w-[150px] text-center font-titulo text-lg font-bold uppercase tracking-wide text-marca-azulEscuro">
                {MESES[mes]} {ano}
              </span>
              <button
                type="button"
                onClick={() => irPara(1)}
                aria-label="Próximo mês"
                className="rounded-marca border border-marca-cinza/40 bg-white p-2 text-marca-azulEscuro transition hover:border-marca-laranja hover:text-marca-laranja"
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

            <div className="flex flex-wrap items-center gap-2">
              <FiltroMarca ativo={marcaFiltro === "todas"} onClick={() => setMarcaFiltro("todas")}>
                Todas
              </FiltroMarca>
              {marcas.map((m) => (
                <FiltroMarca
                  key={m.id}
                  ativo={marcaFiltro === m.id}
                  cor={m.cor}
                  onClick={() => setMarcaFiltro(m.id)}
                >
                  {m.nome}
                </FiltroMarca>
              ))}
            </div>
          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-[1fr_300px]">
            <div className="min-w-0">
              {visao === "mes" ? (
                <div onTouchStart={aoToqueInicio} onTouchEnd={aoToqueFim}>
                  {/* Cabecalho dos dias da semana (1 letra no mobile, 3 no desktop) */}
                  <div className="mb-1.5 grid grid-cols-7 gap-1 sm:gap-1.5">
                    {DIAS_SEMANA.map((d) => (
                      <div
                        key={d}
                        className="py-1 text-center text-[11px] font-bold uppercase tracking-wide text-marca-cinza sm:text-xs"
                      >
                        <span className="sm:hidden">{d.charAt(0)}</span>
                        <span className="hidden sm:inline">{d}</span>
                      </div>
                    ))}
                  </div>

                  {/* Grade do mes, deslizando ao trocar (fade quando reduz movimento) */}
                  <div
                    key={`${ano}-${mes}`}
                    className={`grid grid-cols-7 gap-1 sm:gap-1.5 ${
                      direcao >= 0
                        ? "motion-safe:animate-entraDir motion-reduce:animate-fadeIn"
                        : "motion-safe:animate-entraEsq motion-reduce:animate-fadeIn"
                    }`}
                  >
                    {grade.map((dia) => (
                      <DiaCelula
                        key={dia.chave}
                        chave={dia.chave}
                        numero={dia.data.getDate()}
                        noMes={dia.noMes}
                        hoje={dia.hoje}
                        selecionado={diaAberto === dia.chave}
                        pulsando={diaPulsando === dia.chave}
                        cards={porDia.get(dia.chave) ?? []}
                        comemorativa={comemorativasDoMes.get(dia.chave)}
                        marcaDoCard={marcaDoCard}
                        arrastandoId={arrastandoId}
                        onAbrir={() => setDiaAberto(dia.chave)}
                        onAbrirCard={setSelecionadoId}
                      />
                    ))}
                  </div>

                  {/* Legenda compacta (uma cor por marca da organizacao) */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-marca-cinza">
                    {marcas.map((m) => (
                      <span key={m.id} className="flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.cor }} /> {m.nome}
                      </span>
                    ))}
                    <span className="flex items-center gap-1">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COR_COMEMORATIVA }} /> Data comemorativa
                    </span>
                  </div>
                </div>
              ) : (
                <VistaAgenda
                  agenda={agenda}
                  marcaDoCard={marcaDoCard}
                  onAbrir={setSelecionadoId}
                />
              )}
            </div>

            {/* Barra lateral (embaixo no mobile): sem data + proximas datas */}
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

        <DragOverlay>
          {cardArrastado ? (
            <ChipPreview
              titulo={cardArrastado.titulo}
              cor={
                cardArrastado.etapa === etapaPostado.id
                  ? COR_POSTADO
                  : corDoCard(marcaPorId, marcaDoCard(cardArrastado))
              }
              postado={cardArrastado.etapa === etapaPostado.id}
              largura={tamanhoArrasto.w}
              altura={tamanhoArrasto.h}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Detalhe do dia: bottom sheet no mobile, painel centrado no desktop */}
      {diaAberto && (
        <DetalheDia
          chave={diaAberto}
          cards={cardsDoDiaAberto}
          comemorativa={comemorativasDoMes.get(diaAberto)}
          semData={semData}
          marcaDoCard={marcaDoCard}
          marcaFiltro={marcaFiltro}
          marcasComCampanha={marcasComCampanha}
          onAbrirCard={(id) => {
            setSelecionadoId(id);
            setDiaAberto(null);
          }}
          onAgendar={agendarNoDia}
          onCriarDeData={criarDeData}
          onFechar={() => setDiaAberto(null)}
        />
      )}

      {cardSelecionado && (
        <ModalCard
          key={cardSelecionado.id}
          card={cardSelecionado}
          onFechar={() => setSelecionadoId(null)}
        />
      )}

      {redistribuirAberto && <ModalRedistribuir onFechar={() => setRedistribuirAberto(false)} />}
    </div>
  );
}

/**
 * Celula quadrada de um dia: area de drop + abre o detalhe ao tocar. No desktop,
 * os conteudos do dia ficam empilhados como uma "gaveta de arquivos" (2 visiveis
 * e um sinal de que ha mais atras); ao passar o mouse a gaveta abre, mostrando o
 * titulo de cada card para clicar/abrir ou arrastar para outro dia.
 */
function DiaCelula({
  chave,
  numero,
  noMes,
  hoje,
  selecionado,
  pulsando,
  cards,
  comemorativa,
  marcaDoCard,
  arrastandoId,
  onAbrir,
  onAbrirCard,
}: {
  chave: string;
  numero: number;
  noMes: boolean;
  hoje: boolean;
  selecionado: boolean;
  pulsando: boolean;
  cards: CardConteudo[];
  comemorativa?: DataComemorativa;
  marcaDoCard: (c: CardConteudo) => Marca | undefined;
  arrastandoId: string | null;
  onAbrir: () => void;
  onAbrirCard: (id: string) => void;
}) {
  const { marcaPorId, etapaPostado } = useBoard();
  const { setNodeRef, isOver } = useDroppable({ id: chave });
  const [hover, setHover] = useState(false);
  // A gaveta fica aberta ao passar o mouse e continua aberta enquanto um card
  // deste dia esta sendo arrastado (para nao desmontar a origem no meio do arraste).
  const aberto = hover || cards.some((c) => c.id === arrastandoId);

  // Mede a altura da area util da celula (abaixo do numero) para centralizar a
  // pilha aberta, espalhando os cartoes para cima e para baixo.
  const areaRef = useRef<HTMLDivElement>(null);
  const [areaH, setAreaH] = useState(0);
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const medir = () => setAreaH(el.clientHeight);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      onClick={onAbrir}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAbrir();
        }
      }}
      aria-label={`${numero}, ${cards.length} conteúdo(s)`}
      className={`group relative flex aspect-square cursor-pointer flex-col rounded-marca border p-1 text-left outline-none transition will-change-transform focus-visible:ring-2 focus-visible:ring-marca-laranja sm:min-h-[116px] sm:p-1.5 ${
        noMes ? "bg-marca-branco/40" : "bg-white"
      } ${aberto ? "z-20 overflow-visible" : "overflow-hidden"} ${
        isOver
          ? "border-marca-laranja ring-2 ring-marca-laranja/60"
          : selecionado
            ? "border-marca-azulEscuro ring-2 ring-marca-azulEscuro/40"
            : "border-marca-cinza/20 hover:border-marca-laranja/60"
      } ${pulsando ? "animate-dropPulse" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold sm:h-7 sm:w-7 sm:text-sm ${
            hoje
              ? "bg-marca-laranja text-white shadow-dia"
              : noMes
                ? "text-marca-preto"
                : "text-marca-cinza/40"
          }`}
        >
          {numero}
        </span>
        {comemorativa && (
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: COR_COMEMORATIVA }}
            title={comemorativa.nome}
            aria-hidden
          />
        )}
      </div>

      {/* Mobile: pontos coloridos por marca */}
      <div className="mt-auto flex flex-wrap items-center gap-1 sm:hidden">
        {cards.slice(0, 4).map((c) => (
          <span
            key={c.id}
            className="h-1.5 w-1.5 rounded-full animate-pop"
            style={{
              backgroundColor:
                c.etapa === etapaPostado.id ? COR_POSTADO : corDoCard(marcaPorId, marcaDoCard(c)),
            }}
          />
        ))}
        {cards.length > 4 && (
          <span className="text-[9px] font-bold leading-none text-marca-cinza">+{cards.length - 4}</span>
        )}
      </div>

      {/* Desktop: gaveta de cards empilhados (abre ao passar o mouse) */}
      <div ref={areaRef} className="relative mt-1.5 hidden flex-1 sm:block">
        <PilhaDia
          cards={cards}
          aberto={aberto}
          areaH={areaH}
          etapaPostadoId={etapaPostado.id}
          marcaPorId={marcaPorId}
          marcaDoCard={marcaDoCard}
          onAbrirCard={onAbrirCard}
        />
      </div>
    </div>
  );
}

// Pilha (gaveta) do dia. Cartoes quadradinhos, flutuando (posicao absoluta, para
// nao esticar o calendario). Fechada: so o da frente inteiro e a ponta de ate 2
// de tras espiando PARA CIMA. Aberta (hover na celula): a pilha se abre CENTRADA
// no dia, espalhando os cartoes para cima E para baixo (nao empilha tudo embaixo),
// por cima dos vizinhos; o card sob o cursor fica isolado por um espaco e nao muda
// de tamanho. Uma base transparente cobre toda a pilha aberta para o mouse poder
// percorrer os cartoes (e os vaos entre eles) sem "vazar" para o dia de baixo e
// fechar a gaveta.
const PILHA_H = 46; // altura fixa de um cartao (quadradinho); NAO muda nunca
const PILHA_PONTA = 11; // quanto cada card de tras espia (fechado, para cima)
const PILHA_STEP = 22; // passo entre cartoes quando aberto (sobrepostos, so o titulo)
const PILHA_SEP = 34; // empurrao que isola o card sob o cursor (abre espaco em volta)

function PilhaDia({
  cards,
  aberto,
  areaH,
  etapaPostadoId,
  marcaPorId,
  marcaDoCard,
  onAbrirCard,
}: {
  cards: CardConteudo[];
  aberto: boolean;
  areaH: number;
  etapaPostadoId: string;
  marcaPorId: (id: string) => MarcaOrg;
  marcaDoCard: (c: CardConteudo) => Marca | undefined;
  onAbrirCard: (id: string) => void;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  // So zera o foco ao FECHAR (sair da celula). Enquanto aberto, passar por um vao
  // vazio nao reseta nada (a base transparente segura o hover): o foco so muda ao
  // entrar noutro card, evitando piscadas.
  useEffect(() => {
    if (!aberto) setHoverIdx(null);
  }, [aberto]);
  if (cards.length === 0) return null;
  const cor = (c: CardConteudo) => corDoCard(marcaPorId, marcaDoCard(c));
  const n = cards.length;
  const pontas = Math.min(n - 1, 2); // quantos espiam por tras (fechado)

  // Fechado: frente embaixo; os de tras espiam PARA CIMA. Do 4o em diante, somem.
  const topoFechado = (i: number) => {
    if (i === 0 || i > pontas) return pontas * PILHA_PONTA;
    return (pontas - i) * PILHA_PONTA;
  };

  // Aberto: pilha centrada na celula, espalhada para cima E para baixo. O card sob
  // o cursor (hoverIdx) fica parado; os de cima sobem e os de baixo descem PILHA_SEP,
  // abrindo um espaco em volta dele. Ninguem muda de tamanho.
  const centro = (areaH || 88) / 2;
  const baseH = (n - 1) * PILHA_STEP + PILHA_H;
  const topoAberto = (i: number) => {
    let t = centro - baseH / 2 + i * PILHA_STEP;
    if (hoverIdx !== null) {
      if (i < hoverIdx) t -= PILHA_SEP;
      else if (i > hoverIdx) t += PILHA_SEP;
    }
    return t;
  };

  // Extensao vertical real da pilha aberta, para a base transparente cobrir
  // exatamente os cartoes e os vaos entre eles (nem mais, nem menos).
  const toposAbertos = cards.map((_, i) => topoAberto(i));
  const baseTopo = Math.min(...toposAbertos) - 3;
  const baseFundo = Math.max(...toposAbertos) + PILHA_H + 3;

  return (
    <div className="absolute inset-x-0 top-0">
      {/* Base transparente: cobre a pilha aberta (cartoes e os vaos entre eles)
          para o mouse percorre-la sem vazar para o dia vizinho, que fecharia a
          gaveta. Mais larga que o cartao (left/right negativos) para tapar tambem
          as tiras de padding sobre o dia de baixo. So existe quando aberto e nao
          rouba o clique da celula. */}
      {aberto && (
        <div
          aria-hidden
          onClick={(e) => e.stopPropagation()}
          className="absolute"
          style={{ top: baseTopo, height: baseFundo - baseTopo, left: -10, right: -10 }}
        />
      )}
      {cards.map((c, i) => {
        // Ja publicado: card cinza com risco de "concluido" (em vez da cor da marca).
        const postado = c.etapa === etapaPostadoId;
        return (
          <ChipPilha
            key={c.id}
            card={c}
            cor={postado ? COR_POSTADO : cor(c)}
            postado={postado}
            topo={aberto ? topoAberto(i) : topoFechado(i)}
            z={aberto && hoverIdx === i ? 60 : n - i}
            brilho={!aberto && i > 0 ? 1 - Math.min(i, 3) * 0.05 : 1}
            destacado={aberto && hoverIdx === i}
            onEntrar={() => setHoverIdx(i)}
            onAbrir={onAbrirCard}
          />
        );
      })}
    </div>
  );
}

/** Cartao colorido de uma pilha do dia: flutua (absoluto), tamanho fixo. Sob o
 *  mouse ele so vem para a frente e empurra os de baixo (nao muda de tamanho). */
function ChipPilha({
  card,
  cor,
  postado,
  topo,
  z,
  brilho,
  destacado,
  onEntrar,
  onAbrir,
}: {
  card: CardConteudo;
  cor: string;
  postado: boolean;
  topo: number;
  z: number;
  brilho: number;
  destacado: boolean;
  onEntrar: () => void;
  onAbrir: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      // Fora da ordem de tabulacao: sao um atalho de mouse; o teclado usa a
      // celula do dia (Enter abre o detalhe com a lista acessivel de conteudos).
      tabIndex={-1}
      type="button"
      onMouseEnter={onEntrar}
      onClick={(e) => {
        e.stopPropagation();
        onAbrir(card.id);
      }}
      style={{
        height: PILHA_H,
        // Anima por transform (composto na GPU, sem recalculo de layout a cada
        // quadro) em vez de "top": abertura e empurrao ficam bem mais suaves.
        transform: `translateY(${topo}px)`,
        zIndex: z,
        backgroundColor: cor,
        filter: `brightness(${brilho})`,
        opacity: isDragging ? 0.35 : 1,
      }}
      className={`absolute inset-x-0 top-0 block cursor-grab overflow-hidden rounded-marca px-2 py-2 text-left text-[11px] font-semibold leading-tight text-white ring-1 ring-black/5 transition-[transform,filter,box-shadow] duration-[280ms] ease-suave will-change-transform active:cursor-grabbing ${
        destacado ? "shadow-cardHover" : "shadow-md"
      }`}
      title={card.titulo}
    >
      <span className={`line-clamp-2 ${postado ? "line-through decoration-2" : ""}`}>
        {card.titulo}
      </span>
    </button>
  );
}

/** Visao de agenda: lista cronologica dos conteudos agendados, agrupada por dia. */
function VistaAgenda({
  agenda,
  marcaDoCard,
  onAbrir,
}: {
  agenda: [string, CardConteudo[]][];
  marcaDoCard: (c: CardConteudo) => Marca | undefined;
  onAbrir: (id: string) => void;
}) {
  if (agenda.length === 0) {
    return (
      <div className="rounded-marca border border-dashed border-marca-cinza/40 px-4 py-12 text-center text-sm text-marca-cinza">
        Nenhum conteúdo agendado. Arraste um conteúdo sem data para um dia no calendário.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {agenda.map(([chave, lista]) => {
        const d = dataDeISO(chave);
        return (
          <div key={chave} className="animate-fadeIn">
            <div className="mb-1.5 flex items-baseline gap-2">
              <span className="font-titulo text-base font-bold uppercase tracking-wide text-marca-azulEscuro">
                {String(d.getDate()).padStart(2, "0")}
              </span>
              <span className="text-sm font-semibold capitalize text-marca-cinza">
                {DIAS_SEMANA[d.getDay()].toLowerCase()}, {MESES[d.getMonth()].toLowerCase()}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {lista.map((c) => (
                <LinhaConteudo key={c.id} card={c} marca={marcaDoCard(c)} onAbrir={onAbrir} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Linha de um conteudo (usada na agenda e no detalhe do dia). */
function LinhaConteudo({
  card,
  marca,
  onAbrir,
}: {
  card: CardConteudo;
  marca: Marca | undefined;
  onAbrir: (id: string) => void;
}) {
  const { marcaPorId, etapaPostado } = useBoard();
  const Icone = TIPOS[card.tipo].icone;
  const cor = corDoCard(marcaPorId, marca);
  const postado = card.etapa === etapaPostado.id;
  return (
    <button
      type="button"
      onClick={() => onAbrir(card.id)}
      className="flex w-full items-center gap-2.5 rounded-marca border border-marca-cinza/25 bg-white px-2.5 py-2 text-left transition hover:border-marca-laranja/60 hover:shadow-card"
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-marca text-white"
        style={{ backgroundColor: cor }}
      >
        <Icone size={14} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-marca-preto">{card.titulo}</span>
        <span className="block text-[11px] text-marca-cinza">{TIPOS[card.tipo].label}</span>
      </span>
      {postado && <CheckCircle2 size={16} className="shrink-0 text-marca-verde" aria-hidden />}
    </button>
  );
}

/** Detalhe do dia: bottom sheet no mobile, painel centrado no desktop. */
function DetalheDia({
  chave,
  cards,
  comemorativa,
  semData,
  marcaDoCard,
  marcaFiltro,
  marcasComCampanha,
  onAbrirCard,
  onAgendar,
  onCriarDeData,
  onFechar,
}: {
  chave: string;
  cards: CardConteudo[];
  comemorativa?: DataComemorativa;
  semData: CardConteudo[];
  marcaDoCard: (c: CardConteudo) => Marca | undefined;
  marcaFiltro: MarcaFiltro;
  marcasComCampanha: Set<Marca>;
  onAbrirCard: (id: string) => void;
  onAgendar: (idCard: string, chave: string) => void;
  onCriarDeData: (d: DataComemorativa, marca: Marca, chave: string) => void;
  onFechar: () => void;
}) {
  const { marcaPorId, marcas } = useBoard();
  const d = dataDeISO(chave);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-marca-preto/50 animate-fadeIn sm:items-center sm:p-4"
      onClick={onFechar}
      role="dialog"
      aria-modal="true"
      aria-label={`Conteúdos de ${formatarData(chave)}`}
    >
      <div
        className="flex max-h-[82vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-modal animate-subirSheet sm:max-w-md sm:rounded-marca"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-marca-cinza/30 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-marca bg-marca-azulEscuro text-white">
              <CalendarDays size={16} aria-hidden />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-marca-cinza">
                {DIAS_SEMANA[d.getDay()]}
              </p>
              <h2 className="font-titulo text-lg font-bold uppercase tracking-wide text-marca-azulEscuro">
                {formatarData(chave)}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-marca p-2 text-marca-cinza transition hover:bg-marca-branco hover:text-marca-azulEscuro"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {/* Data comemorativa com sugestao */}
          {comemorativa && (
            <div
              className="mb-4 rounded-marca border p-3"
              style={{ borderColor: "#FDE68A", backgroundColor: "#FFFBEB" }}
            >
              <p className="text-sm font-bold" style={{ color: "#92400E" }}>
                <span aria-hidden>{comemorativa.emoji}</span> {comemorativa.nome}
              </p>
              <p className="mb-2 text-xs" style={{ color: "#B45309" }}>
                Criar um conteúdo já agendado para esta data:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {marcas
                  .filter(
                    (m) =>
                      comemorativa.sugestoes[m.id] &&
                      (marcaFiltro === "todas" || marcaFiltro === m.id)
                  )
                  .map((m) => {
                    const semCampanha = !marcasComCampanha.has(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        disabled={semCampanha}
                        onClick={() => onCriarDeData(comemorativa, m.id, chave)}
                        className="flex items-center gap-1 rounded-marca px-2.5 py-1.5 text-xs font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
                        style={{ backgroundColor: m.cor }}
                      >
                        <Plus size={12} aria-hidden /> {m.nome}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Conteudos do dia */}
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-marca-azulEscuro">
            Conteúdos do dia ({cards.length})
          </p>
          {cards.length === 0 ? (
            <p className="rounded-marca bg-marca-branco px-3 py-5 text-center text-sm text-marca-cinza/80">
              Nenhum conteúdo agendado para este dia.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {cards.map((c) => (
                <LinhaConteudo key={c.id} card={c} marca={marcaDoCard(c)} onAbrir={onAbrirCard} />
              ))}
            </div>
          )}

          {/* Agendar um conteudo sem data neste dia */}
          {semData.length > 0 && (
            <div className="mt-5">
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-marca-azulEscuro">
                Agendar aqui
              </p>
              <div className="flex flex-col gap-1.5">
                {semData.slice(0, 12).map((c) => {
                  const Icone = TIPOS[c.tipo].icone;
                  return (
                    <div
                      key={c.id}
                      className="flex items-center gap-2.5 rounded-marca border border-marca-cinza/25 bg-marca-branco px-2.5 py-2"
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-marca text-white"
                        style={{ backgroundColor: corDoCard(marcaPorId, marcaDoCard(c)) }}
                      >
                        <Icone size={14} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-marca-preto">
                        {c.titulo}
                      </span>
                      <button
                        type="button"
                        onClick={() => onAgendar(c.id, chave)}
                        className="flex shrink-0 items-center gap-1 rounded-marca bg-marca-laranja px-2.5 py-1.5 text-xs font-bold text-white transition hover:brightness-95"
                      >
                        <Plus size={12} aria-hidden /> Agendar
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
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
  const { marcas } = useBoard();
  return (
    <div className="flex flex-col rounded-marca border border-marca-cinza/30 bg-white p-3">
      <div className="mb-1 flex items-center gap-2 text-sm font-bold text-marca-azulEscuro">
        <Bell size={16} aria-hidden />
        Próximas datas
      </div>
      <p className="mb-3 text-xs text-marca-cinza">
        Lembretes com sugestão de conteúdo. Clique para criar o card já agendado.
      </p>
      <div className="flex flex-col gap-2">
        {proximas.map(({ data, chave, dias }) => (
          <div key={data.id} className="rounded-marca border border-marca-cinza/25 bg-marca-branco p-2">
            <p className="truncate text-xs font-bold text-marca-preto" title={data.nome}>
              <span aria-hidden>{data.emoji}</span> {data.nome}
            </p>
            <p className="mb-1.5 text-[11px] text-marca-cinza">
              {formatarData(chave)} &middot; {textoContagem(dias)}
            </p>
            <div className="flex flex-wrap gap-1">
              {marcas
                .filter(
                  (m) => data.sugestoes[m.id] && (marcaFiltro === "todas" || marcaFiltro === m.id)
                )
                .map((m) => {
                  const semCampanha = !marcasComCampanha.has(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={semCampanha}
                      onClick={() => onCriar(data, m.id, chave)}
                      title={
                        semCampanha
                          ? `Crie uma campanha ${m.nome} primeiro`
                          : `Criar sugestão para ${m.nome}`
                      }
                      className="flex items-center gap-1 rounded-marca px-2 py-1 text-[11px] font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
                      style={{ backgroundColor: m.cor }}
                    >
                      <Plus size={11} aria-hidden />
                      {m.nome}
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
        isOver
          ? "border-marca-laranja bg-marca-laranja/5 ring-2 ring-marca-laranja/50"
          : "border-marca-cinza/30 bg-white"
      }`}
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-marca-azulEscuro">
        <Inbox size={16} aria-hidden />
        Sem data ({cards.length})
      </div>
      <p className="mb-3 text-xs text-marca-cinza">
        Arraste para um dia, ou toque no dia e use &ldquo;Agendar aqui&rdquo;.
      </p>
      <div className="flex flex-col gap-1.5">
        {cards.length === 0 ? (
          <p className="rounded-marca bg-marca-branco px-2 py-6 text-center text-xs text-marca-cinza/70">
            Tudo agendado por aqui.
          </p>
        ) : (
          cards.map((c) => (
            <ChipCard key={c.id} card={c} marca={marcaDoCard(c)} onAbrir={onAbrir} grande />
          ))
        )}
      </div>
    </div>
  );
}

/** Chip arrastavel que representa um conteudo (lista sem data). */
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
  const { marcaPorId, etapaPostado } = useBoard();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: card.id });
  const TipoIcone = TIPOS[card.tipo].icone;
  const postado = card.etapa === etapaPostado.id;

  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      onClick={() => onAbrir(card.id)}
      style={{ backgroundColor: corDoCard(marcaPorId, marca), opacity: isDragging ? 0.4 : 1 }}
      className={`flex w-full items-center gap-1.5 rounded-marca px-1.5 py-1 text-left text-[11px] font-semibold text-white shadow-sm transition hover:brightness-95 hover:shadow-cardHover ${
        grande ? "py-1.5 text-xs" : ""
      }`}
      title={card.titulo}
    >
      <TipoIcone size={12} className="shrink-0 text-white/90" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{card.titulo}</span>
      {postado && <CheckCircle2 size={12} className="shrink-0 text-white" aria-hidden />}
    </button>
  );
}

function ChipPreview({
  titulo,
  cor,
  postado,
  largura,
  altura,
}: {
  titulo: string;
  cor: string;
  postado?: boolean;
  largura?: number;
  altura?: number;
}) {
  return (
    <div
      className="overflow-hidden rounded-marca px-2 py-2 text-[11px] font-semibold leading-tight text-white shadow-cardHover ring-1 ring-black/5"
      style={{ backgroundColor: cor, width: largura, height: altura }}
    >
      <span className={`line-clamp-2 ${postado ? "line-through decoration-2" : ""}`}>{titulo}</span>
    </div>
  );
}

function BotaoVisao({
  ativo,
  onClick,
  icone,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  icone: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`flex items-center gap-1.5 rounded-marca px-3 py-1.5 text-sm font-semibold transition ${
        ativo ? "bg-marca-laranja text-white" : "text-marca-cinza hover:text-marca-azulEscuro"
      }`}
    >
      {icone}
      {children}
    </button>
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
