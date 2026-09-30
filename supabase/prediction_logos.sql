-- ÉRIS — logos d'équipe figés sur le prono (pour de vraies cards dans Résultats).
alter table public.predictions add column if not exists team_a_logo text;
alter table public.predictions add column if not exists team_b_logo text;
