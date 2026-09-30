-- ÉRIS — classement par jeu. À exécuter dans Supabase SQL Editor.
-- Somme des points réglés d'un joueur sur UN jeu (tous tournois confondus), classée.

create or replace function public.game_leaderboard(p_game text)
returns table (user_id uuid, username text, points bigint, rank bigint)
language sql stable security definer set search_path = public as $$
  select s.user_id, p.username, s.pts as points,
         rank() over (order by s.pts desc) as rank
  from (
    select pr.user_id, sum(pr.points_awarded)::bigint as pts
    from public.predictions pr
    where pr.settled = true and pr.game = p_game
    group by pr.user_id
  ) s
  join public.profiles p on p.id = s.user_id
  order by s.pts desc, p.username
  limit 100;
$$;

grant execute on function public.game_leaderboard(text) to authenticated;
