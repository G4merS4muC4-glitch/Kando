import {
  Film,
  GalleryHorizontal,
  Image,
  CircleDot,
  FileText,
  BookOpen,
  ListChecks,
  Wrench,
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  Repeat,
  CalendarRange,
  CheckCircle2,
  Ban,
  type LucideIcon,
} from "lucide-react";
import type {
  Canal,
  EtapaOrg,
  Marca,
  Prioridade,
  StatusCampanha,
  TipoCampanha,
  TipoConteudo,
} from "./types";

/**
 * Configuracao central do app.
 * Colunas, tipos de conteudo, canais, marcas e tipos de campanha ficam aqui
 * para serem faceis de adicionar, remover ou renomear sem mexer na interface.
 */

/**
 * As 6 etapas padrao do quadro, da esquerda para a direita. Servem de fallback
 * (quando a organizacao ainda nao editou as colunas) e de seed. Cada organizacao
 * pode adicionar, renomear, reordenar e excluir as suas (ver Board.etapas).
 * Os papeis "inicial" (onde o card novo nasce) e "postado" (coluna de Publicado)
 * marcam o comportamento especial, em vez de depender do nome/id.
 */
export const ETAPAS_PADRAO: EtapaOrg[] = [
  { id: "ideias", titulo: "Ideias", descricao: "Backlog de pautas", inicial: true },
  {
    id: "briefing",
    titulo: "Briefing e Roteiro",
    descricao: "Pauta definida, gancho e estrutura",
  },
  { id: "producao", titulo: "Em Produção", descricao: "Design ou edição em andamento" },
  {
    id: "revisao",
    titulo: "Revisão de Marca",
    descricao: "Checagem final de copy e arte",
  },
  {
    id: "aprovado",
    titulo: "Aprovado e Agendado",
    descricao: "Pronto, com data de publicação",
  },
  { id: "publicado", titulo: "Publicado", descricao: "Já no ar", postado: true },
];

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
  materialRico: { label: "Material Rico", cor: "#6D4FC0", icone: FileText },
  ebook: { label: "E-book", cor: "#0E7490", icone: BookOpen },
  projeto: { label: "Projeto", cor: "#475569", icone: ListChecks },
  servico: { label: "Serviço", cor: "#0F766E", icone: Wrench },
};

/** Ordem dos tipos para uso em selects e filtros. */
export const TIPOS_ORDEM: TipoConteudo[] = [
  "reels",
  "post",
  "carrossel",
  "stories",
  "materialRico",
  "ebook",
  "projeto",
  "servico",
];

/**
 * Niveis de prioridade do card. O "peso" ordena do mais urgente para o menos
 * (usado no Painel e no quadro Geral). Cores para leitura rapida no card.
 */
export interface PrioridadeConfig {
  label: string;
  cor: string;
  peso: number; // maior = mais prioritario (sem prioridade = 0)
}

export const PRIORIDADES: Record<Prioridade, PrioridadeConfig> = {
  urgente: { label: "Urgente", cor: "#EC1313", peso: 4 },
  alta: { label: "Alta", cor: "#FA611E", peso: 3 },
  media: { label: "Média", cor: "#E0A400", peso: 2 },
  baixa: { label: "Baixa", cor: "#8790AB", peso: 1 },
};

/** Ordem para o seletor (do mais para o menos prioritario). */
export const PRIORIDADES_ORDEM: Prioridade[] = ["urgente", "alta", "media", "baixa"];

/** Peso de uma prioridade (para ordenar); sem prioridade = 0. */
export function pesoPrioridade(p?: Prioridade): number {
  return p ? PRIORIDADES[p].peso : 0;
}

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
  bimestral: { label: "Bimestral", icone: CalendarRange, descricao: "Por período" },
};

export const TIPOS_CAMPANHA_ORDEM: TipoCampanha[] = ["geral", "bimestral"];

/** Aparencia das situacoes arquivadas de uma campanha (concluida/cancelada). */
export interface StatusCampanhaConfig {
  label: string;
  cor: string;
  icone: LucideIcon;
}

export const STATUS_CAMPANHA: Record<Exclude<StatusCampanha, "ativa">, StatusCampanhaConfig> = {
  concluida: { label: "Concluída", cor: "#16A34A", icone: CheckCircle2 },
  cancelada: { label: "Cancelada", cor: "#8790AB", icone: Ban },
};

/** Indica se a situacao representa uma campanha arquivada (concluida/cancelada). */
export function campanhaArquivada(
  status: StatusCampanha | undefined
): status is Exclude<StatusCampanha, "ativa"> {
  return status === "concluida" || status === "cancelada";
}
