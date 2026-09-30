-- ÉRIS — jeux suivis par l'utilisateur (différenciateur multi-jeux).
-- Le sélecteur header montre les jeux suivis en actif, les autres en "+ suivre".

alter table public.profiles
  add column if not exists games text[] not null default array['valorant', 'cs', 'lol'];
