-- Schema do Supabase para o painel Conteudo Brusoft.
-- Cole e rode isto no Supabase: menu "SQL Editor" > New query > Run.

-- O quadro inteiro (campanhas + cards) e guardado como um documento JSON numa
-- unica linha compartilhada pelo time. Simples e suficiente para poucos usuarios.
create table if not exists public.boards (
  id text primary key,
  dados jsonb not null default '{"campanhas":[],"cards":[]}'::jsonb,
  cliente_id text,
  atualizado_em timestamptz not null default now()
);

-- Seguranca: liga o RLS e permite que qualquer usuario AUTENTICADO leia e grave.
alter table public.boards enable row level security;

drop policy if exists "ler board (autenticado)" on public.boards;
create policy "ler board (autenticado)"
  on public.boards for select
  to authenticated
  using (true);

drop policy if exists "inserir board (autenticado)" on public.boards;
create policy "inserir board (autenticado)"
  on public.boards for insert
  to authenticated
  with check (true);

drop policy if exists "atualizar board (autenticado)" on public.boards;
create policy "atualizar board (autenticado)"
  on public.boards for update
  to authenticated
  using (true)
  with check (true);

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
