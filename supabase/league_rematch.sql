-- ÉRIS — rematch d'une ligue (fin de fenêtre → on relance sur l'event suivant).
-- Chaîne parent → enfant (dynastie) + recopie les mêmes potes. À exécuter dans le SQL Editor.

-- 1) Lien de dynastie : une ligue peut pointer vers celle qu'elle prolonge.
alter table public.leagues
  add column if not exists parent_id uuid references public.leagues (id) on delete set null;

-- 2) Rejouer : crée une ligue enfant scopée sur le nouvel event et y recopie
--    tous les membres actifs de la ligue parente (« mêmes potes »).
create or replace function public.rematch_league(
  p_league_id  uuid,
  p_serie_id   text,
  p_tournament text
)
returns public.leagues language plpgsql security definer set search_path = public as $$
declare
  v       public.leagues;
  v_name  text;
  v_game  text;
begin
  -- Seul un membre actif de la ligue parente peut lancer la revanche.
  if not exists (
    select 1 from public.league_members
    where league_id = p_league_id and user_id = auth.uid() and left_at is null
  ) then
    raise exception 'Tu n''es pas membre de cette ligue';
  end if;

  select name, game into v_name, v_game from public.leagues where id = p_league_id;
  if v_name is null then raise exception 'Ligue introuvable'; end if;

  insert into public.leagues (name, code, owner_id, game, serie_id, tournament, parent_id)
  values (v_name, public.gen_league_code(), auth.uid(), v_game, p_serie_id, p_tournament, p_league_id)
  returning * into v;

  -- Recopie les membres actifs (le lanceur inclus — d'où le on conflict).
  insert into public.league_members (league_id, user_id)
  select v.id, lm.user_id
  from public.league_members lm
  where lm.league_id = p_league_id and lm.left_at is null
  on conflict (league_id, user_id) do nothing;

  return v;
end; $$;

grant execute on function public.rematch_league(uuid, text, text) to authenticated;
