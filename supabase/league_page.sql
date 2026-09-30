-- ÉRIS — page ligue : feed d'activité (chambrage) + suppression (admin).

-- Feed d'activité : les gros pronos gagnants des membres (MVP du chambrage).
create or replace function public.league_activity(p_league_id uuid)
returns table (
  username text,
  points int,
  team_a text,
  team_b text,
  score_a int,
  score_b int,
  boosted boolean,
  tournament text,
  at timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.username, pr.points_awarded, pr.team_a, pr.team_b,
         pr.score_a, pr.score_b, pr.boosted, pr.tournament, pr.updated_at as at
  from public.predictions pr
  join public.league_members m
    on m.user_id = pr.user_id and m.league_id = p_league_id and m.left_at is null
  join public.profiles p on p.id = pr.user_id
  where pr.settled = true and pr.points_awarded > 0
    and exists (
      select 1 from public.league_members me
      where me.league_id = p_league_id and me.user_id = auth.uid() and me.left_at is null
    )
  order by pr.updated_at desc
  limit 30;
$$;

-- Suppression d'une ligue : réservée au créateur (cascade sur les membres).
create or replace function public.delete_league(p_league_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.leagues where id = p_league_id and owner_id = auth.uid();
end; $$;

grant execute on function public.league_activity(uuid) to authenticated;
grant execute on function public.delete_league(uuid) to authenticated;
