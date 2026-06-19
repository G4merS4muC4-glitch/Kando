-- Links de sugestao de ideias (caixa de entrada publica por campanha).
-- Cole e rode no Supabase: SQL Editor > New query > Run.
--
-- DEPENDENCIA: usa a coluna org_id/organizations e a funcao public.eh_membro,
-- criadas por supabase/organizacoes.sql. Rode aquele antes.
--
-- Um colega (logado ou nao) abre /sugerir/<token>, manda uma ideia de video com
-- link de referencia, e ela vira um card na coluna Inicial da campanha do link,
-- marcado como sugestao externa. O envio publico NAO passa por estas policies:
-- e feito pelo endpoint do servidor (Route Handler) com a service role.

create table if not exists public.sugestao_links (
  token text primary key,
  org_id text references public.organizations(id) on delete cascade,
  campanha_id text not null, -- campanha de destino (a ideia cai na coluna inicial dela)
  revogado boolean not null default false,
  criado_em timestamptz not null default now(),
  ultima_em timestamptz -- ultimo envio, para um limite simples anti-spam
);
create index if not exists idx_sugestao_links_campanha on public.sugestao_links (campanha_id);
create index if not exists idx_sugestao_links_org on public.sugestao_links (org_id);

alter table public.sugestao_links enable row level security;

-- Apenas os MEMBROS da organizacao do link o gerenciam (criar/ver/revogar).
drop policy if exists "ver sugestao_links (org)" on public.sugestao_links;
create policy "ver sugestao_links (org)"
  on public.sugestao_links for select
  to authenticated using (public.eh_membro(org_id));

drop policy if exists "inserir sugestao_links (org)" on public.sugestao_links;
create policy "inserir sugestao_links (org)"
  on public.sugestao_links for insert
  to authenticated with check (org_id is not null and public.eh_membro(org_id));

drop policy if exists "atualizar sugestao_links (org)" on public.sugestao_links;
create policy "atualizar sugestao_links (org)"
  on public.sugestao_links for update
  to authenticated using (public.eh_membro(org_id)) with check (public.eh_membro(org_id));

drop policy if exists "excluir sugestao_links (org)" on public.sugestao_links;
create policy "excluir sugestao_links (org)"
  on public.sugestao_links for delete
  to authenticated using (public.eh_membro(org_id));

-- ----------------------------------------------------------------------------
-- Insere uma sugestao (card) no inicio da lista de cards do quadro da org, de
-- forma atomica no jsonb (sem reescrever o quadro inteiro a partir de uma copia
-- possivelmente velha). Chamada pelo endpoint publico com a service role.
-- ----------------------------------------------------------------------------
create or replace function public.anexar_card(p_org text, p_card jsonb)
returns int language plpgsql as $$
declare achou int;
begin
  select count(*) into achou from public.boards where id = 'principal:' || p_org;
  if achou = 0 then
    return 0;
  end if;

  update public.boards
  set dados = jsonb_set(
        dados,
        '{cards}',
        jsonb_build_array(p_card) || coalesce(dados->'cards', '[]'::jsonb)
      ),
      cliente_id = 'sugestao',
      atualizado_em = now()
  where id = 'principal:' || p_org;

  return achou;
end;
$$;

