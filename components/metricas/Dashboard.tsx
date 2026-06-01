"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { ArrowUp, ArrowDown, ExternalLink, Bookmark, Share2, Eye } from "lucide-react";
import { TIPOS } from "@/lib/config";
import { TIPOS_METRICA, type MetricasInstagram, type TipoMetrica } from "@/lib/metricas";
import BadgeTipo from "@/components/BadgeTipo";

const CINZA = "#8790AB";

function formatarNumero(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "-";
  return new Intl.NumberFormat("pt-BR").format(n);
}

function dataCurta(iso?: string): string {
  if (!iso) return "";
  const p = iso.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}` : iso;
}

/** Variacao percentual com seta colorida (verde positivo, vermelho negativo). */
function Variacao({ pct }: { pct?: number | null }) {
  if (pct == null || Number.isNaN(pct)) return null;
  const positivo = pct > 0;
  const neutro = pct === 0;
  const cor = neutro ? "text-marca-cinza" : positivo ? "text-marca-verde" : "text-marca-vermelho";
  return (
    <span className={`flex items-center gap-0.5 text-xs font-semibold ${cor}`}>
      {!neutro && (positivo ? <ArrowUp size={12} aria-hidden /> : <ArrowDown size={12} aria-hidden />)}
      {positivo ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

function CartaoKpi({
  rotulo,
  valor,
  variacao,
}: {
  rotulo: string;
  valor: string;
  variacao?: number | null;
}) {
  return (
    <div className="rounded-marca border border-marca-cinza/30 bg-white p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-marca-cinza">{rotulo}</p>
      <p className="mt-1 text-2xl font-bold text-marca-azulEscuro">{valor}</p>
      <div className="mt-1">
        <Variacao pct={variacao} />
      </div>
    </div>
  );
}

function CartaoGrafico({
  titulo,
  children,
  vazio,
}: {
  titulo: string;
  children: React.ReactNode;
  vazio?: boolean;
}) {
  return (
    <div className="rounded-marca border border-marca-cinza/30 bg-white p-4 shadow-card">
      <p className="mb-3 text-sm font-bold text-marca-azulEscuro">{titulo}</p>
      {vazio ? (
        <p className="py-8 text-center text-sm text-marca-cinza">Sem dados para este período.</p>
      ) : (
        children
      )}
    </div>
  );
}

const DIAS = [
  { id: "seg", rotulo: "Seg" },
  { id: "ter", rotulo: "Ter" },
  { id: "qua", rotulo: "Qua" },
  { id: "qui", rotulo: "Qui" },
  { id: "sex", rotulo: "Sex" },
  { id: "sab", rotulo: "Sáb" },
  { id: "dom", rotulo: "Dom" },
];

/** Heatmap dia x hora em grade CSS pura (intensidade proporcional ao indice). */
function Heatmap({ dados, cor }: { dados: MetricasInstagram["melhores_horarios"]; cor: string }) {
  const mapa = new Map<string, number>();
  (dados ?? []).forEach((h) => {
    const dia = h.dia_semana?.toLowerCase().slice(0, 3);
    if (dia && typeof h.hora === "number") mapa.set(`${dia}-${h.hora}`, h.indice ?? 0);
  });
  const horas = Array.from({ length: 24 }, (_, i) => i);
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        {/* Linha de horas (de 3 em 3 para caber) */}
        <div className="mb-1 flex pl-9 text-[10px] text-marca-cinza">
          {horas.map((h) => (
            <div key={h} className="flex-1 text-center">
              {h % 3 === 0 ? `${h}h` : ""}
            </div>
          ))}
        </div>
        {DIAS.map((d) => (
          <div key={d.id} className="mb-0.5 flex items-center">
            <div className="w-9 shrink-0 text-[11px] font-semibold text-marca-cinza">{d.rotulo}</div>
            <div className="flex flex-1 gap-0.5">
              {horas.map((h) => {
                const indice = mapa.get(`${d.id}-${h}`) ?? 0;
                const op = indice > 0 ? Math.max(0.12, indice / 100) : 0;
                return (
                  <div
                    key={h}
                    title={`${d.rotulo} ${h}h${indice ? `: ${indice}` : ""}`}
                    className="h-5 flex-1 rounded-[2px]"
                    style={{
                      backgroundColor: indice > 0 ? cor : "#EDEFF5",
                      opacity: indice > 0 ? op : 1,
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Dashboard de metricas do perfil. Cada grafico tolera ausencia de dados. */
export default function Dashboard({ dados, cor }: { dados: MetricasInstagram; cor: string }) {
  const r = dados.resumo ?? {};

  const serieSeg = (dados.serie_seguidores ?? []).map((p) => ({
    data: dataCurta(p.data),
    total: p.total,
  }));
  const serieAlc = (dados.serie_alcance ?? []).map((p) => ({
    data: dataCurta(p.data),
    alcance: p.alcance,
    impressoes: p.impressoes ?? null,
  }));

  const porTipoAlcance = TIPOS_METRICA.filter(
    (t) => typeof dados.alcance_por_tipo?.[t] === "number"
  ).map((t: TipoMetrica) => ({
    nome: TIPOS[t].label,
    valor: dados.alcance_por_tipo![t] as number,
    cor: TIPOS[t].cor,
  }));

  const porTipoEngaj = TIPOS_METRICA.filter(
    (t) => dados.engajamento_por_tipo?.[t]?.taxa_pct != null
  ).map((t: TipoMetrica) => ({
    nome: TIPOS[t].label,
    valor: dados.engajamento_por_tipo![t]!.taxa_pct as number,
    cor: TIPOS[t].cor,
  }));

  const genero = dados.audiencia?.genero;
  const generoData = genero
    ? [
        { nome: "Feminino", valor: genero.feminino_pct ?? 0 },
        { nome: "Masculino", valor: genero.masculino_pct ?? 0 },
      ].filter((g) => g.valor > 0)
    : [];
  const faixaData = (dados.audiencia?.faixa_etaria ?? []).map((f) => ({ nome: f.faixa, valor: f.pct }));
  const cidadesData = (dados.audiencia?.cidades ?? []).map((c) => ({ nome: c.cidade, valor: c.pct }));

  const topPosts = dados.top_posts ?? [];

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CartaoKpi
          rotulo="Seguidores"
          valor={formatarNumero(r.seguidores?.total)}
          variacao={r.seguidores?.variacao_pct}
        />
        <CartaoKpi
          rotulo="Alcance"
          valor={formatarNumero(r.alcance?.total)}
          variacao={r.alcance?.variacao_pct}
        />
        <CartaoKpi
          rotulo="Taxa de engajamento"
          valor={r.engajamento?.taxa_pct != null ? `${r.engajamento.taxa_pct}%` : "-"}
          variacao={r.engajamento?.variacao_pct}
        />
        <CartaoKpi
          rotulo="Visitas ao perfil"
          valor={formatarNumero(r.visitas_perfil?.total)}
          variacao={r.visitas_perfil?.variacao_pct}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Crescimento de seguidores */}
        <CartaoGrafico titulo="Crescimento de seguidores" vazio={serieSeg.length === 0}>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serieSeg} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradSeg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={cor} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={cor} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E8F0" />
                <XAxis dataKey="data" tick={{ fontSize: 11, fill: CINZA }} />
                <YAxis tick={{ fontSize: 11, fill: CINZA }} width={44} />
                <Tooltip />
                <Area type="monotone" dataKey="total" name="Seguidores" stroke={cor} strokeWidth={2} fill="url(#gradSeg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CartaoGrafico>

        {/* Alcance e impressoes */}
        <CartaoGrafico titulo="Alcance e impressões" vazio={serieAlc.length === 0}>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serieAlc} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E8F0" />
                <XAxis dataKey="data" tick={{ fontSize: 11, fill: CINZA }} />
                <YAxis tick={{ fontSize: 11, fill: CINZA }} width={44} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="alcance" name="Alcance" stroke={cor} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="impressoes" name="Impressões" stroke="#044B8C" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CartaoGrafico>

        {/* Alcance por tipo */}
        <CartaoGrafico titulo="Alcance por tipo de conteúdo" vazio={porTipoAlcance.length === 0}>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porTipoAlcance} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E8F0" />
                <XAxis dataKey="nome" tick={{ fontSize: 11, fill: CINZA }} />
                <YAxis tick={{ fontSize: 11, fill: CINZA }} width={44} />
                <Tooltip />
                <Bar dataKey="valor" name="Alcance" radius={[4, 4, 0, 0]}>
                  {porTipoAlcance.map((d, i) => (
                    <Cell key={i} fill={d.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CartaoGrafico>

        {/* Engajamento por tipo */}
        <CartaoGrafico titulo="Engajamento por tipo (taxa %)" vazio={porTipoEngaj.length === 0}>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={porTipoEngaj} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E8F0" />
                <XAxis dataKey="nome" tick={{ fontSize: 11, fill: CINZA }} />
                <YAxis tick={{ fontSize: 11, fill: CINZA }} width={44} unit="%" />
                <Tooltip />
                <Bar dataKey="valor" name="Taxa de engajamento" radius={[4, 4, 0, 0]}>
                  {porTipoEngaj.map((d, i) => (
                    <Cell key={i} fill={d.cor} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CartaoGrafico>
      </div>

      {/* Melhores horarios */}
      <CartaoGrafico titulo="Melhores horários" vazio={(dados.melhores_horarios ?? []).length === 0}>
        <Heatmap dados={dados.melhores_horarios} cor={cor} />
      </CartaoGrafico>

      {/* Audiencia */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CartaoGrafico titulo="Gênero" vazio={generoData.length === 0}>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={generoData} dataKey="valor" nameKey="nome" innerRadius={48} outerRadius={78} paddingAngle={2}>
                  <Cell fill={cor} />
                  <Cell fill={CINZA} />
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CartaoGrafico>

        <CartaoGrafico titulo="Faixa etária" vazio={faixaData.length === 0}>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={faixaData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E8F0" />
                <XAxis dataKey="nome" tick={{ fontSize: 11, fill: CINZA }} />
                <YAxis tick={{ fontSize: 11, fill: CINZA }} width={36} unit="%" />
                <Tooltip />
                <Bar dataKey="valor" name="Público" fill={cor} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CartaoGrafico>

        <CartaoGrafico titulo="Principais cidades" vazio={cidadesData.length === 0}>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cidadesData} layout="vertical" margin={{ top: 5, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E8F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: CINZA }} unit="%" />
                <YAxis type="category" dataKey="nome" tick={{ fontSize: 11, fill: CINZA }} width={70} />
                <Tooltip />
                <Bar dataKey="valor" name="Público" fill={cor} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CartaoGrafico>
      </div>

      {/* Top posts */}
      <div className="rounded-marca border border-marca-cinza/30 bg-white p-4 shadow-card">
        <p className="mb-3 text-sm font-bold text-marca-azulEscuro">Posts em destaque</p>
        {topPosts.length === 0 ? (
          <p className="py-6 text-center text-sm text-marca-cinza">Sem posts em destaque.</p>
        ) : (
          <ol className="space-y-2">
            {topPosts.map((post, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-marca border border-marca-cinza/20 bg-marca-branco p-3"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-marca-azulEscuro text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {post.tipo && <BadgeTipo tipo={post.tipo} tamanho="pequeno" />}
                    {post.url ? (
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-sm font-semibold text-marca-azulClaro hover:underline"
                      >
                        {post.titulo || "Sem título"}
                        <ExternalLink size={12} aria-hidden />
                      </a>
                    ) : (
                      <span className="text-sm font-semibold text-marca-preto">
                        {post.titulo || "Sem título"}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-marca-cinza">
                    {post.data && <span>{dataCurta(post.data)}</span>}
                    {post.alcance != null && (
                      <span className="flex items-center gap-1">
                        <Eye size={12} aria-hidden /> {formatarNumero(post.alcance)}
                      </span>
                    )}
                    {post.salvamentos != null && (
                      <span className="flex items-center gap-1">
                        <Bookmark size={12} aria-hidden /> {formatarNumero(post.salvamentos)}
                      </span>
                    )}
                    {post.compartilhamentos != null && (
                      <span className="flex items-center gap-1">
                        <Share2 size={12} aria-hidden /> {formatarNumero(post.compartilhamentos)}
                      </span>
                    )}
                    {post.taxa_engajamento_pct != null && (
                      <span className="font-semibold text-marca-azulEscuro">
                        {post.taxa_engajamento_pct}% eng.
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Rodape */}
      <p className="text-center text-xs text-marca-cinza">
        {dados.periodo?.inicio && dados.periodo?.fim
          ? `Período: ${dados.periodo.inicio} a ${dados.periodo.fim}`
          : "Período não informado"}
        {dados.gerado_em ? `, atualizado em ${dados.gerado_em}` : ""}
      </p>
    </div>
  );
}
