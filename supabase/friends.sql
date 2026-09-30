-- ÉRIS — couche amis ("Mes Oracles"). Ajout par Sceau perso + rivalité (Cercles communs).
-- Pas de système de bataille : un ami alimente les Cercles, c'est tout. À lancer dans le SQL Editor.

-- 1) Sceau personnel sur le profil (code d'ami unique).
alter table public.profiles add column if not exists friend_code text unique;

create extension if not exists pgcrypto;

create or replace function public.gen_friend_code()
returns text language plpgsql set search_path = public, extensions as $$
declare chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; v text; i int;
begin
  loop
    v := '';
    for i in 1..6 loop
      v := v || substr(chars, 1 + (get_byte(gen_random_bytes(1), 0) % length(chars)), 1);
    end loop;
    exit when not exists (select 1 from public.profiles where friend_code = v);
  end loop;
  return v;
end; $$;

-- Renvoie mon Sceau (le génère à la première demande).
create or replace function public.my_friend_code()
returns text language plpgsql security definer set search_path = public as $$
declare v text;
begin
  select friend_code into v from public.profiles where id = auth.uid();
  if v is null then
    v := public.gen_friend_code();
    update public.profiles set friend_code = v where id = auth.uid();
  end if;
  return v;
end; $$;

-- 2) Amitiés (symétriques : on insère les deux sens à l'ajout).
create table if not exists public.friendships (
  a uuid not null references auth.users (id) on delete cascade,
  b uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (a, b)
);
alter table public.friendships enable row level security;
drop policy if exists "friendships_select_own" on public.friendships;
create policy "friendships_select_own" on public.friendships for select using (a = auth.uid());

-- 3) Ajouter un Oracle via son Sceau.
create or replace function public.add_friend_by_code(p_code text)
returns table (id uuid, username text)
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text;
begin
  select pr.id, pr.username into v_id, v_name
  from public.profiles pr where pr.friend_code = upper(trim(p_code));
  if v_id is null then raise exception 'Sceau introuvable'; end if;
  if v_id = auth.uid() then raise exception 'C''est ton propre Sceau'; end if;
  insert into public.friendships (a, b) values (auth.uid(), v_id) on conflict do nothing;
  insert into public.friendships (a, b) values (v_id, auth.uid()) on conflict do nothing;
  return query select v_id, v_name;
end; $$;

-- 4) Retirer un Oracle (les deux sens).
create or replace function public.remove_friend(p_friend uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.friendships
  where (a = auth.uid() and b = p_friend) or (a = p_friend and b = auth.uid());
$$;

-- 5) Mes Oracles + rivalité : Cercles communs et qui mène (points scopés par Cercle).
create or replace function public.my_friends()
returns table (friend_id uuid, username text, common_cercles int, friend_wins int, my_wins int)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as uid),
  fr as (select f.b as fid from public.friendships f, me where f.a = me.uid),
  -- Cercles où le pote ET moi sommes membres actifs
  common as (
    select fr.fid, lm.league_id
    from fr
    join public.league_members lm on lm.user_id = fr.fid and lm.left_at is null
    join public.league_members lme
      on lme.league_id = lm.league_id and lme.user_id = (select uid from me) and lme.left_at is null
  ),
  -- points scopés (même logique que league_leaderboard) pour le pote et moi, par Cercle
  pts as (
    select c.fid, c.league_id,
      (select coalesce(sum(pr.points_awarded), 0)
       from public.predictions pr
       join public.leagues lg on lg.id = c.league_id
       join public.league_members m on m.league_id = c.league_id and m.user_id = c.fid and m.left_at is null
       where pr.user_id = c.fid and pr.settled and pr.match_start is not null and pr.match_start >= m.joined_at
         and (lg.serie_id is null or pr.serie_id = lg.serie_id)
         and (lg.game is null or pr.game = lg.game)) as fpts,
      (select coalesce(sum(pr.points_awarded), 0)
       from public.predictions pr
       join public.leagues lg on lg.id = c.league_id
       join public.league_members m on m.league_id = c.league_id and m.user_id = (select uid from me) and m.left_at is null
       where pr.user_id = (select uid from me) and pr.settled and pr.match_start is not null and pr.match_start >= m.joined_at
         and (lg.serie_id is null or pr.serie_id = lg.serie_id)
         and (lg.game is null or pr.game = lg.game)) as mpts
    from common c
  )
  select fr.fid, p.username,
         count(pts.league_id)::int,
         coalesce(sum((pts.fpts > pts.mpts)::int), 0)::int,
         coalesce(sum((pts.mpts > pts.fpts)::int), 0)::int
  from fr
  join public.profiles p on p.id = fr.fid
  left join pts on pts.fid = fr.fid
  group by fr.fid, p.username
  order by count(pts.league_id) desc, p.username;
$$;

grant execute on function public.my_friend_code() to authenticated;
grant execute on function public.add_friend_by_code(text) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.my_friends() to authenticated;
