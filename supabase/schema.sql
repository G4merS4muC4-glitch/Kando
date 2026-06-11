-- Schema do Supabase para o painel Kando.
-- Cole e rode isto no Supabase: menu "SQL Editor" > New query > Run.
--
-- DEPENDENCIA (modo multiempresa): as policies abaixo usam a coluna org_id e a
-- funcao public.eh_membro, criadas por supabase/organizacoes.sql. Para uma
-- instalacao nova, rode organizacoes.sql logo depois de criar esta tabela. As
-- policies ja sao a versao isolada por organizacao (seguro re-rodar este arquivo
-- depois da migracao).

-- O quadro de cada organizacao (marcas + campanhas + cards) e guardado como um
-- documento JSON, uma linha por organizacao (id = principal:<org>). A coluna
-- org_id carimba a linha para o RLS isolar por organizacao.
create table if not exists public.boards (
  id text primary key,
  dados jsonb not null default '{"marcas":[],"campanhas":[],"cards":[]}'::jsonb,
  cliente_id text,
  atualizado_em timestamptz not null default now()
);
-- Multiempresa: coluna org_id (FK criada em organizacoes.sql).
alter table public.boards add column if not exists org_id text;

-- Seguranca: liga o RLS. Cada membro so le e grava as linhas da sua organizacao.
alter table public.boards enable row level security;

drop policy if exists "ler board (autenticado)" on public.boards;
drop policy if exists "inserir board (autenticado)" on public.boards;
drop policy if exists "atualizar board (autenticado)" on public.boards;

drop policy if exists "ler board (org)" on public.boards;
create policy "ler board (org)"
  on public.boards for select
  to authenticated
  using (public.eh_membro(org_id));

drop policy if exists "inserir board (org)" on public.boards;
create policy "inserir board (org)"
  on public.boards for insert
  to authenticated
  with check (org_id is not null and public.eh_membro(org_id));

drop policy if exists "atualizar board (org)" on public.boards;
create policy "atualizar board (org)"
  on public.boards for update
  to authenticated
  using (public.eh_membro(org_id))
  with check (public.eh_membro(org_id));

-- Garante que o evento de realtime traga a linha completa (com os dados).
alter table public.boards replica identity full;

-- Sincronizacao em tempo real (para o app atualizar quando outra pessoa salva).
-- Idempotente: nao quebra se a tabela ja estiver na publicacao.
do $$
begin
  alter publication supabase_realtime add table public.boards;
exception
  when duplicate_object then null;
end
$$;
