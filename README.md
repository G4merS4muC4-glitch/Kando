# Kando (by Brusoft)

Kando e o painel web de gestao de conteudo de redes sociais (estilo Trello/Kanban)
do time de marketing, atendendo as marcas **Brusoft** e **Evotalks**. As campanhas
ficam na tela inicial; cada campanha tem o seu proprio quadro Kanban de Reels,
Posts, Carrosseis e Stories.

## Como rodar

```bash
npm install
npm run dev
```

Abra http://localhost:3000 no navegador.

Para a versao de producao:

```bash
npm run build
npm run start
```

## Stack

- Next.js 14 (App Router) + TypeScript estrito
- Tailwind CSS (paleta, tipografia e animacoes da marca)
- dnd-kit (arrastar e soltar no quadro e no calendario, com suporte a teclado)
- lucide-react (icones)
- Persistencia em localStorage, isolada em `lib/storage.ts`

## Telas (rotas)

- `/` Campanhas: grade unica com filtro de marca (Todas, Brusoft, Evotalks).
  Cada campanha mostra progresso (postados) e abre o seu quadro.
- `/campanha/[id]` Quadro Kanban da campanha (seis etapas), com busca, filtros,
  novo conteudo e "Colar do Claude".
- `/calendario` Calendario geral com todos os conteudos por data, cor por marca.

## Funcionalidades

- Campanhas (criar, editar, excluir) por marca e tipo (geral ou bimestral).
- Quadro com seis colunas: Ideias, Briefing e Roteiro, Em Producao, Revisao de
  Marca, Aprovado e Agendado, Publicado.
- Tipos de conteudo: Reels, Post, Carrossel, Stories, Material Rico, E-book e
  Projeto.
- Projeto: um card com um fluxo de producao proprio. Abre a aba "Projeto" com
  fases (etapas de producao) ligadas como um fluxo, e dentro de cada fase voce
  cria tarefas simples ("Ver medidas") com um marcador de concluido. Um anel de
  progresso geral e uma barra por fase mostram o quanto ja foi feito; da para
  arrastar tarefas entre as fases. No quadro, o card de projeto mostra o
  progresso no lugar dos canais. Crie pelo botao "Projeto" na barra da campanha.
- Criar, editar, arrastar e excluir cards. Arrastar persiste a etapa.
- Acao rapida no card: concluir (vai para Aprovado), postar (vai para Publicado)
  e reabrir. Conteudo postado fica verde com um check grande sobreposto.
- Modal com abas Visao Geral, Briefing, Roteiro e Legenda (salvamento automatico).
  - Roteiro com botao Copiar e modo Teleprompter (tela cheia, auto-scroll).
  - Legenda com contador de caracteres (Instagram e Facebook 2.200, LinkedIn 3.000,
    YouTube 5.000).
- Canais: Instagram, Facebook, LinkedIn e YouTube.
- "Colar do Claude": cola um texto, interpreta titulo, tipo, canais, tema, data,
  briefing, roteiro e legenda, mostra uma previa e cria um ou varios cards.
- Calendario: arraste um conteudo "Sem data" para um dia para agendar (com
  animacao), ou para a lista "Sem data" para desagendar.
- Datas comemorativas marcadas no calendario (TI e seguranca para a Brusoft;
  cliente, consumidor e vendas para a Evotalks; alem de datas gerais), com um
  painel de lembretes "Proximas datas" e uma sugestao de conteudo por marca que
  vira card agendado com um clique. O catalogo fica em `lib/datasComemorativas.ts`.
- Filtros por tipo, canal e tema, combinados com a busca por titulo.
- Indicador de prazo vencido e contador de cards por coluna.

## Modos de uso: local ou com login (Supabase)

O app funciona de dois jeitos, sem mudar a interface:

- **Local (padrao):** sem variaveis de ambiente do Supabase, os dados ficam no
  `localStorage` do navegador. Bom para testar; nao tem login nem dados
  compartilhados entre pessoas.
- **Com login (Supabase):** com as variaveis configuradas, os dados ficam num
  banco compartilhado pela equipe, com login e sincronizacao em tempo real
  (quando alguem salva, o quadro atualiza para quem mais estiver com ele aberto).

Toda a persistencia passa por `lib/storage.ts` (`carregarBoard`, `salvarBoard`,
`assinarBoard`), entao da para evoluir sem tocar nos componentes.

## Publicar de graca: Supabase (login + dados) + Vercel (hospedagem)

### 1. Criar o projeto no Supabase
1. Crie uma conta em https://supabase.com e um novo projeto (plano free).
2. Em **SQL Editor**, rode o conteudo de `supabase/schema.sql` (cria a tabela
   `boards`, as politicas de seguranca e habilita o tempo real).
3. Em **Authentication > Users**, clique em **Add user** e crie as contas do
   time de marketing (e-mail e senha). Marque **Auto Confirm User** ao criar
   (ou, em **Authentication > Providers > Email**, desligue a confirmacao por
   e-mail) para o usuario conseguir entrar logo. Para um painel interno, deixe
   o cadastro publico desativado e crie os usuarios so aqui.
4. Em **Project Settings > API**, copie a **Project URL** e a **anon public key**.

### 2. Rodar localmente com login (opcional)
1. Copie `.env.local.example` para `.env.local` e preencha a URL e a anon key.
2. `npm run dev` e acesse http://localhost:3000 (vai pedir login).

### 3. Publicar na Vercel
1. Suba o projeto para um repositorio no **GitHub**.
2. Em https://vercel.com, importe o repositorio (a Vercel detecta o Next.js).
3. Em **Environment Variables**, adicione `NEXT_PUBLIC_SUPABASE_URL` e
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` com os valores do Supabase.
4. **Deploy.** A cada `git push`, a Vercel publica a nova versao automaticamente.

Observacao: o plano gratis da Vercel (Hobby) e voltado a uso pessoal; para uso
comercial o indicado e o plano Pro. Alternativas gratuitas: Cloudflare Pages ou
Netlify.

## Publicar direto no Facebook e Instagram (automatico)

Os cards podem ser publicados sozinhos no horario agendado, no Facebook e no
Instagram. No card (aba Visao Geral, secao "Publicacao automatica") voce marca
os canais, cola o link publico da midia, define data e horario e clica em
"Agendar publicacao automatica" (o card fica com status "agendado").

Um robo no Supabase (Edge Function `supabase/functions/publicar-posts`, chamado
pelo agendador `supabase/cron.sql` a cada 5 minutos) verifica os cards agendados
cujo horario chegou e publica via Graph API da Meta. Ao publicar, o card vira
"Publicado" (verde); se falhar, mostra o motivo para tentar de novo.

A configuracao do app da Meta e dos tokens (passo manual, feito uma vez) esta no
guia **`META_SETUP.md`**. Os tokens ficam apenas nos secrets das Edge Functions,
nunca no app nem no banco acessado pelo time. LinkedIn e YouTube nao entram nesta
automacao.

## Compartilhar um card por link publico

No card, o botao **Compartilhar** gera um link publico (rota `/c/[token]`) que
mostra apenas os blocos que voce escolher (visao geral, briefing, roteiro,
teleprompter, legenda, projeto). Opcoes por link: **codigo (PIN)**, **validade**
e **revogar** a qualquer momento.

A unica excecao a regra de somente leitura: voce pode **liberar a edicao do
teleprompter**. Aí o visitante (ex: o ator, no celular) ajusta so as falas, e a
mudanca reflete no card do time em tempo real. O card guarda a versao anterior,
entao da para **Reverter** o ajuste, e mostra quando o teleprompter foi alterado
por um link.

Como funciona por baixo: o acesso publico passa por endpoints no servidor
(`app/api/share/...`) que usam a service role e so aceitam o que o link permite
(escopo fechado, PIN quando houver, limite de taxa). Requer:

1. Rodar `supabase/share.sql` no SQL Editor (cria a tabela `compartilhamentos`).
2. Adicionar `SUPABASE_SERVICE_ROLE_KEY` nas variaveis de ambiente da Vercel
   (server-only, ver `.env.local.example`).

So funciona no site publicado (Supabase). No modo local o botao fica desabilitado.

## Migrar para um banco relacional no futuro

Hoje o quadro inteiro e salvo como um documento JSON (simples e ideal para um
time pequeno). Se um dia houver muitos editores ao mesmo tempo, da para migrar
`boards` para tabelas relacionais (campanhas e cards) reimplementando apenas o
`lib/storage.ts`, sem mexer na interface.

## Importar conteudo do Claude (formato sugerido)

Peca ao Claude para responder neste formato (separe varios conteudos com uma
linha de tracos `---`):

```
Titulo: ...
Tipo: Reels | Post | Carrossel | Stories | Material Rico | E-book | Projeto
Canais: Instagram, Facebook, LinkedIn, YouTube
Tema: ...
Data: dd/mm/aaaa
Briefing: ...
Roteiro: ...
Teleprompter: (apenas as falas, sem indicacoes de cena)
Legenda: ...
```

## Notas

- A interface usa a fonte Sora (Google Fonts) e nao usa travessao (em-dash) em
  textos visiveis.
- A chave do localStorage e versionada (`...:v2`); dados antigos do formato
  anterior nao conflitam.
