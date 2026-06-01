import type { Canal, Marca, TipoConteudo } from "./types";
import { chaveData } from "./util";

/**
 * Catalogo de datas comemorativas (recorrentes todo ano, mes/dia fixos).
 * Cada data traz uma sugestao de conteudo por marca quando faz sentido:
 * datas de TI/seguranca para a Brusoft e datas de atendimento/cliente para a
 * Evotalks, alem de datas gerais de marketing para as duas.
 *
 * Datas moveis (Dia das Maes, dos Pais, Black Friday) ficam de fora para
 * garantir que a marcacao no calendario seja sempre correta.
 */

export interface SugestaoConteudo {
  titulo: string;
  tipo: TipoConteudo;
  canais: Canal[];
  briefing: string;
  roteiro?: string;
  legenda?: string;
}

export interface DataComemorativa {
  id: string;
  nome: string;
  mes: number; // 1-12
  dia: number; // 1-31
  emoji: string;
  sugestoes: Partial<Record<Marca, SugestaoConteudo>>;
}

export const DATAS_COMEMORATIVAS: DataComemorativa[] = [
  {
    id: "ano-novo",
    nome: "Ano Novo",
    mes: 1,
    dia: 1,
    emoji: "🎆",
    sugestoes: {
      brusoft: {
        titulo: "Comece o ano com a TI em dia",
        tipo: "post",
        canais: ["instagram", "linkedin", "facebook"],
        briefing:
          "Objetivo: planejamento. Público: gestores. Gancho: ano novo, TI nova. CTA: agendar um diagnóstico gratuito de TI.",
        legenda:
          "Ano novo começa com planejamento. Que tal deixar a TI da sua empresa redonda para 2026?",
      },
      evotalks: {
        titulo: "Resoluções de atendimento para o novo ano",
        tipo: "carrossel",
        canais: ["instagram", "linkedin"],
        briefing:
          "Objetivo: engajamento. Público: gestores de atendimento. Lista de metas de CX para o ano. CTA: salvar.",
        legenda: "Ano novo, atendimento melhor. 5 metas de experiência do cliente para colocar em prática.",
      },
    },
  },
  {
    id: "protecao-dados",
    nome: "Dia da Proteção de Dados",
    mes: 1,
    dia: 28,
    emoji: "🔒",
    sugestoes: {
      brusoft: {
        titulo: "Dia da Proteção de Dados: sua empresa está segura?",
        tipo: "carrossel",
        canais: ["instagram", "linkedin"],
        briefing:
          "Objetivo: autoridade em segurança. Público: gestores. Gancho: seus dados valem mais do que você imagina. CTA: agendar diagnóstico de LGPD.",
        legenda:
          "Hoje é o Dia da Proteção de Dados. Sua empresa trata os dados dos clientes com o cuidado que a LGPD exige?",
      },
      evotalks: {
        titulo: "Proteção de dados no atendimento ao cliente",
        tipo: "post",
        canais: ["linkedin", "instagram"],
        briefing:
          "Objetivo: confiança. Público: gestores de atendimento. Gancho: cada conversa guarda dados sensíveis. CTA: conheça a segurança da Evotalks.",
        legenda:
          "No atendimento, cada mensagem carrega dados do cliente. No Dia da Proteção de Dados, reforce a confiança.",
      },
    },
  },
  {
    id: "dia-mulher",
    nome: "Dia Internacional da Mulher",
    mes: 3,
    dia: 8,
    emoji: "💜",
    sugestoes: {
      brusoft: {
        titulo: "Mulheres que movem a tecnologia",
        tipo: "post",
        canais: ["instagram", "linkedin"],
        briefing:
          "Objetivo: institucional e diversidade. Homenagear mulheres da TI. CTA: marcar uma mulher inspiradora.",
        legenda: "No Dia Internacional da Mulher, celebramos as mulheres que movem a tecnologia.",
      },
      evotalks: {
        titulo: "Mulheres que transformam o atendimento",
        tipo: "post",
        canais: ["instagram", "linkedin"],
        briefing:
          "Objetivo: institucional. Homenagear as mulheres do atendimento e CX. CTA: comentar e marcar.",
        legenda: "Elas estão na linha de frente do atendimento. Feliz Dia da Mulher!",
      },
    },
  },
  {
    id: "dia-consumidor",
    nome: "Dia do Consumidor",
    mes: 3,
    dia: 15,
    emoji: "🛍️",
    sugestoes: {
      evotalks: {
        titulo: "Dia do Consumidor: atendimento que fideliza",
        tipo: "reels",
        canais: ["instagram", "facebook"],
        briefing:
          "Objetivo: gerar leads. Gancho: cliente bem atendido vira fã. CTA: conheça a Evotalks.",
        roteiro:
          "Gancho (0-3s): O que faz um cliente voltar? Não é só o preço.\nDesenvolvimento: mostrar atendimento rápido e omnichannel.\nCTA: atenda melhor com a Evotalks.",
        legenda: "No Dia do Consumidor, lembre-se: quem é bem atendido, volta e indica.",
      },
      brusoft: {
        titulo: "Dia do Consumidor: a experiência começa na TI",
        tipo: "post",
        canais: ["linkedin"],
        briefing:
          "Objetivo: autoridade. Público: decisores. Sistema lento afasta cliente. CTA: falar com especialista.",
        legenda: "Uma boa experiência do consumidor depende de uma TI que não deixa nada cair.",
      },
    },
  },
  {
    id: "backup",
    nome: "Dia Mundial do Backup",
    mes: 3,
    dia: 31,
    emoji: "💾",
    sugestoes: {
      brusoft: {
        titulo: "Dia Mundial do Backup: você confia no seu?",
        tipo: "reels",
        canais: ["instagram", "facebook", "youtube"],
        briefing:
          "Objetivo: urgência. Gancho: backup que nunca foi testado é só esperança. CTA: agendar diagnóstico de backup.",
        roteiro:
          "Gancho (0-3s): Quando foi a última vez que você testou o seu backup?\nDesenvolvimento: mostrar o risco de perder tudo e a regra 3-2-1.\nCTA: a Brusoft cuida do seu backup.",
        legenda: "31 de março é o Dia Mundial do Backup. Backup que nunca foi testado é só esperança.",
      },
    },
  },
  {
    id: "dia-internet",
    nome: "Dia da Internet",
    mes: 5,
    dia: 17,
    emoji: "🌐",
    sugestoes: {
      brusoft: {
        titulo: "Dia da Internet: conectividade segura",
        tipo: "post",
        canais: ["instagram", "linkedin"],
        briefing:
          "Objetivo: autoridade. Internet rápida e segura como base do negócio. CTA: conheça os planos de TI.",
        legenda: "A internet conecta tudo. No Dia da Internet, garanta a sua com segurança e estabilidade.",
      },
      evotalks: {
        titulo: "Dia da Internet: seu cliente está em todos os canais",
        tipo: "carrossel",
        canais: ["instagram", "linkedin"],
        briefing:
          "Objetivo: educar sobre omnichannel. Gancho: o cliente não escolhe um canal, usa todos. CTA: conheça a Evotalks.",
        legenda: "No Dia da Internet, lembre: seu cliente fala por WhatsApp, Insta, e-mail e chat. Esteja em todos.",
      },
    },
  },
  {
    id: "meio-ambiente",
    nome: "Dia do Meio Ambiente",
    mes: 6,
    dia: 5,
    emoji: "🌱",
    sugestoes: {
      brusoft: {
        titulo: "TI verde: tecnologia que respeita o planeta",
        tipo: "post",
        canais: ["instagram", "linkedin"],
        briefing:
          "Objetivo: ESG e institucional. Nuvem e virtualização reduzem desperdício. CTA: comentar.",
        legenda: "Tecnologia também pode ser sustentável. No Dia do Meio Ambiente, conheça a TI verde.",
      },
      evotalks: {
        titulo: "Atendimento digital também é sustentável",
        tipo: "post",
        canais: ["instagram", "linkedin"],
        briefing:
          "Objetivo: ESG. Atendimento digital reduz papel e deslocamento. CTA: comentar.",
        legenda: "Menos papel, mais resolução. O atendimento digital também cuida do planeta.",
      },
    },
  },
  {
    id: "namorados",
    nome: "Dia dos Namorados",
    mes: 6,
    dia: 12,
    emoji: "💌",
    sugestoes: {
      brusoft: {
        titulo: "A relação com o seu cliente também se cuida",
        tipo: "post",
        canais: ["instagram", "linkedin"],
        briefing:
          "Objetivo: relacionamento. Comparar parceria de TI com um bom relacionamento. CTA: vamos conversar.",
        legenda: "No Dia dos Namorados, lembramos: parceria boa de TI também é questão de confiança.",
      },
      evotalks: {
        titulo: "Como fazer seu cliente se apaixonar pelo atendimento",
        tipo: "reels",
        canais: ["instagram", "facebook"],
        briefing:
          "Objetivo: engajamento. Gancho: cliente apaixonado vira promotor. CTA: encante com a Evotalks.",
        legenda: "Cliente bem atendido se apaixona e indica. Feliz Dia dos Namorados!",
      },
    },
  },
  {
    id: "profissional-informatica",
    nome: "Dia do Profissional de Informática",
    mes: 8,
    dia: 19,
    emoji: "💻",
    sugestoes: {
      brusoft: {
        titulo: "Bastidores de quem cuida da sua TI",
        tipo: "reels",
        canais: ["instagram", "youtube"],
        briefing:
          "Objetivo: humanizar a marca. Mostrar o time da Brusoft. CTA: seguir o perfil.",
        roteiro:
          "Cena 1: time monitorando ambientes.\nCena 2: analista resolvendo um chamado.\nTexto: por trás de toda TI que funciona, tem gente que ama o que faz.",
        legenda: "Hoje é o Dia do Profissional de Informática. Um viva ao time que mantém tudo no ar!",
      },
    },
  },
  {
    id: "dia-programador",
    nome: "Dia do Programador",
    mes: 9,
    dia: 13,
    emoji: "👨‍💻",
    sugestoes: {
      brusoft: {
        titulo: "Dia do Programador: o código por trás da gestão de TI",
        tipo: "post",
        canais: ["instagram", "linkedin"],
        briefing:
          "Objetivo: autoridade técnica. Homenagear devs e mostrar automação. CTA: comentar.",
        legenda: "Por trás de cada automação que economiza horas, tem um programador. Feliz Dia do Programador!",
      },
    },
  },
  {
    id: "dia-cliente",
    nome: "Dia do Cliente",
    mes: 9,
    dia: 15,
    emoji: "⭐",
    sugestoes: {
      evotalks: {
        titulo: "Dia do Cliente: quem é bem atendido, volta",
        tipo: "carrossel",
        canais: ["instagram", "facebook", "linkedin"],
        briefing:
          "Objetivo: prova de valor. Mostrar boas práticas de atendimento. CTA: conheça a Evotalks.",
        legenda: "No Dia do Cliente, celebramos quem confia na gente. Atendimento bom fideliza.",
      },
      brusoft: {
        titulo: "Dia do Cliente: obrigado por confiar sua TI a gente",
        tipo: "post",
        canais: ["instagram", "linkedin"],
        briefing:
          "Objetivo: relacionamento. Agradecer aos clientes. CTA: comentar.",
        legenda: "No Dia do Cliente, o nosso obrigado a quem confia a TI da empresa à Brusoft.",
      },
    },
  },
  {
    id: "dia-vendedor",
    nome: "Dia do Vendedor",
    mes: 10,
    dia: 1,
    emoji: "🤝",
    sugestoes: {
      evotalks: {
        titulo: "Dia do Vendedor: venda mais com bom atendimento",
        tipo: "reels",
        canais: ["instagram", "linkedin"],
        briefing:
          "Objetivo: gerar leads. Gancho: atendimento ágil fecha mais vendas. CTA: conheça a Evotalks.",
        legenda: "Vendedor bom sabe: atendimento rápido fecha negócio. Feliz Dia do Vendedor!",
      },
    },
  },
  {
    id: "dia-professor",
    nome: "Dia do Professor",
    mes: 10,
    dia: 15,
    emoji: "📚",
    sugestoes: {
      brusoft: {
        titulo: "Tecnologia que apoia quem ensina",
        tipo: "post",
        canais: ["instagram", "linkedin"],
        briefing:
          "Objetivo: institucional. TI estável para escolas e professores. CTA: comentar e marcar um professor.",
        legenda: "No Dia do Professor, homenageamos quem ensina, com a tecnologia como aliada.",
      },
    },
  },
  {
    id: "consciencia-negra",
    nome: "Dia da Consciência Negra",
    mes: 11,
    dia: 20,
    emoji: "✊",
    sugestoes: {
      brusoft: {
        titulo: "Dia da Consciência Negra",
        tipo: "post",
        canais: ["instagram", "linkedin", "facebook"],
        briefing:
          "Objetivo: institucional. Mensagem de respeito e diversidade. Tom sóbrio. CTA: refletir e compartilhar.",
        legenda: "Hoje é dia de reflexão, respeito e valorização da cultura negra.",
      },
      evotalks: {
        titulo: "Dia da Consciência Negra",
        tipo: "post",
        canais: ["instagram", "linkedin", "facebook"],
        briefing:
          "Objetivo: institucional. Mensagem de respeito e diversidade. Tom sóbrio. CTA: refletir e compartilhar.",
        legenda: "Hoje é dia de reflexão, respeito e valorização da cultura negra.",
      },
    },
  },
  {
    id: "seguranca-informacao",
    nome: "Dia da Segurança da Informação",
    mes: 11,
    dia: 30,
    emoji: "🛡️",
    sugestoes: {
      brusoft: {
        titulo: "Dia da Segurança da Informação: proteja o que importa",
        tipo: "carrossel",
        canais: ["instagram", "linkedin", "facebook"],
        briefing:
          "Objetivo: autoridade. Checklist de segurança para empresas. CTA: agendar avaliação de segurança.",
        roteiro:
          "Slide 1: por que sua empresa é alvo.\nSlide 2: senhas e 2FA.\nSlide 3: backup.\nSlide 4: treinar o time.\nSlide 5: CTA Brusoft.",
        legenda: "No Dia da Segurança da Informação, pergunte: sua empresa está mesmo protegida?",
      },
    },
  },
  {
    id: "natal",
    nome: "Natal",
    mes: 12,
    dia: 25,
    emoji: "🎄",
    sugestoes: {
      brusoft: {
        titulo: "Mensagem de Natal da Brusoft",
        tipo: "post",
        canais: ["instagram", "linkedin", "facebook"],
        briefing:
          "Objetivo: relacionamento. Mensagem de agradecimento aos clientes e parceiros. CTA: nenhuma, só carinho.",
        legenda: "Que o Natal traga paz e descanso. Obrigado por confiar na Brusoft em 2026.",
      },
      evotalks: {
        titulo: "Mensagem de Natal da Evotalks",
        tipo: "post",
        canais: ["instagram", "linkedin", "facebook"],
        briefing:
          "Objetivo: relacionamento. Mensagem de agradecimento. CTA: nenhuma, só carinho.",
        legenda: "Feliz Natal! Obrigado por atender, conversar e crescer com a gente em 2026.",
      },
    },
  },
];

/**
 * Calcula a proxima ocorrencia de uma data comemorativa a partir de hoje.
 * Se a data ja passou neste ano, usa o ano seguinte.
 */
export function ocorrenciaMaisProxima(
  d: DataComemorativa,
  hoje: Date
): { chave: string; dias: number } {
  const hojeMeiaNoite = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  let ocor = new Date(hoje.getFullYear(), d.mes - 1, d.dia);
  if (ocor < hojeMeiaNoite) {
    ocor = new Date(hoje.getFullYear() + 1, d.mes - 1, d.dia);
  }
  const dias = Math.round((ocor.getTime() - hojeMeiaNoite.getTime()) / 86400000);
  return { chave: chaveData(ocor), dias };
}

/** Texto amigavel de contagem regressiva. */
export function textoContagem(dias: number): string {
  if (dias === 0) return "Hoje";
  if (dias === 1) return "Amanhã";
  return `Em ${dias} dias`;
}
