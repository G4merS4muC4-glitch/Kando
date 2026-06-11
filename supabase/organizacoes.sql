-- Organizacoes (multiempresa) para o Kando.
-- Cole e rode no Supabase: SQL Editor > New query > Run.
--
-- ORDEM DE EXECUCAO:
--   1) Rode ESTE arquivo (cria tabelas, colunas, a funcao eh_membro e as RPCs).
--   2) Rode supabase/migracao-organizacoes.sql (migra os dados atuais da Brusoft
--      e SO ENTAO troca as policies de boards/compartilhamentos para o modelo por
--      organizacao). Essa ordem evita travar o seu proprio acesso.
--   3) Suba o codigo novo do app.
--
-- Modelo: cada organizacao guarda seus dados como documentos JSON na tabela
-- boards ja existente, agora com um id por organizacao:
--   principal:<org>            -> { marcas, campanhas, cards }
--   apontamentos:<org>         -> { registros }
--   metricas:<org>:<marcaId>   -> metricas do Instagram daquela marca
-- A coluna org_id carimba cada linha para o RLS isolar por organizacao.

-- ----------------------------------------------------------------------------
-- Tabelas de organizacao
-- ----------------------------------------------------------------------------

create table if not exists public.organizations (
  id text primary key,
  nome text not null,
  criado_por uuid references auth.users(id),
  criado_em timestamptz not null default now()
);

create table if not exists public.org_members (
  org_id text references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  papel text not null default 'membro' check (papel in ('dono', 'membro')),
  criado_em timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table if not exists public.org_convites (
  id text primary key,
  org_id text references public.organizations(id) on delete cascade,
  email text not null,
  papel text not null default 'membro' check (papel in ('dono', 'membro')),
  aceito boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists idx_org_convites_email on public.org_convites (lower(email));

-- Colunas org_id nas tabelas existentes (idempotente).
alter table public.boards add column if not exists org_id text references public.organizations(id);
create index if not exists idx_boards_org on public.boards (org_id);

alter table public.compartilhamentos add column if not exists org_id text references public.organizations(id);
create index if not exists idx_compartilhamentos_org on public.compartilhamentos (org_id);

-- ----------------------------------------------------------------------------
-- Funcao de pertinencia (CRITICA para o isolamento).
-- SECURITY DEFINER: roda como dona da funcao e ignora o RLS de org_members.
-- Isso e o que evita o erro classico de recursao quando uma policy de
-- org_members consulta a propria org_members.
-- ----------------------------------------------------------------------------
create or replace function public.eh_membro(p_org text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1 from public.org_members
    where org_id = p_org and user_id = auth.uid()
  );
$$;

-- ----------------------------------------------------------------------------
-- RLS das tabelas de organizacao
-- ----------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
alter table public.org_convites enable row level security;

-- Organizacao: o membro ve a sua. Criar/alterar e feito via RPC (SECURITY
-- DEFINER), entao nao ha policy de insert/update aqui.
drop policy if exists "ver organizacao (membro)" on public.organizations;
create policy "ver organizacao (membro)"
  on public.organizations for select
  to authenticated
  using (public.eh_membro(id));

-- Membros: o membro ve os colegas da mesma organizacao.
drop policy if exists "ver membros (membro)" on public.org_members;
create policy "ver membros (membro)"
  on public.org_members for select
  to authenticated
  using (public.eh_membro(org_id));

-- Convites: o membro ve os convites da sua org; o convidado ve os enderecados a
-- ele (pelo e-mail do token). Criar/alterar e via RPC/rota com service role.
drop policy if exists "ver convites" on public.org_convites;
create policy "ver convites"
  on public.org_convites for select
  to authenticated
  using (
    public.eh_membro(org_id)
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- ----------------------------------------------------------------------------
-- RPCs
-- ----------------------------------------------------------------------------

-- Cria uma organizacao com o quadro vazio e ja adiciona o criador como dono,
-- tudo numa transacao (resolve o impasse de RLS na criacao).
create or replace function public.criar_organizacao(p_nome text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  novo text;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'sem usuario autenticado';
  end if;
  if coalesce(btrim(p_nome), '') = '' then
    raise exception 'nome da organizacao vazio';
  end if;

  novo := 'org-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);

  insert into public.organizations (id, nome, criado_por)
  values (novo, btrim(p_nome), uid);

  insert into public.org_members (org_id, user_id, papel)
  values (novo, uid, 'dono');

  insert into public.boards (id, dados, cliente_id, org_id, atualizado_em)
  values (
    'principal:' || novo,
    '{"marcas":[],"campanhas":[],"cards":[]}'::jsonb,
    'criacao',
    novo,
    now()
  );

  return novo;
end;
$$;

-- Aplica os convites pendentes do usuario logado (casados pelo e-mail). Chamada
-- no carregamento do app. Retorna quantos convites foram aplicados.
create or replace function public.aplicar_convites()
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  mail text := lower(coalesce(auth.jwt() ->> 'email', ''));
  aplicados int := 0;
begin
  if uid is null or mail = '' then
    return 0;
  end if;

  with pend as (
    select id, org_id, papel
    from public.org_convites
    where aceito = false and lower(email) = mail
  ), ins as (
    insert into public.org_members (org_id, user_id, papel)
    select org_id, uid, papel from pend
    on conflict (org_id, user_id) do nothing
    returning org_id
  )
  update public.org_convites c
  set aceito = true
  from pend
  where c.id = pend.id;

  get diagnostics aplicados = row_count;
  return aplicados;
end;
$$;

grant execute on function public.criar_organizacao(text) to authenticated;
grant execute on function public.aplicar_convites() to authenticated;
grant execute on function public.eh_membro(text) to authenticated;
