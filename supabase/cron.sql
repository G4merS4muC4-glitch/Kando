-- Agendador do robo publicador (Supabase).
-- Chama a Edge Function "publicar-posts" a cada 5 minutos. Ela verifica os
-- cards agendados cujo horario ja chegou e publica no Facebook/Instagram.
--
-- COMO USAR:
-- 1. Faca o deploy da function antes (ver META_SETUP.md, passo 9).
-- 2. Preencha os 2 valores abaixo (URL do projeto e a chave service role).
-- 3. Cole tudo no SQL Editor do Supabase e rode (Run).
--
-- Onde achar os valores:
-- - PROJECT_URL: Project Settings > API > Project URL (ex: https://abcd.supabase.co)
-- - SERVICE_ROLE_KEY: Project Settings > API > service_role (secret). NAO e a anon.
--   Esta chave fica so aqui no banco; nao exponha no app.

-- Extensoes necessarias (idempotente).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove um agendamento anterior com o mesmo nome, se existir (evita duplicar).
select cron.unschedule('publicar-posts-5min')
where exists (select 1 from cron.job where jobname = 'publicar-posts-5min');

-- Agenda: a cada 5 minutos chama a Edge Function.
select cron.schedule(
  'publicar-posts-5min',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'PROJECT_URL/functions/v1/publicar-posts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer SERVICE_ROLE_KEY'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);

-- Para conferir os agendamentos:  select * from cron.job;
-- Para desligar:                  select cron.unschedule('publicar-posts-5min');
-- Para ver as ultimas execucoes:  select * from cron.job_run_details order by start_time desc limit 20;
