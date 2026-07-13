-- Timers de trabalho EM ANDAMENTO, compartilhados em tempo real com a equipe.
-- Cole e rode no Supabase: SQL Editor > New query > Run.
--
-- DEPENDENCIA: usa org_id/organizations e a funcao public.eh_membro, criadas por
-- supabase/organizacoes.sql. Rode aquele antes.
--
-- Cada pessoa tem no maximo um timer ativo por organizacao (PK org_id+user_id).
-- Os MEMBROS da organizacao veem todos os timers ativos dela (para acompanhar
-- quem esta trabalhando em que, ao vivo); cada um so escreve/apaga o SEU. Ao
-- parar o timer, a linha e apagada (o registro final vai para os apontamentos).

create table if not exists public.timers_ativos (
  org_id text not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  dados jsonb not null default '{}'::jsonb, -- o TimerAtivo (inicio, pausas, checkpoints, autor)
  atualizado_em timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists idx_timers_ativos_org on public.timers_ativos (org_id);

alter table public.timers_ativos enable row level security;

-- Leitura: qualquer membro da organizacao ve todos os timers ativos dela.
drop policy if exists "ver timers (org)" on public.timers_ativos;
create policy "ver timers (org)"
  on public.timers_ativos for select
  to authenticated using (public.eh_membro(org_id));

-- Escrita: cada um so cria/atualiza/apaga o SEU proprio timer (user_id = auth.uid()).
drop policy if exists "inserir timers (dono)" on public.timers_ativos;
create policy "inserir timers (dono)"
  on public.timers_ativos for insert
  to authenticated
  with check (org_id is not null and user_id = auth.uid() and public.eh_membro(org_id));

drop policy if exists "atualizar timers (dono)" on public.timers_ativos;
create policy "atualizar timers (dono)"
  on public.timers_ativos for update
  to authenticated
  using (user_id = auth.uid() and public.eh_membro(org_id))
  with check (user_id = auth.uid() and public.eh_membro(org_id));

drop policy if exists "excluir timers (dono)" on public.timers_ativos;
create policy "excluir timers (dono)"
  on public.timers_ativos for delete
  to authenticated using (user_id = auth.uid() and public.eh_membro(org_id));

-- Realtime: o payload precisa trazer a linha completa (inclusive no DELETE, para o
-- app saber qual timer sumiu). replica identity full + adicionar a publication.
alter table public.timers_ativos replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.timers_ativos;
exception
  when duplicate_object then null;
end
$$;
