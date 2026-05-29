# Publicar direto no Facebook e Instagram (configuracao da Meta)

Este guia e a SUA parte: criar o app na Meta e gerar as chaves (tokens) das
paginas. O robo que publica no horario ja esta pronto no projeto (em
`supabase/functions/publicar-posts`); ele so precisa dessas chaves.

Voce vai postar nas SUAS proprias paginas (Brusoft e Evotalks) sendo
administrador, entao NAO precisa da revisao completa do app da Meta (que e
demorada). Basta o app ficar em modo de Desenvolvimento e voce ser admin.

No fim, voce vai me passar 6 valores (3 por marca). Guarde-os com cuidado: sao
senhas de publicacao.

---

## 0. Pre-requisitos (voce ja confirmou que tem)

- Uma Pagina do Facebook para cada marca (Brusoft e Evotalks).
- Uma conta do Instagram Business ou Creator ligada a cada Pagina.
- Voce e administrador das duas Paginas.

---

## 1. Criar o app na Meta

1. Acesse https://developers.facebook.com e entre com a sua conta do Facebook.
2. Menu **Meus Apps** > **Criar app**.
3. Em tipo de app, escolha **Empresa** (Business).
4. De um nome (ex: "Kando Publicador") e crie.

## 2. Adicionar os produtos

No painel do app, em **Adicionar produtos**, adicione:

- **Login do Facebook** (Facebook Login).
- **API do Instagram** (Instagram Graph API).

## 3. Pegar o App ID e o App Secret

Em **Configuracoes do app** > **Basico**:

- Anote o **ID do aplicativo** (App ID).
- Clique em **Mostrar** no **Chave secreta do app** (App Secret) e anote.

(O App Secret e usado so uma vez, para gerar o token de longa duracao.)

## 4. Gerar um token de usuario com as permissoes certas

1. Abra o **Explorador da Graph API**:
   https://developers.facebook.com/tools/explorer
2. No topo, em **Aplicativo da Meta**, selecione o seu app.
3. Clique em **Gerar token de acesso** e, na janela, marque estas permissoes:
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `instagram_basic`
   - `instagram_content_publish`
   - `business_management`
4. Confirme e faca login. Vai aparecer um token (token de usuario, curto).

## 5. Descobrir o ID da Pagina e o ID do Instagram de cada marca

Ainda no Explorador da Graph API, com o token gerado:

1. Na caixa de consulta, rode: `me/accounts`
   - A resposta lista suas Paginas. Para cada marca, anote o campo **`id`**
     (esse e o **ID da Pagina** do Facebook).
2. Para descobrir o Instagram ligado a cada Pagina, rode:
   `{ID_DA_PAGINA}?fields=instagram_business_account,name`
   - Troque `{ID_DA_PAGINA}` pelo id do passo anterior.
   - Anote o **`instagram_business_account.id`** (esse e o **ID do Instagram**).

## 6. Gerar o token de LONGA duracao da Pagina

O token do passo 4 expira rapido. Vamos gerar um que dura muito (na pratica, o
token de Pagina derivado de um token de usuario de longa duracao nao expira
enquanto a permissao nao for revogada).

1. Troque o token de usuario curto por um de longa duracao. No navegador, abra
   (numa linha so, trocando os 3 valores):

   ```
   https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=SEU_APP_ID&client_secret=SEU_APP_SECRET&fb_exchange_token=SEU_TOKEN_CURTO
   ```

   A resposta traz `access_token`: esse e o **token de usuario de longa
   duracao**. Copie.

2. Volte ao Explorador da Graph API, cole esse token de longa duracao no campo
   de token (canto direito) e rode de novo: `me/accounts`
   - Agora o `access_token` que aparece para CADA Pagina e o **token de Pagina
     de longa duracao**. Anote o de cada marca.

## 7. O que anotar (6 valores)

Para cada marca, voce tera 3 coisas:

| Marca    | ID da Pagina (FB) | Token da Pagina (longa duracao) | ID do Instagram |
|----------|-------------------|---------------------------------|-----------------|
| Brusoft  | ...               | ...                             | ...             |
| Evotalks | ...               | ...                             | ...             |

---

## 8. Guardar as chaves no Supabase (Edge Function Secrets)

No painel do Supabase do projeto: **Edge Functions** > **Manage secrets** (ou
**Project Settings > Edge Functions > Secrets**), adicione estas variaveis:

```
META_API_VERSION=v21.0

BRUSOFT_FB_PAGE_ID=...
BRUSOFT_FB_TOKEN=...
BRUSOFT_IG_USER_ID=...

EVOTALKS_FB_PAGE_ID=...
EVOTALKS_FB_TOKEN=...
EVOTALKS_IG_USER_ID=...
```

(As variaveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` ja existem
automaticamente no ambiente das Edge Functions; nao precisa adicionar.)

> IMPORTANTE: esses tokens NUNCA ficam no app/site nem no banco de dados que o
> time acessa. Eles vivem so aqui, no servidor das Edge Functions.

---

## 9. Subir o robo e ligar o agendador

Quando os secrets estiverem no Supabase, me avise.

Opcao A (mais facil, sem instalar nada): no painel do Supabase, **Edge
Functions** > **Create a function**, nome `publicar-posts`, e cole o conteudo de
`supabase/functions/publicar-posts/index.ts`. Salve e faca o Deploy ali mesmo.

Opcao B (Supabase CLI):

```bash
# instalar o CLI uma vez: https://supabase.com/docs/guides/cli
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy publicar-posts
```

Depois, no **SQL Editor** do Supabase, rode o conteudo de `supabase/cron.sql`
(ele liga o agendador para chamar o robo a cada 5 minutos). Esse arquivo tem 2
valores para preencher no topo (a URL do projeto e a chave service role),
explicados la dentro.

---

## 10. Como usar no dia a dia

No card do conteudo, na aba **Visao Geral**, secao **Publicacao automatica**:

1. Marque os canais **Facebook** e/ou **Instagram**.
2. Cole o **link publico** da imagem ou video (precisa abrir direto no
   navegador, sem login. Ex: link de um site, do Supabase Storage, ou do Drive
   com "qualquer um com o link").
3. Defina a **data** e o **horario** de publicacao.
4. Clique em **Agendar publicacao automatica**.

O robo publica no horario, marca o card como **Publicado** (fica verde) e, se
algo der errado, mostra o motivo no proprio card para voce tentar de novo.

### Limites e observacoes
- Imagem (JPG/PNG) e video curto (MP4) funcionam. No Instagram, video entra
  como **Reels**.
- O link da midia precisa ser publico e direto (a Meta baixa o arquivo).
- O Instagram permite cerca de 25 a 50 publicacoes por dia, por conta.
- LinkedIn e YouTube nao entram nessa automacao (a Meta cuida so de FB e IG).
- Reels nativo do Facebook (aba Reels) virao numa etapa seguinte; por enquanto
  video no Facebook entra como video normal do feed.
