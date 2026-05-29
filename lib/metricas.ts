/**
 * Contrato de dados da secao de Metricas e Planejamento (Instagram).
 *
 * O app nao acessa o Instagram. A pessoa pede a analise a um Claude (com o
 * prompt gerado aqui), recebe um JSON neste formato e cola de volta. Estes tipos
 * descrevem esse JSON, tolerando campos ausentes ou null (a dash nao quebra).
 */

import type { TipoConteudo } from "./types";

export type PerfilMetrica = "brusoft" | "evotalks";

/** Tipos de conteudo considerados nas metricas (subconjunto do quadro). */
export type TipoMetrica = "reels" | "post" | "carrossel" | "stories";
export const TIPOS_METRICA: TipoMetrica[] = ["reels", "post", "carrossel", "stories"];

export interface ValorVariacao {
  total?: number | null;
  novos?: number | null;
  variacao_pct?: number | null;
}

export interface ResumoEngajamento {
  taxa_pct?: number | null;
  interacoes?: number | null;
  variacao_pct?: number | null;
}

export interface PontoSeguidores {
  data: string;
  total: number;
  novos?: number;
  perdidos?: number;
}

export interface PontoAlcance {
  data: string;
  alcance: number;
  impressoes?: number;
}

export interface TopPost {
  titulo: string;
  tipo?: TipoMetrica;
  data?: string;
  alcance?: number;
  visualizacoes?: number;
  curtidas?: number;
  comentarios?: number;
  salvamentos?: number;
  compartilhamentos?: number;
  taxa_engajamento_pct?: number;
  url?: string;
}

export interface MelhorHorario {
  dia_semana: string; // seg, ter, qua, qui, sex, sab, dom
  hora: number; // 0 a 23
  indice: number; // 0 a 100
}

export interface Recomendacao {
  titulo: string;
  porque?: string;
  tipo_sugerido?: TipoConteudo;
  tema_sugerido?: string;
}

export interface MetricasInstagram {
  schema_version?: string;
  perfil: PerfilMetrica;
  handle?: string;
  periodo?: { inicio?: string; fim?: string; dias?: number };
  gerado_em?: string;
  resumo?: {
    seguidores?: ValorVariacao;
    alcance?: ValorVariacao;
    impressoes?: ValorVariacao;
    visitas_perfil?: ValorVariacao;
    cliques_link?: ValorVariacao;
    engajamento?: ResumoEngajamento;
  };
  serie_seguidores?: PontoSeguidores[];
  serie_alcance?: PontoAlcance[];
  alcance_por_tipo?: Partial<Record<TipoMetrica, number>>;
  engajamento_por_tipo?: Partial<Record<TipoMetrica, { taxa_pct?: number; publicacoes?: number }>>;
  top_posts?: TopPost[];
  melhores_horarios?: MelhorHorario[];
  audiencia?: {
    genero?: { feminino_pct?: number; masculino_pct?: number };
    faixa_etaria?: { faixa: string; pct: number }[];
    cidades?: { cidade: string; pct: number }[];
  };
  insights?: string[];
  recomendacoes?: Recomendacao[];
}

/** Handles padrao por perfil (usados no prompt; ajustaveis pelo time). */
export const HANDLE_PADRAO: Record<PerfilMetrica, string> = {
  brusoft: "@brusoft.inf",
  evotalks: "@evotalks",
};

const CONTEXTO_MARCA: Record<PerfilMetrica, string> = {
  brusoft:
    "A Brusoft e um MSP B2B (gestao de TI, infraestrutura, seguranca, nuvem e produtividade). Publico: donos e gestores de empresa. Foco em continuidade, seguranca, previsibilidade e produtividade. CTA recorrente: diagnostico gratuito de TI. Tom direto, sem promessa inflada, com dor concreta e consequencia pratica.",
  evotalks:
    "A Evotalks atua com atendimento e experiencia do cliente, com foco em WhatsApp, API oficial e automacao com bots. Publico: empresas que querem organizar e escalar atendimento. Tom direto e pratico, mostrando ganho real de operacao.",
};

/** Estrutura limpa (sem valores) que o Claude deve devolver preenchida. */
const SCHEMA_SKELETON = `{
  "schema_version": "1.0",
  "perfil": "{{PERFIL_ID}}",
  "handle": "{{HANDLE}}",
  "periodo": { "inicio": "AAAA-MM-DD", "fim": "AAAA-MM-DD", "dias": 0 },
  "gerado_em": "AAAA-MM-DD",
  "resumo": {
    "seguidores":     { "total": 0, "novos": 0, "variacao_pct": 0 },
    "alcance":        { "total": 0, "variacao_pct": 0 },
    "impressoes":     { "total": 0, "variacao_pct": 0 },
    "visitas_perfil": { "total": 0, "variacao_pct": 0 },
    "cliques_link":   { "total": 0, "variacao_pct": 0 },
    "engajamento":    { "taxa_pct": 0, "interacoes": 0, "variacao_pct": 0 }
  },
  "serie_seguidores": [ { "data": "AAAA-MM-DD", "total": 0, "novos": 0, "perdidos": 0 } ],
  "serie_alcance": [ { "data": "AAAA-MM-DD", "alcance": 0, "impressoes": 0 } ],
  "alcance_por_tipo": { "reels": 0, "carrossel": 0, "post": 0, "stories": 0 },
  "engajamento_por_tipo": {
    "reels":     { "taxa_pct": 0, "publicacoes": 0 },
    "carrossel": { "taxa_pct": 0, "publicacoes": 0 },
    "post":      { "taxa_pct": 0, "publicacoes": 0 },
    "stories":   { "taxa_pct": 0, "publicacoes": 0 }
  },
  "top_posts": [
    { "titulo": "", "tipo": "reels", "data": "AAAA-MM-DD", "alcance": 0, "visualizacoes": 0, "curtidas": 0, "comentarios": 0, "salvamentos": 0, "compartilhamentos": 0, "taxa_engajamento_pct": 0, "url": "" }
  ],
  "melhores_horarios": [ { "dia_semana": "ter", "hora": 19, "indice": 0 } ],
  "audiencia": {
    "genero": { "feminino_pct": 0, "masculino_pct": 0 },
    "faixa_etaria": [ { "faixa": "25-34", "pct": 0 } ],
    "cidades": [ { "cidade": "", "pct": 0 } ]
  },
  "insights": [ "" ],
  "recomendacoes": [ { "titulo": "", "porque": "", "tipo_sugerido": "reels", "tema_sugerido": "" } ]
}`;

/** Rotulo amigavel do perfil. */
export function rotuloPerfil(perfil: PerfilMetrica): string {
  return perfil === "brusoft" ? "Brusoft" : "Evotalks";
}

/**
 * Monta o prompt pronto para a pessoa copiar e colar num Claude. Injeta o
 * perfil, handle, periodo e o contexto da marca conforme a selecao.
 */
export function gerarPromptAtualizacao(
  perfil: PerfilMetrica,
  handle: string,
  periodoLabel: string
): string {
  return `Voce e analista de redes sociais. Sua tarefa e analisar o desempenho do Instagram
do perfil ${rotuloPerfil(perfil)} (${handle}) no periodo ${periodoLabel} e devolver UM unico arquivo
JSON, no formato exato definido no fim deste prompt, que sera carregado num dashboard.

COMO OBTER OS DADOS
- Se voce tiver acesso a conta do Instagram por uma ferramenta conectada, extraia as
  metricas direto de la.
- Se nao tiver, analise os prints, exportacoes (CSV) ou numeros do Instagram Insights
  que eu colar ou enviar nesta conversa.
- Nao invente numeros. Se algum dado nao estiver disponivel, use null ou omita o campo.
  Nunca preencha por estimativa sem deixar claro.

CONTEXTO DA MARCA (use para escrever os campos "insights" e "recomendacoes")
${CONTEXTO_MARCA[perfil]}

REGRAS DE SAIDA
- Responda APENAS com o JSON. Sem texto antes ou depois. Sem blocos de codigo. Sem comentarios.
- Todos os textos em portugues do Brasil, sem travessao.
- Datas no formato AAAA-MM-DD. Percentuais como numero (ex: 4.8, e nao "4,8%").
- "insights": 3 a 6 leituras objetivas do periodo, ligadas aos numeros.
- "recomendacoes": 3 a 5 acoes de conteudo conectadas as metricas e a marca, cada uma
  com titulo, porque, tipo_sugerido (reels/post/carrossel/stories) e tema_sugerido.

FORMATO (devolva exatamente esta estrutura, preenchida):
${SCHEMA_SKELETON.replace("{{PERFIL_ID}}", perfil).replace("{{HANDLE}}", handle)}`;
}

/**
 * Interpreta e valida o JSON colado. Tolerante a blocos de codigo acidentais.
 * Retorna os dados ou uma mensagem de erro amigavel em portugues.
 */
export function parseMetricas(
  texto: string
): { ok: true; dados: MetricasInstagram } | { ok: false; erro: string } {
  let limpo = texto.trim();
  if (limpo.startsWith("```")) {
    limpo = limpo.replace(/^```(?:json)?/i, "").replace(/```\s*$/, "").trim();
  }
  if (!limpo) return { ok: false, erro: "Cole o JSON gerado pelo Claude para atualizar as metricas." };

  let obj: unknown;
  try {
    obj = JSON.parse(limpo);
  } catch {
    return {
      ok: false,
      erro: "O texto colado nao e um JSON valido. Verifique se copiou o conteudo completo, sem cortar.",
    };
  }
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return { ok: false, erro: "O JSON precisa ser um objeto com os dados das metricas." };
  }
  const m = obj as MetricasInstagram;
  if (m.perfil !== "brusoft" && m.perfil !== "evotalks") {
    return { ok: false, erro: "O campo 'perfil' precisa ser 'brusoft' ou 'evotalks'." };
  }
  if (!m.resumo || typeof m.resumo !== "object") {
    return { ok: false, erro: "Faltou o bloco 'resumo' com os indicadores principais." };
  }
  const temSerie =
    (Array.isArray(m.serie_seguidores) && m.serie_seguidores.length > 0) ||
    (Array.isArray(m.serie_alcance) && m.serie_alcance.length > 0);
  if (!temSerie) {
    return {
      ok: false,
      erro: "Faltou pelo menos uma serie temporal (serie_seguidores ou serie_alcance).",
    };
  }
  return { ok: true, dados: m };
}
