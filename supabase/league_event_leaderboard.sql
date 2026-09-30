-- ÉRIS — classement live d'une ligue scopé sur l'EVENT DU HEADER (double filtre).
-- Le groupe = les membres de la ligue ; le scope = {game, serie_id} passé depuis le header.
-- (p_serie_id null = tout le jeu / annuel.) Borne kickoff ≥ adhésion. Garde-fou membre.

create or replace function public.league_event_leaderboard(p_league_id uuid, p_game text, p_serie_id text)
returns table (user_id uuid, username text, points bigint, rank bigint)
language sql stable security definer set search_path = public as $$
  select mp.user_id, p.username, mp.pts as points,
         rank() over (order by mp.pts desc) as rank
  from (
    select m.user_id, coalesce(sum(pr.points_awarded), 0)::bigint as pts
    from public.league_members m
    left join public.predictions pr
      on pr.user_id = m.user_id
     and pr.settled = true
     and pr.match_start is not null
     and pr.match_start >= m.joined_at
     and (p_serie_id is null or pr.serie_id = p_serie_id)
     and (p_game is null or pr.game = p_game)
    where m.league_id = p_league_id and m.left_at is null
      and exists (
        select 1 from public.league_members me
        where me.league_id = p_league_id and me.user_id = auth.uid() and me.left_at is null
      )
    group by m.user_id
  ) mp
  join public.profiles p on p.id = mp.user_id
  order by mp.pts desc, p.username;
$$;

grant execute on function public.league_event_leaderboard(uuid, text, text) to authenticated;
