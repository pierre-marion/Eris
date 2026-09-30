-- ÉRIS — settlement : résoudre un match fini → points réels → profiles.points.
-- À (RE)exécuter dans Supabase SQL Editor (idempotent : colonnes + fonction).

-- 1) Snapshot sur chaque prono : cote figée + infos d'affichage + résultat réel.
alter table public.predictions add column if not exists odds_a int;
alter table public.predictions add column if not exists odds_b int;
alter table public.predictions add column if not exists format text;
alter table public.predictions add column if not exists team_a text;
alter table public.predictions add column if not exists team_b text;
alter table public.predictions add column if not exists tournament text;
alter table public.predictions add column if not exists result_a int;
alter table public.predictions add column if not exists result_b int;
alter table public.predictions add column if not exists settled boolean not null default false;
alter table public.predictions add column if not exists points_awarded int not null default 0;

-- 2) Fonction de settlement. Appelée avec le score final réel (maps).
--    Barème MPP : Levier 1 = cote du bon vainqueur · Levier 2 = bonus rareté score exact · ×2.
create or replace function public.settle_match(p_match_id text, p_score_a int, p_score_b int)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_winner   char(1) := case when p_score_a > p_score_b then 'a' else 'b' end;
  v_total    int;
  v_exact    int;
  v_pct      numeric;
  v_bonus    int;
  v_points   int;
  r          record;
begin
  -- Rareté globale : % des pronos du match qui ont trouvé le score exact.
  select count(*) into v_total
    from public.predictions
    where match_id = p_match_id and score_a is not null and score_b is not null;
  select count(*) into v_exact
    from public.predictions
    where match_id = p_match_id and score_a = p_score_a and score_b = p_score_b;

  v_pct := case when v_total > 0 then 100.0 * v_exact / v_total else 0 end;
  v_bonus := case
    when v_pct >= 40 then 10
    when v_pct >= 20 then 20
    when v_pct >= 8  then 40
    when v_pct >= 2  then 70
    else 100
  end;

  for r in
    select * from public.predictions
    where match_id = p_match_id and settled = false
  loop
    v_points := 0;

    -- Levier 1 : bon vainqueur → cote du vainqueur réel.
    if r.score_a is not null and r.score_b is not null and r.score_a <> r.score_b then
      if (case when r.score_a > r.score_b then 'a' else 'b' end) = v_winner then
        v_points := v_points + coalesce(case when v_winner = 'a' then r.odds_a else r.odds_b end, 0);
        -- Levier 2 : score exact → bonus rareté.
        if r.score_a = p_score_a and r.score_b = p_score_b then
          v_points := v_points + v_bonus;
        end if;
      end if;
    end if;

    -- ×2 "la Discorde".
    if r.boosted then v_points := v_points * 2; end if;

    update public.predictions
      set settled = true,
          points_awarded = v_points,
          result_a = p_score_a,
          result_b = p_score_b
      where id = r.id;
    update public.profiles
      set points = points + v_points
      where id = r.user_id;
  end loop;
end;
$$;

-- 3) Verrou : seul le propriétaire/role service peut settler (pas les clients).
revoke all on function public.settle_match(text, int, int) from public, anon, authenticated;
