-- Migracao UNICA para o modo multiempresa (rode DEPOIS de organizacoes.sql).
-- Cole e rode no Supabase: SQL Editor > New query > Run.
--
-- O que faz, NESTA ORDEM (a ordem importa para nao travar o seu acesso):
--   1) Cria a organizacao "org-brusoft" e adiciona voce como dono.
--   2) Renomeia as linhas atuais do quadro/horas/metricas para o id por org e
--      carimba org_id (seus dados continuam intactos, so mudam de "endereco").
--   3) Injeta as marcas Brusoft/Evotalks como dados dentro do quadro.
--   4) Carimba os links de compartilhamento existentes com org_id.
--   5) SO ENTAO troca as policies de boards/compartilhamentos para isolar por
--      organizacao, e atualiza a funcao do teleprompter para receber a org.
--
-- Idempotente: pode rodar de novo sem duplicar nada.

begin;

-- Passos 1 a 4: dados (precisa do seu uid; falha claro se o e-mail nao existir).
do $migracao$
declare
  uid uuid;
begin
  select id into uid from auth.users
    where lower(email) = lower('samuel.rosa@brusoft.inf.br');
  if uid is null then
    raise exception 'Usuario samuel.rosa@brusoft.inf.br nao encontrado em auth.users. Ajuste o e-mail nesta migracao.';
  end if;

  -- 1) Organizacao Brusoft + dono.
  insert into public.organizations (id, nome, criado_por)
  values ('org-brusoft', 'Brusoft', uid)
  on conflict (id) do nothing;

  insert into public.org_members (org_id, user_id, papel)
  values ('org-brusoft', uid, 'dono')
  on conflict (org_id, user_id) do nothing;

  -- 2) Renomeia as linhas existentes e carimba org_id.
  update public.boards set id = 'principal:org-brusoft', org_id = 'org-brusoft'
    where id = 'principal';
  update public.boards set id = 'apontamentos:org-brusoft', org_id = 'org-brusoft'
    where id = 'apontamentos';
  update public.boards set id = 'metricas:org-brusoft:brusoft', org_id = 'org-brusoft'
    where id = 'metricas:brusoft';
  update public.boards set id = 'metricas:org-brusoft:evotalks', org_id = 'org-brusoft'
    where id = 'metricas:evotalks';

  -- 3) Marcas como dados dentro do quadro (so injeta se ainda nao houver, para
  --    nao sobrescrever ajustes futuros). Os ids "brusoft"/"evotalks" casam com
  --    o campanha.marca ja existente, entao nenhum card precisa ser reescrito.
  update public.boards
  set dados = jsonb_set(
        dados,
        '{marcas}',
        $j$[
          {"id":"brusoft","nome":"Brusoft","cor":"#FA611E","corSuave":"#FFF1E9"},
          {"id":"evotalks","nome":"Evotalks","cor":"#1bbf5d","corSuave":"#E2F7EC"}
        ]$j$::jsonb,
        true
      )
  where id = 'principal:org-brusoft' and not (dados ? 'marcas');

  -- 4) Links de compartilhamento existentes pertencem a Brusoft.
  update public.compartilhamentos set org_id = 'org-brusoft' where org_id is null;
end
$migracao$;

-- ----------------------------------------------------------------------------
-- 5) Policies isoladas por organizacao (DEPOIS do backfill acima).
-- ----------------------------------------------------------------------------

-- boards
drop policy if exists "ler board (autenticado)" on public.boards;
drop policy if exists "inserir board (autenticado)" on public.boards;
drop policy if exists "atualizar board (autenticado)" on public.boards;

drop policy if exists "ler board (org)" on public.boards;
create policy "ler board (org)"
  on public.boards for select to authenticated
  using (public.eh_membro(org_id));

drop policy if exists "inserir board (org)" on public.boards;
create policy "inserir board (org)"
  on public.boards for insert to authenticated
  with check (org_id is not null and public.eh_membro(org_id));

drop policy if exists "atualizar board (org)" on public.boards;
create policy "atualizar board (org)"
  on public.boards for update to authenticated
  using (public.eh_membro(org_id))
  with check (public.eh_membro(org_id));

-- compartilhamentos
drop policy if exists "ler compartilhamentos (autenticado)" on public.compartilhamentos;
drop policy if exists "inserir compartilhamentos (autenticado)" on public.compartilhamentos;
drop policy if exists "atualizar compartilhamentos (autenticado)" on public.compartilhamentos;
drop policy if exists "excluir compartilhamentos (autenticado)" on public.compartilhamentos;

drop policy if exists "ler compartilhamentos (org)" on public.compartilhamentos;
create policy "ler compartilhamentos (org)"
  on public.compartilhamentos for select to authenticated
  using (public.eh_membro(org_id));

drop policy if exists "inserir compartilhamentos (org)" on public.compartilhamentos;
create policy "inserir compartilhamentos (org)"
  on public.compartilhamentos for insert to authenticated
  with check (org_id is not null and public.eh_membro(org_id));

drop policy if exists "atualizar compartilhamentos (org)" on public.compartilhamentos;
create policy "atualizar compartilhamentos (org)"
  on public.compartilhamentos for update to authenticated
  using (public.eh_membro(org_id))
  with check (public.eh_membro(org_id));

drop policy if exists "excluir compartilhamentos (org)" on public.compartilhamentos;
create policy "excluir compartilhamentos (org)"
  on public.compartilhamentos for delete to authenticated
  using (public.eh_membro(org_id));

-- ----------------------------------------------------------------------------
-- 6) Funcao do teleprompter agora recebe a organizacao (id da linha por org).
--    Remove a versao antiga de 3 argumentos e cria a de 4.
-- ----------------------------------------------------------------------------
drop function if exists public.ajustar_teleprompter(text, text, text);

create or replace function public.ajustar_teleprompter(
  p_org text, p_card_id text, p_texto text, p_em text
)
returns int language plpgsql as $$
declare
  achou int;
  v_id text := 'principal:' || p_org;
begin
  select count(*) into achou
  from public.boards, jsonb_array_elements(dados->'cards') c
  where id = v_id and c->>'id' = p_card_id;

  if achou = 0 then
    return 0;
  end if;

  update public.boards
  set dados = jsonb_set(
        dados,
        '{cards}',
        (
          select jsonb_agg(
            case when c->>'id' = p_card_id then
              c || jsonb_build_object(
                'teleprompterAnterior', coalesce(c->>'teleprompter', ''),
                'teleprompter', p_texto,
                'teleprompterAjustadoEm', p_em,
                'atualizadoEm', p_em
              )
            else c end
          )
          from jsonb_array_elements(dados->'cards') c
        )
      ),
      cliente_id = 'compartilhamento',
      atualizado_em = now()
  where id = v_id;

  return achou;
end;
$$;

commit;

-- Conferencia rapida (rode e veja se aparece 1 organizacao com seus dados):
-- select id, nome from public.organizations;
-- select id, org_id from public.boards order by id;
