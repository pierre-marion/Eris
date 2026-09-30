-- ÉRIS — suppression du compte (RGPD). Efface les données de l'utilisateur.
-- ⚠️ Ne supprime PAS la ligne auth.users (réservé à l'admin) — voir note dans l'app.

create or replace function public.delete_account()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.predictions where user_id = auth.uid();
  delete from public.league_members where user_id = auth.uid();
  delete from public.leagues where owner_id = auth.uid();
  delete from public.profiles where id = auth.uid();
end; $$;

grant execute on function public.delete_account() to authenticated;
