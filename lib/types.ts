/**
 * Modelo de dados do painel de conteudo.
 * Todos os tipos sao explicitos (TypeScript estrito, sem uso de any).
 */

export type TipoConteudo =
  | "reels"
  | "post"
  | "carrossel"
  | "stories"
  | "materialRico"
  | "ebook"
  | "projeto";

// Canais de publicacao (Instagram e Facebook juntos, alem de LinkedIn e YouTube).
export type Canal = "instagram" | "facebook" | "linkedin" | "youtube";

export type Etapa =
  | "ideias"
  | "briefing"
  | "producao"
  | "revisao"
  | "aprovado"
  | "publicado";

// Marcas atendidas pelo time de marketing.
export type Marca = "brusoft" | "evotalks";

// Tipo de campanha: a geral (sempre rodando) e a bimestral (por periodo).
export type TipoCampanha = "geral" | "bimestral";

/** Campanha: agrupa os conteudos. O quadro Kanban vive dentro de uma campanha. */
export interface Campanha {
  id: string;
  nome: string;
  marca: Marca;
  tipo: TipoCampanha;
  descricao?: string;
  inicio?: string; // data ISO (yyyy-mm-dd)
  fim?: string; // data ISO (yyyy-mm-dd)
  criadoEm: string; // ISO datetime
  atualizadoEm: string; // ISO datetime
}

export interface CardConteudo {
  id: string;
  campanhaId: string; // campanha a que o conteudo pertence
  titulo: string;
  tipo: TipoConteudo;
  canais: Canal[]; // pode marcar mais de um
  etapa: Etapa;
  tema?: string; // campanha ou tema (ex: "Ciberseguranca")
  dataPublicacao?: string; // data ISO (yyyy-mm-dd)
  horaPublicacao?: string; // "HH:MM" do post (combina com dataPublicacao na auto-publicacao)
  midiaUrl?: string; // link publico da imagem/video (necessario para publicar no FB/IG)
  statusPub?: "agendado" | "publicado" | "erro"; // status da auto-publicacao
  erroPub?: string; // mensagem da ultima falha de publicacao
  briefing: string; // objetivo, publico, gancho, CTA
  roteiro: string; // roteiro completo: cenas, estrutura, indicacoes, slides
  teleprompter?: string; // apenas as falas (texto limpo para ler no teleprompter)
  legenda: string; // legenda final do post
  responsavel?: string;
  postadoEm?: string; // ISO datetime de quando foi marcado como postado
  projeto?: ProjetoDados; // fluxo de producao (apenas quando tipo === "projeto")
  criadoEm: string; // ISO datetime
  atualizadoEm: string; // ISO datetime
}

/**
 * Projeto (card do tipo "projeto"): um mini fluxo de producao dentro do card.
 * As fases sao as etapas de producao (lanes) e cada tarefa e um item simples
 * com texto e um marcador de concluido. Tudo e JSON puro e serializavel (sem
 * Date, Map ou funcoes), guardado dentro do proprio card.
 */
export interface ProjetoTarefa {
  id: string; // gerarId()
  texto: string; // ex: "Ver medidas"
  feita: boolean;
  feitaEm?: string; // ISO datetime de quando foi marcada (para analise futura)
}

export interface ProjetoFase {
  id: string; // gerarId()
  nome: string; // ex: "Pesquisa", "Producao"
  tarefas: ProjetoTarefa[]; // a ordem da lista e a posicao no array
}

export interface ProjetoDados {
  fases: ProjetoFase[]; // a ordem das fases e a posicao no array
}

/** Estado completo. Estrutura isolada para facilitar futura migracao para banco. */
export interface Board {
  campanhas: Campanha[];
  cards: CardConteudo[];
}

/** Filtros aplicados sobre os cards visiveis dentro de uma campanha. */
export interface FiltrosState {
  busca: string;
  tipo: TipoConteudo | "todos";
  canal: Canal | "todos";
  tema: string | "todos";
}

/** Filtro de marca na tela inicial de campanhas. */
export type MarcaFiltro = Marca | "todas";
