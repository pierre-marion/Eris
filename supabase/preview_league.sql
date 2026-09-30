-- ÉRIS — aperçu d'une ligue par code, SANS la rejoindre (pour l'écran Rejoindre).
-- Security definer : un non-membre peut voir l'aperçu d'un code valide (nom, créateur, taille).

create or replace function public.preview_league(p_code text)
returns table (
  id uuid,
  name text,
  code text,
  game text,
  serie_id text,
  tournament text,
  owner_username text,
  member_count bigint
)
language sql stable security definer set search_path = public as $$
  select l.id, l.name, l.code, l.game, l.serie_id, l.tournament,
         p.username as owner_username,
         (select count(*) from public.league_members m
          where m.league_id = l.id and m.left_at is null) as member_count
  from public.leagues l
  left join public.profiles p on p.id = l.owner_id
  where l.code = upper(trim(p_code))
  limit 1;
$$;

grant execute on function public.preview_league(text) to authenticated;
