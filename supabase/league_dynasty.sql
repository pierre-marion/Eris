-- ÉRIS — palmarès de dynastie : remonte toute la chaîne parent→enfant d'un Cercle
-- et renvoie, pour chaque édition, son champion (1er du Panthéon). À exécuter dans le SQL Editor.

create or replace function public.league_dynasty(p_league_id uuid)
returns table (
  league_id        uuid,
  tournament       text,
  serie_id         text,
  created_at       timestamptz,
  champion_id      uuid,
  champion_username text,
  champion_points  bigint
)
language sql stable security definer set search_path = public as $$
  with recursive
  -- 1) on remonte jusqu'à la racine (1re édition, parent_id null)
  ancestors as (
    select id, parent_id from public.leagues where id = p_league_id
    union all
    select l.id, l.parent_id
    from public.leagues l
    join ancestors a on l.id = a.parent_id
  ),
  -- 2) on redescend toute la dynastie depuis la racine
  chain as (
    select id, parent_id
    from public.leagues
    where id = (select id from ancestors where parent_id is null limit 1)
    union all
    select l.id, l.parent_id
    from public.leagues l
    join chain c on l.parent_id = c.id
  ),
  -- 3) points par membre et par édition (même logique scopée que league_leaderboard)
  pts as (
    select c.id as league_id, m.user_id,
           coalesce(sum(pr.points_awarded), 0)::bigint as p
    from chain c
    join public.leagues lg on lg.id = c.id
    join public.league_members m on m.league_id = c.id and m.left_at is null
    left join public.predictions pr
      on pr.user_id = m.user_id
     and pr.settled = true
     and pr.match_start is not null
     and pr.match_start >= m.joined_at
     and (lg.serie_id is null or pr.serie_id = lg.serie_id)
     and (lg.game is null or pr.game = lg.game)
    group by c.id, m.user_id
  ),
  ranked as (
    select league_id, user_id, p,
           row_number() over (partition by league_id order by p desc) as rn
    from pts
  )
  select l.id, l.tournament, l.serie_id, l.created_at,
         r.user_id, prof.username, r.p
  from public.leagues l
  join chain c on c.id = l.id
  left join ranked r on r.league_id = l.id and r.rn = 1
  left join public.profiles prof on prof.id = r.user_id
  -- garde-fou IDOR : seulement si l'appelant est membre actif d'une édition de la dynastie
  where exists (
    select 1 from public.league_members me
    join chain c2 on c2.id = me.league_id
    where me.user_id = auth.uid() and me.left_at is null
  )
  order by l.created_at;
$$;

grant execute on function public.league_dynasty(uuid) to authenticated;
