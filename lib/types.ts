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
// Na F1 ainda e um tipo fixo; na F2 vira o id de uma marca cadastrada pela
// organizacao (ver MarcaOrg e Board.marcas).
export type Marca = "brusoft" | "evotalks";

/**
 * Marca cadastrada por uma organizacao (dados, nao mais um tipo fixo de codigo).
 * O `id` e imutavel (usado para casar com Campanha.marca e a linha de metricas);
 * so `nome` e `cor`/`corSuave` mudam.
 */
export interface MarcaOrg {
  id: string;
  nome: string;
  cor: string; // cor de destaque da marca
  corSuave: string; // fundo suave da marca
}

// Tipo de campanha: a geral (sempre rodando) e a bimestral (por periodo).
export type TipoCampanha = "geral" | "bimestral";

// Situacao da campanha. Arquivada = concluida (terminou bem) ou cancelada.
export type StatusCampanha = "ativa" | "concluida" | "cancelada";

/** Campanha: agrupa os conteudos. O quadro Kanban vive dentro de uma campanha. */
export interface Campanha {
  id: string;
  nome: string;
  marca: Marca;
  tipo: TipoCampanha;
  descricao?: string;
  inicio?: string; // data ISO (yyyy-mm-dd)
  fim?: string; // data ISO (yyyy-mm-dd)
  status?: StatusCampanha; // ausente = "ativa" (compatibilidade com dados antigos)
  arquivadaEm?: string; // ISO datetime de quando foi arquivada (concluida/cancelada)
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
  teleprompterAnterior?: string; // versao anterior (rede de seguranca p/ reverter edicao via link)
  teleprompterAjustadoEm?: string; // ISO datetime de quando foi ajustado por um compartilhamento
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
  marcas?: MarcaOrg[]; // marcas da organizacao (ausente em dados antigos)
  campanhas: Campanha[];
  cards: CardConteudo[];
}

/**
 * Apontamento de horas: um intervalo trabalhado, vinculado a um card
 * (projeto ou conteudo) e atribuido a quem fez (usuario logado). A duracao NAO
 * e guardada: e sempre calculada por diferenca entre fim e inicio (fonte unica).
 */
export interface RegistroTempo {
  id: string;
  cardId: string; // card vinculado (projeto/conteudo)
  inicio: string; // ISO datetime
  fim: string; // ISO datetime
  nota?: string; // o que estava sendo feito
  autorId: string; // id do usuario logado (ou "local" no modo sem login)
  autorNome: string; // e-mail/apelido para exibir
  criadoEm: string; // ISO datetime
  atualizadoEm: string; // ISO datetime
}

/**
 * Timer em andamento: um registro que ja tem inicio mas ainda nao tem fim.
 * Guardado por aparelho (localStorage), fora da memoria da aba, para sobreviver
 * a fechar a aba, suspender o computador ou bloquear o celular. O tempo corrido
 * e calculado por diferenca (agora menos inicio), nunca por um contador da aba.
 */
export interface TimerAtivo {
  cardId: string;
  inicio: string; // ISO datetime
  nota?: string;
  autorId: string;
  autorNome: string;
}

/** Documento compartilhado dos apontamentos (linha propria na tabela boards). */
export interface ApontamentosDoc {
  registros: RegistroTempo[];
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

/** Filtro de situacao na tela inicial de campanhas. */
export type StatusFiltro = "ativas" | "arquivadas" | "todas";

// ----- Organizacoes (multiempresa) -----

/** Papel de um membro dentro da organizacao. */
export type PapelOrg = "dono" | "membro";

/** Organizacao (empresa). Cada uma tem seus dados isolados. */
export interface Organizacao {
  id: string;
  nome: string;
  papel: PapelOrg; // papel do usuario logado nesta organizacao
}

/** Membro de uma organizacao (para a tela de gerenciar membros, F3). */
export interface MembroOrg {
  userId: string;
  email: string;
  papel: PapelOrg;
}
