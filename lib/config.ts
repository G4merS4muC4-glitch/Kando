import {
  Film,
  GalleryHorizontal,
  Image,
  CircleDot,
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  Repeat,
  CalendarRange,
  type LucideIcon,
} from "lucide-react";
import type { Canal, Etapa, Marca, TipoCampanha, TipoConteudo } from "./types";

/**
 * Configuracao central do app.
 * Colunas, tipos de conteudo, canais, marcas e tipos de campanha ficam aqui
 * para serem faceis de adicionar, remover ou renomear sem mexer na interface.
 */

/** Definicao de cada coluna (etapa) do fluxo de producao. */
export interface ColunaConfig {
  id: Etapa;
  titulo: string;
  descricao: string;
}

/** As seis etapas, da esquerda para a direita, refletindo o fluxo real. */
export const COLUNAS: ColunaConfig[] = [
  { id: "ideias", titulo: "Ideias", descricao: "Backlog de pautas" },
  {
    id: "briefing",
    titulo: "Briefing e Roteiro",
    descricao: "Pauta definida, gancho e estrutura",
  },
  { id: "producao", titulo: "Em Producao", descricao: "Design ou edicao em andamento" },
  {
    id: "revisao",
    titulo: "Revisao de Marca",
    descricao: "Checagem final de copy e arte",
  },
  {
    id: "aprovado",
    titulo: "Aprovado e Agendado",
    descricao: "Pronto, com data de publicacao",
  },
  { id: "publicado", titulo: "Publicado", descricao: "Ja no ar" },
];

/** Lista ordenada apenas das etapas (usada na logica de drag and drop). */
export const ETAPAS: Etapa[] = COLUNAS.map((c) => c.id);

/** Mapa rapido etapa -> titulo. */
export const ETAPA_TITULO: Record<Etapa, string> = COLUNAS.reduce(
  (acc, c) => ({ ...acc, [c.id]: c.titulo }),
  {} as Record<Etapa, string>
);

/** Aparencia de cada tipo de conteudo (badge colorido com icone). */
export interface TipoConfig {
  label: string;
  cor: string; // cor de fundo do badge
  icone: LucideIcon;
}

export const TIPOS: Record<TipoConteudo, TipoConfig> = {
  reels: { label: "Reels", cor: "#FA611E", icone: Film },
  carrossel: { label: "Carrossel", cor: "#044B8C", icone: GalleryHorizontal },
  post: { label: "Post", cor: "#002952", icone: Image },
  stories: { label: "Stories", cor: "#8790AB", icone: CircleDot },
};

/** Ordem dos tipos para uso em selects e filtros. */
export const TIPOS_ORDEM: TipoConteudo[] = ["reels", "post", "carrossel", "stories"];

/** Aparencia de cada canal. As cores seguem as plataformas para leitura rapida. */
export interface CanalConfig {
  label: string;
  icone: LucideIcon;
  cor: string;
  limiteLegenda: number; // referencia de caracteres para a legenda
}

export const CANAIS: Record<Canal, CanalConfig> = {
  instagram: { label: "Instagram", icone: Instagram, cor: "#E1306C", limiteLegenda: 2200 },
  facebook: { label: "Facebook", icone: Facebook, cor: "#1877F2", limiteLegenda: 2200 },
  linkedin: { label: "LinkedIn", icone: Linkedin, cor: "#0A66C2", limiteLegenda: 3000 },
  youtube: { label: "YouTube", icone: Youtube, cor: "#FF0000", limiteLegenda: 5000 },
};

export const CANAIS_ORDEM: Canal[] = ["instagram", "facebook", "linkedin", "youtube"];

/** Limite de legenda padrao quando nenhum canal foi marcado. */
export const LIMITE_LEGENDA_PADRAO = 2200;

/** Aparencia de cada marca (usada em badges, filtros e no calendario). */
export interface MarcaConfig {
  label: string;
  cor: string; // cor de destaque da marca
  corSuave: string; // fundo suave da marca
}

export const MARCAS: Record<Marca, MarcaConfig> = {
  brusoft: { label: "Brusoft", cor: "#FA611E", corSuave: "#FFF1E9" },
  evotalks: { label: "Evotalks", cor: "#1bbf5d", corSuave: "#E2F7EC" },
};

export const MARCAS_ORDEM: Marca[] = ["brusoft", "evotalks"];

/** Aparencia de cada tipo de campanha. */
export interface TipoCampanhaConfig {
  label: string;
  icone: LucideIcon;
  descricao: string;
}

export const TIPOS_CAMPANHA: Record<TipoCampanha, TipoCampanhaConfig> = {
  geral: { label: "Geral", icone: Repeat, descricao: "Sempre rodando" },
  bimestral: { label: "Bimestral", icone: CalendarRange, descricao: "Por periodo" },
};

export const TIPOS_CAMPANHA_ORDEM: TipoCampanha[] = ["geral", "bimestral"];
