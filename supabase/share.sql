-- Compartilhamento publico de cards (link de leitura + edicao do teleprompter).
-- Cole e rode no Supabase: SQL Editor > New query > Run.
--
-- Esta tabela e separada do quadro (boards). O acesso publico ao link NAO passa
-- por aqui direto: ele e feito pelos endpoints do servidor (Route Handlers do
-- Next) usando a service role, que ignora o RLS. O RLS abaixo so permite que o
-- TIME (usuarios autenticados) crie, veja e revogue os proprios links.

create table if not exists public.compartilhamentos (
  token text primary key,
  card_id text not null, -- card de origem (onde o link foi criado); usado para listar
  card_ids text[], -- todos os cards do link (multi-card); se vazio, usa card_id
  campanha_id text,
  -- flags de visibilidade por bloco do card
  visibilidade jsonb not null default '{}'::jsonb,
  edicao_teleprompter boolean not null default false,
  -- PIN opcional, guardado como "salt:iteracoes:hash" (PBKDF2, nunca em texto puro)
  pin_hash text,
  expira_em timestamptz,
  revogado boolean not null default false,
  criado_em timestamptz not null default now(),
  -- controle de taxa por link (vale entre instancias serverless)
  pin_erros int not null default 0,
  bloqueado_ate timestamptz,
  escritas_janela int not null default 0,
  janela_inicio timestamptz,
  ultima_escrita timestamptz
);

-- Para tabelas ja criadas antes do multi-card: adiciona a coluna se faltar.
alter table public.compartilhamentos add column if not exists card_ids text[];

create index if not exists idx_compartilhamentos_card on public.compartilhamentos (card_id);

alter table public.compartilhamentos enable row level security;

-- O time autenticado gerencia os links. O visitante publico NAO usa estas
-- policies (ele acessa via endpoints com service role).
drop policy if exists "ler compartilhamentos (autenticado)" on public.compartilhamentos;
create policy "ler compartilhamentos (autenticado)"
  on public.compartilhamentos for select
  to authenticated using (true);

drop policy if exists "inserir compartilhamentos (autenticado)" on public.compartilhamentos;
create policy "inserir compartilhamentos (autenticado)"
  on public.compartilhamentos for insert
  to authenticated with check (true);

drop policy if exists "atualizar compartilhamentos (autenticado)" on public.compartilhamentos;
create policy "atualizar compartilhamentos (autenticado)"
  on public.compartilhamentos for update
  to authenticated using (true) with check (true);

drop policy if exists "excluir compartilhamentos (autenticado)" on public.compartilhamentos;
create policy "excluir compartilhamentos (autenticado)"
  on public.compartilhamentos for delete
  to authenticated using (true);

-- ----------------------------------------------------------------------------
-- Funcoes atomicas usadas pelos endpoints publicos (chamadas via service role).
-- ----------------------------------------------------------------------------

-- Ajusta SO o teleprompter de um card, direto no jsonb (sem reescrever o quadro
-- inteiro a partir de uma copia possivelmente velha). Guarda a versao anterior.
-- Retorna quantos cards casaram (0 = card inexistente).
create or replace function public.ajustar_teleprompter(p_card_id text, p_texto text, p_em text)
returns int language plpgsql as $$
declare achou int;
begin
  select count(*) into achou
  from public.boards, jsonb_array_elements(dados->'cards') c
  where id = 'principal' and c->>'id' = p_card_id;

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
  where id = 'principal';

  return achou;
end;
$$;

-- Consome uma "permissao de escrita" do link de forma atomica (intervalo minimo
-- entre escritas + teto por janela). Retorna true se a escrita pode ocorrer.
create or replace function public.consumir_escrita(
  p_token text, p_intervalo_ms int, p_max int, p_janela_ms int
)
returns boolean language plpgsql as $$
declare ok boolean;
begin
  update public.compartilhamentos
  set
    escritas_janela = case
      when janela_inicio is null or now() - janela_inicio > make_interval(secs => p_janela_ms / 1000.0)
        then 1 else escritas_janela + 1 end,
    janela_inicio = case
      when janela_inicio is null or now() - janela_inicio > make_interval(secs => p_janela_ms / 1000.0)
        then now() else janela_inicio end,
    ultima_escrita = now()
  where token = p_token
    and (ultima_escrita is null or now() - ultima_escrita >= make_interval(secs => p_intervalo_ms / 1000.0))
    and (
      janela_inicio is null
      or now() - janela_inicio > make_interval(secs => p_janela_ms / 1000.0)
      or escritas_janela < p_max
    )
  returning true into ok;
  return coalesce(ok, false);
end;
$$;

-- Incrementa o contador de erros de PIN de forma atomica e bloqueia ao atingir
-- o limite (zera o contador ao bloquear).
create or replace function public.registrar_erro_pin(p_token text, p_max int, p_lock_ms int)
returns void language sql as $$
  update public.compartilhamentos
  set
    bloqueado_ate = case
      when pin_erros + 1 >= p_max then now() + make_interval(secs => p_lock_ms / 1000.0)
      else bloqueado_ate end,
    pin_erros = case
      when pin_erros + 1 >= p_max then 0
      else pin_erros + 1 end
  where token = p_token;
$$;
