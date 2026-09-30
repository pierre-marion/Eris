-- ÉRIS — code de ligue dérivé du nom (lisible/partageable : NAAG-25).
-- ⚠️ Tradeoff : un code dérivé est plus DEVINABLE qu'un code aléatoire (cf. revue sécu).
--    Acceptable pour des ligues entre potes ; ajouter un suffixe aléatoire si besoin d'opacité.

create or replace function public.gen_league_code(p_name text)
returns text language plpgsql
set search_path = public, extensions as $$
declare
  base text;
  yy   text := to_char(now(), 'YY');
  cand text;
  i    int := 0;
begin
  base := upper(regexp_replace(coalesce(p_name, ''), '[^A-Za-z0-9]', '', 'g'));
  base := substr(base, 1, 4);
  if length(base) < 2 then base := 'LIG'; end if;
  loop
    cand := case when i = 0 then base || '-' || yy else base || i::text || '-' || yy end;
    exit when not exists (select 1 from public.leagues where leagues.code = cand);
    i := i + 1;
  end loop;
  return cand;
end; $$;

-- create_league utilise désormais le code dérivé du nom.
create or replace function public.create_league(p_name text, p_game text, p_serie_id text, p_tournament text)
returns public.leagues language plpgsql security definer set search_path = public as $$
declare v public.leagues;
begin
  insert into public.leagues (name, code, owner_id, game, serie_id, tournament)
  values (p_name, public.gen_league_code(p_name), auth.uid(), p_game, p_serie_id, p_tournament)
  returning * into v;
  insert into public.league_members (league_id, user_id) values (v.id, auth.uid());
  return v;
end; $$;
