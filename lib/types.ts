/**
 * Modelo de dados do painel de conteudo.
 * Todos os tipos sao explicitos (TypeScript estrito, sem uso de any).
 */

export type TipoConteudo = "reels" | "post" | "carrossel" | "stories";

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
  roteiro: string; // fala do Reels ou estrutura dos slides do carrossel
  legenda: string; // legenda final do post
  responsavel?: string;
  postadoEm?: string; // ISO datetime de quando foi marcado como postado
  criadoEm: string; // ISO datetime
  atualizadoEm: string; // ISO datetime
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
