-- ÉRIS — planification de l'auto-settlement. À exécuter après avoir déployé la fonction.

-- 1) La fonction tourne en service_role → il lui faut le droit d'appeler settle_match.
grant execute on function public.settle_match(text, int, int) to service_role;

-- 2) Extensions (sinon : Dashboard → Database → Extensions → activer pg_cron + pg_net).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 3) Toutes les 15 min : ping la fonction auto-settle (déployée en --no-verify-jwt).
select cron.schedule(
  'eris-auto-settle',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := 'https://jlrmteowguimpeusyhkm.supabase.co/functions/v1/auto-settle',
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);

-- Pour arrêter plus tard :  select cron.unschedule('eris-auto-settle');
-- Voir les jobs :           select * from cron.job;
-- Voir l'historique :       select * from cron.job_run_details order by start_time desc limit 10;
