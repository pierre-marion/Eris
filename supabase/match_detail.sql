-- ÉRIS — page détail d'un match. À lancer dans le SQL Editor.

-- 1) Communauté : répartition des calls sur un match (tous les joueurs).
--    on_a = ont donné l'équipe A gagnante, on_b = équipe B. (A/B = orientation PandaScore figée.)
create or replace function public.match_community(p_match_id text)
returns table (total bigint, on_a bigint, on_b bigint)
language sql stable security definer set search_path = public as $$
  select
    count(*) filter (where score_a is not null and score_b is not null and score_a <> score_b),
    count(*) filter (where score_a > score_b),
    count(*) filter (where score_b > score_a)
  from public.predictions
  where match_id = p_match_id;
$$;
grant execute on function public.match_community(text) to authenticated;

-- 2) Dans tes potes : ce que tes co-membres de ligue ont callé sur ce match
--    (inclut ceux qui n'ont RIEN callé → pour les chambrer). Toi exclu.
create or replace function public.match_squad_calls(p_match_id text)
returns table (username text, score_a int, score_b int, boosted boolean, called boolean)
language sql stable security definer set search_path = public as $$
  with mates as (
    select distinct lm2.user_id
    from public.league_members lm1
    join public.league_members lm2 on lm2.league_id = lm1.league_id and lm2.left_at is null
    where lm1.user_id = auth.uid() and lm1.left_at is null and lm2.user_id <> auth.uid()
  )
  select p.username,
         pr.score_a, pr.score_b, coalesce(pr.boosted, false),
         (pr.score_a is not null and pr.score_b is not null) as called
  from mates m
  join public.profiles p on p.id = m.user_id
  left join public.predictions pr on pr.user_id = m.user_id and pr.match_id = p_match_id
  order by (pr.score_a is not null) desc, p.username;
$$;
grant execute on function public.match_squad_calls(text) to authenticated;
