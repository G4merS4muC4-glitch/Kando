import type { Board, Campanha, CardConteudo } from "./types";

/**
 * Quadro inicial de exemplo.
 * Duas marcas (Brusoft e Evotalks), cada uma com uma campanha geral e uma
 * bimestral. Os cards demonstram tipos, canais, prazos vencidos e conteudos
 * ja postados (estado verde).
 *
 * Datas pensadas em relacao a maio de 2026.
 */

const TS = "2026-05-15T09:00:00.000Z";

// IDs das campanhas usados para vincular os cards.
const C = {
  bruGeral: "camp-bru-geral",
  bruBim: "camp-bru-bim",
  evoGeral: "camp-evo-geral",
  evoBim: "camp-evo-bim",
};

export function boardInicial(): Board {
  return {
    campanhas: campanhasExemplo.map((c) => ({ ...c })),
    cards: cardsExemplo.map((c) => ({ ...c })),
  };
}

const campanhasExemplo: Campanha[] = [
  {
    id: C.bruGeral,
    nome: "Conteudo Geral",
    marca: "brusoft",
    tipo: "geral",
    descricao: "Linha editorial permanente da Brusoft: autoridade em TI gerenciada.",
    inicio: "2026-01-01",
    criadoEm: TS,
    atualizadoEm: TS,
  },
  {
    id: C.bruBim,
    nome: "Bimestral Mai/Jun",
    marca: "brusoft",
    tipo: "bimestral",
    descricao: "Foco do bimestre: ciberseguranca e backup para PMEs.",
    inicio: "2026-05-01",
    fim: "2026-06-30",
    criadoEm: TS,
    atualizadoEm: TS,
  },
  {
    id: C.evoGeral,
    nome: "Conteudo Geral",
    marca: "evotalks",
    tipo: "geral",
    descricao: "Linha editorial permanente da Evotalks: atendimento e experiencia do cliente.",
    inicio: "2026-01-01",
    criadoEm: TS,
    atualizadoEm: TS,
  },
  {
    id: C.evoBim,
    nome: "Bimestral Mai/Jun",
    marca: "evotalks",
    tipo: "bimestral",
    descricao: "Foco do bimestre: atendimento no WhatsApp e automacao com bots.",
    inicio: "2026-05-01",
    fim: "2026-06-30",
    criadoEm: TS,
    atualizadoEm: TS,
  },
];

const cardsExemplo: CardConteudo[] = [
  // ===== Brusoft - Geral =====
  {
    id: "bru-01",
    campanhaId: C.bruGeral,
    titulo: "Post: o que e um MSP e por que sua empresa precisa",
    tipo: "post",
    canais: ["instagram", "facebook", "linkedin"],
    etapa: "ideias",
    tema: "Institucional",
    briefing:
      "Objetivo: posicionamento de marca. Publico: decisores B2B. Tom educativo e direto. CTA: conhecer os planos de gestao de TI.",
    roteiro: "",
    legenda: "",
    criadoEm: TS,
    atualizadoEm: TS,
  },
  {
    id: "bru-02",
    campanhaId: C.bruGeral,
    titulo: "Carrossel: tendencias de TI para 2026",
    tipo: "carrossel",
    canais: ["instagram", "linkedin"],
    etapa: "publicado",
    tema: "Tendencias",
    dataPublicacao: "2026-05-08",
    postadoEm: "2026-05-08T12:00:00.000Z",
    briefing: "Objetivo: autoridade e alcance. Publico: decisores. CTA: comentar.",
    roteiro: "5 tendencias com um slide cada e fontes citadas.",
    legenda:
      "As 5 tendencias de TI que vao definir 2026. Sua empresa esta preparada para todas elas?",
    responsavel: "Marketing",
    criadoEm: TS,
    atualizadoEm: TS,
  },
  {
    id: "bru-03",
    campanhaId: C.bruGeral,
    titulo: "Post: caso de sucesso, reducao de 40% em chamados",
    tipo: "post",
    canais: ["linkedin", "facebook"],
    etapa: "producao",
    tema: "Cases",
    dataPublicacao: "2026-05-20", // prazo vencido
    briefing: "Objetivo: prova social. Numeros reais de um cliente industrial. CTA: falar com especialista.",
    roteiro: "Arte com destaque para o numero 40% e selo de case real.",
    legenda:
      "Como reduzimos em 40% os chamados de TI de um cliente industrial em 90 dias. A gestao proativa muda o jogo.",
    responsavel: "Design",
    criadoEm: TS,
    atualizadoEm: TS,
  },
  {
    id: "bru-04",
    campanhaId: C.bruGeral,
    titulo: "Reels: dica rapida de produtividade com a nuvem",
    tipo: "reels",
    canais: ["instagram", "youtube"],
    etapa: "aprovado",
    tema: "Produtividade",
    dataPublicacao: "2026-06-02",
    briefing: "Objetivo: entregar valor rapido. Gancho: economize 1 hora por dia. CTA: salvar.",
    roteiro:
      "Gancho (0-3s): Voce perde 1 hora por dia procurando arquivos?\nDesenvolvimento (3-15s): mostrar 3 atalhos de colaboracao em nuvem.\nCTA (15-20s): salva esse Reels e manda pro seu time.",
    legenda: "Tres formas de usar a nuvem para ganhar tempo no dia a dia. Qual delas voce ja usa?",
    responsavel: "Marketing",
    criadoEm: TS,
    atualizadoEm: TS,
  },

  // ===== Brusoft - Bimestral (ciberseguranca/backup) =====
  {
    id: "bru-05",
    campanhaId: C.bruBim,
    titulo: "Reels: 3 sinais de que sua rede foi invadida",
    tipo: "reels",
    canais: ["instagram", "facebook", "youtube"],
    etapa: "ideias",
    tema: "Ciberseguranca",
    briefing: "Objetivo: gerar urgencia. Gancho nos 2 primeiros segundos. CTA: comentar SEGURANCA.",
    roteiro: "",
    legenda: "",
    criadoEm: TS,
    atualizadoEm: TS,
  },
  {
    id: "bru-06",
    campanhaId: C.bruBim,
    titulo: "Carrossel: checklist de seguranca para o home office",
    tipo: "carrossel",
    canais: ["instagram", "linkedin"],
    etapa: "briefing",
    tema: "Ciberseguranca",
    dataPublicacao: "2026-06-10",
    briefing: "Objetivo: gerar autoridade. Gancho: trabalho remoto sem dor de cabeca. CTA: salvar.",
    roteiro:
      "Slide 1: capa com titulo.\nSlide 2: use VPN.\nSlide 3: senhas fortes e gerenciador.\nSlide 4: 2FA em tudo.\nSlide 5: cuidado com Wi-Fi publico.\nSlide 6: CTA Brusoft.",
    legenda: "",
    responsavel: "Marketing",
    criadoEm: TS,
    atualizadoEm: TS,
  },
  {
    id: "bru-07",
    campanhaId: C.bruBim,
    titulo: "Carrossel: LGPD na pratica para pequenas empresas",
    tipo: "carrossel",
    canais: ["instagram", "facebook", "linkedin"],
    etapa: "revisao",
    tema: "Compliance",
    dataPublicacao: "2026-05-26", // prazo vencido
    briefing: "Objetivo: educar sobre LGPD. Tom acessivel, sem juridiques. CTA: baixar guia.",
    roteiro:
      "Slide 1: o que muda com a LGPD.\nSlide 2: dados que voce coleta.\nSlide 3: consentimento.\nSlide 4: como se proteger.\nSlide 5: CTA.",
    legenda:
      "LGPD nao precisa ser um bicho de sete cabecas. Veja o passo a passo para deixar sua empresa em conformidade.",
    responsavel: "Marketing",
    criadoEm: TS,
    atualizadoEm: TS,
  },
  {
    id: "bru-08",
    campanhaId: C.bruBim,
    titulo: "Reels: como funciona um ataque de phishing",
    tipo: "reels",
    canais: ["instagram", "youtube"],
    etapa: "publicado",
    tema: "Ciberseguranca",
    dataPublicacao: "2026-05-12",
    postadoEm: "2026-05-12T18:00:00.000Z",
    briefing: "Objetivo: conscientizar. Simulacao de e-mail falso. CTA: compartilhar com o time.",
    roteiro: "Mostrar um e-mail suspeito e apontar os 3 sinais de golpe.",
    legenda:
      "Voce saberia identificar um golpe de phishing? Compartilhe com o seu time e ajude a proteger a empresa.",
    responsavel: "Marketing",
    criadoEm: TS,
    atualizadoEm: TS,
  },

  // ===== Evotalks - Geral (atendimento/CX) =====
  {
    id: "evo-01",
    campanhaId: C.evoGeral,
    titulo: "Post: 5 metricas de atendimento que voce deveria acompanhar",
    tipo: "post",
    canais: ["instagram", "linkedin"],
    etapa: "ideias",
    tema: "Experiencia do Cliente",
    briefing: "Objetivo: gerar autoridade em CX. Publico: gestores de atendimento. CTA: salvar.",
    roteiro: "",
    legenda: "",
    criadoEm: TS,
    atualizadoEm: TS,
  },
  {
    id: "evo-02",
    campanhaId: C.evoGeral,
    titulo: "Reels: atendimento omnichannel em 30 segundos",
    tipo: "reels",
    canais: ["instagram", "facebook", "youtube"],
    etapa: "producao",
    tema: "Omnichannel",
    dataPublicacao: "2026-06-04",
    briefing: "Objetivo: explicar omnichannel de forma simples. Gancho rapido. CTA: seguir o perfil.",
    roteiro:
      "Gancho (0-3s): Seu cliente fala no WhatsApp, no Insta e no e-mail. E voce responde tudo separado?\nDesenvolvimento: mostrar uma unica tela reunindo os canais.\nCTA: conheca a Evotalks.",
    legenda: "Um cliente, uma conversa. Veja como o omnichannel descomplica o atendimento.",
    responsavel: "Marketing",
    criadoEm: TS,
    atualizadoEm: TS,
  },
  {
    id: "evo-03",
    campanhaId: C.evoGeral,
    titulo: "Carrossel: erros comuns no atendimento ao cliente",
    tipo: "carrossel",
    canais: ["instagram", "linkedin"],
    etapa: "publicado",
    tema: "Experiencia do Cliente",
    dataPublicacao: "2026-05-10",
    postadoEm: "2026-05-10T14:00:00.000Z",
    briefing: "Objetivo: engajamento. Publico: times de suporte. CTA: marcar um colega.",
    roteiro: "Slide a slide com 5 erros e como evitar cada um.",
    legenda: "5 erros que afastam seus clientes. O numero 3 acontece todo dia e ninguem percebe.",
    responsavel: "Marketing",
    criadoEm: TS,
    atualizadoEm: TS,
  },

  // ===== Evotalks - Bimestral (WhatsApp/bots) =====
  {
    id: "evo-04",
    campanhaId: C.evoBim,
    titulo: "Reels: monte um chatbot de WhatsApp sem codigo",
    tipo: "reels",
    canais: ["instagram", "youtube"],
    etapa: "briefing",
    tema: "Automacao",
    dataPublicacao: "2026-06-08",
    briefing: "Objetivo: mostrar facilidade da plataforma. Gancho: bot em 5 minutos. CTA: testar gratis.",
    roteiro:
      "Gancho (0-3s): Da pra montar um bot de WhatsApp em 5 minutos? Da sim.\nDesenvolvimento: gravar a tela montando um fluxo simples.\nCTA: comeca o teste gratis.",
    legenda: "",
    responsavel: "Marketing",
    criadoEm: TS,
    atualizadoEm: TS,
  },
  {
    id: "evo-05",
    campanhaId: C.evoBim,
    titulo: "Stories: enquete sobre tempo de resposta no WhatsApp",
    tipo: "stories",
    canais: ["instagram"],
    etapa: "aprovado",
    tema: "Engajamento",
    dataPublicacao: "2026-05-30",
    briefing: "Objetivo: engajamento e pesquisa. Enquete com faixas de tempo. CTA: responder.",
    roteiro: "Story 1: pergunta.\nStory 2: enquete.\nStory 3: resultado e dica da Evotalks.",
    legenda: "",
    responsavel: "Marketing",
    criadoEm: TS,
    atualizadoEm: TS,
  },
  {
    id: "evo-06",
    campanhaId: C.evoBim,
    titulo: "Post: como reduzir o tempo de espera com bots",
    tipo: "post",
    canais: ["linkedin", "facebook"],
    etapa: "revisao",
    tema: "Automacao",
    dataPublicacao: "2026-05-25", // prazo vencido
    briefing: "Objetivo: gerar leads. Publico: gestores de atendimento. CTA: agendar demonstracao.",
    roteiro: "Arte com antes e depois do tempo medio de espera.",
    legenda:
      "Filas de atendimento custam clientes. Veja como os bots da Evotalks reduzem o tempo de espera sem perder o toque humano.",
    responsavel: "Marketing",
    criadoEm: TS,
    atualizadoEm: TS,
  },
];
