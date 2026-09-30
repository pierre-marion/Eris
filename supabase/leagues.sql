-- ÉRIS — ligues scopées par tournoi. À exécuter dans Supabase SQL Editor.
-- Corrections intégrées : (1) borne = kickoff du match · (2) scope = serie_id PandaScore
--   (3) place pour une table agrégée plus tard · (4) left_at soft delete · (5) code aléatoire unique.

-- 0) Colonnes de scope sur les pronos (kickoff figé + clé de série).
alter table public.predictions add column if not exists match_start timestamptz;
alter table public.predictions add column if not exists serie_id text;

-- 1) Ligues.
create table if not exists public.leagues (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  code       text not null unique,           -- (5) invitation, unique indexé
  owner_id   uuid not null references auth.users (id) on delete cascade,
  game       text,                            -- scope jeu (null = tous)
  serie_id   text,                            -- (2) scope tournoi PandaScore (null = toute la saison)
  tournament text,                            -- nom d'affichage du scope
  created_at timestamptz not null default now()
);
alter table public.leagues enable row level security;

-- 2) Membres (soft delete via left_at — point 4).
create table if not exists public.league_members (
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at   timestamptz,
  primary key (league_id, user_id)
);
alter table public.league_members enable row level security;

-- On ne voit que les ligues dont on est membre actif ; et ses propres adhésions.
drop policy if exists "leagues_select_member" on public.leagues;
create policy "leagues_select_member" on public.leagues for select using (
  exists (
    select 1 from public.league_members lm
    where lm.league_id = id and lm.user_id = auth.uid() and lm.left_at is null
  )
);
drop policy if exists "lm_select_own" on public.league_members;
create policy "lm_select_own" on public.league_members for select using (user_id = auth.uid());
-- Les écritures passent par les RPC security definer ci-dessous.

-- 3) Code d'invitation : unique, 8 car., CSPRNG (gen_random_bytes), charset sans 0/O/1/I.
--    Variable v_code (≠ colonne "code") pour éviter l'ambiguïté Postgres.
create extension if not exists pgcrypto;

create or replace function public.gen_league_code()
returns text language plpgsql
set search_path = public, extensions as $$
declare
  chars  text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  i      int;
begin
  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(chars, 1 + (get_byte(gen_random_bytes(1), 0) % length(chars)), 1);
    end loop;
    exit when not exists (select 1 from public.leagues where leagues.code = v_code);
  end loop;
  return v_code;
end; $$;

-- 4) Créer une ligue (le créateur devient membre).
create or replace function public.create_league(p_name text, p_game text, p_serie_id text, p_tournament text)
returns public.leagues language plpgsql security definer set search_path = public as $$
declare v public.leagues;
begin
  insert into public.leagues (name, code, owner_id, game, serie_id, tournament)
  values (p_name, public.gen_league_code(), auth.uid(), p_game, p_serie_id, p_tournament)
  returning * into v;
  insert into public.league_members (league_id, user_id) values (v.id, auth.uid());
  return v;
end; $$;

-- 5) Rejoindre via code (re-rejoindre réactive l'adhésion mais reremet joined_at = maintenant).
create or replace function public.join_league(p_code text)
returns public.leagues language plpgsql security definer set search_path = public as $$
declare v public.leagues;
begin
  select * into v from public.leagues where code = upper(trim(p_code));
  if not found then raise exception 'Code invalide'; end if;
  insert into public.league_members (league_id, user_id) values (v.id, auth.uid())
  on conflict (league_id, user_id) do update set left_at = null, joined_at = now();
  return v;
end; $$;

-- 6) Quitter une ligue (soft delete).
create or replace function public.leave_league(p_league_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.league_members set left_at = now()
  where league_id = p_league_id and user_id = auth.uid();
end; $$;

-- 7) Classement d'une ligue : points scopés (serie_id + game) et bornés au kickoff ≥ adhésion.
--    SUM à la volée (OK MVP) — remplaçable par une table agrégée sans changer l'appelant.
create or replace function public.league_leaderboard(p_league_id uuid)
returns table (user_id uuid, username text, points bigint, rank bigint)
language sql stable security definer set search_path = public as $$
  with lg as (select game, serie_id from public.leagues where id = p_league_id)
  select mp.user_id, p.username, mp.pts as points,
         rank() over (order by mp.pts desc) as rank
  from (
    select m.user_id, coalesce(sum(pr.points_awarded), 0)::bigint as pts
    from public.league_members m
    cross join lg
    left join public.predictions pr
      on pr.user_id = m.user_id
     and pr.settled = true
     and pr.match_start is not null
     and pr.match_start >= m.joined_at            -- (1) borne = kickoff ≥ adhésion
     and (lg.serie_id is null or pr.serie_id = lg.serie_id)  -- (2) scope par serie_id
     and (lg.game is null or pr.game = lg.game)
    where m.league_id = p_league_id and m.left_at is null
      -- Garde-fou IDOR : seuls les membres actifs voient le classement.
      and exists (
        select 1 from public.league_members me
        where me.league_id = p_league_id and me.user_id = auth.uid() and me.left_at is null
      )
    group by m.user_id
  ) mp
  join public.profiles p on p.id = mp.user_id
  order by mp.pts desc, p.username;
$$;

grant execute on function public.create_league(text, text, text, text) to authenticated;
grant execute on function public.join_league(text) to authenticated;
grant execute on function public.leave_league(uuid) to authenticated;
grant execute on function public.league_leaderboard(uuid) to authenticated;
