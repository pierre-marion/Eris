-- ÉRIS — ton bilan perso sur une équipe (méta-fun de la page détail). À lancer dans le SQL Editor.
-- « Tu as callé PRX 4 fois, 3 fois juste. » — total = calls réglés impliquant l'équipe,
--   correct = ceux où tu as trouvé le bon vainqueur (points > 0).
create or replace function public.my_team_record(p_team text)
returns table (total bigint, correct bigint)
language sql stable security definer set search_path = public as $$
  select
    count(*),
    count(*) filter (where points_awarded > 0)
  from public.predictions
  where user_id = auth.uid()
    and settled = true
    and (team_a = p_team or team_b = p_team);
$$;
grant execute on function public.my_team_record(text) to authenticated;
