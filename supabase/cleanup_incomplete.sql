-- ÉRIS — supprime les pronos INCOMPLETS (faits avant la capture nom/cote/logo).
-- Symptômes : pas de nom ni logo dans Résultats, et points anormalement bas
-- (cote null → 0 pt sur le vainqueur, seul le bonus rareté tombe).

delete from public.predictions
where team_a is null
   or odds_a is null;

-- Optionnel : repartir avec un compteur propre.
-- update public.profiles set points = 0 where id = auth.uid();
