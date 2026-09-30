-- ÉRIS — schéma Supabase.
-- À exécuter dans le dashboard Supabase : SQL Editor → coller → Run.

-- ─────────────────────────────────────────────────────────────
-- PROFILS (pseudo + points)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  username   text unique,
  points     integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Pseudos lisibles par tous (futur classement) ; chacun ne modifie que le sien.
create policy "profiles_select_all" on public.profiles
  for select using (true);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Création auto du profil à l'inscription (récupère le pseudo des métadonnées).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data ->> 'username')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- PRONOS (un par user et par match)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.predictions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  match_id   text not null,
  game       text not null,
  score_a    integer,
  score_b    integer,
  boosted    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)
);

alter table public.predictions enable row level security;

-- Chacun ne voit/écrit que ses propres pronos.
create policy "predictions_select_own" on public.predictions
  for select using (auth.uid() = user_id);
create policy "predictions_insert_own" on public.predictions
  for insert with check (auth.uid() = user_id);
create policy "predictions_update_own" on public.predictions
  for update using (auth.uid() = user_id);
create policy "predictions_delete_own" on public.predictions
  for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- RATINGS (snapshot des classements officiels — seed semi-manuel)
--   CS2 : auto depuis le repo Valve (pas forcément en base).
--   Valo/LoL : seedés ici depuis le GPR officiel Riot.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.ratings (
  game        text not null,           -- 'valorant' | 'cs' | 'lol'
  team        text not null,           -- nom officiel (ex. "Paper Rex")
  rating      numeric not null,        -- PWR Riot / VRS Valve
  source      text,                    -- 'riot_gpr' | 'valve_vrs'
  captured_at date not null default current_date,
  primary key (game, team)
);

alter table public.ratings enable row level security;

-- Lecture publique (l'app lit les ratings) ; écriture réservée au dashboard/service role.
create policy "ratings_select_all" on public.ratings
  for select using (true);
