-- ÉRIS — nettoyage des pronos de DÉMO / TEST (match_id non numérique).
-- Les vrais matchs PandaScore ont un match_id numérique ; la démo/test non
-- (eris-test-match, m1..m6). Supprime ces pronos qui polluent Résultats.

delete from public.predictions
where match_id !~ '^[0-9]+$';

-- (Optionnel) remettre tes points à zéro pour repartir propre :
-- update public.profiles set points = 0 where id = auth.uid();
