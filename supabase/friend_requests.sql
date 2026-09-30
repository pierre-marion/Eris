-- ÉRIS — demandes d'ami : ajout par Sceau ne lie plus direct, il faut confirmer.
-- À lancer APRÈS friends.sql dans le SQL Editor (incrémental, ne recrée rien).

-- 1) Statut sur l'amitié. Défaut 'accepted' pour ne pas casser les paires déjà créées.
alter table public.friendships add column if not exists status text not null default 'accepted';
alter table public.friendships drop constraint if exists friendships_status_check;
alter table public.friendships add constraint friendships_status_check check (status in ('pending', 'accepted'));

-- 2) Il faut voir les demandes REÇUES (b = moi), pas seulement celles que j'ai envoyées.
drop policy if exists "friendships_select_own" on public.friendships;
create policy "friendships_select_own" on public.friendships
  for select using (a = auth.uid() or b = auth.uid());

-- 3) Ajouter un Oracle : crée une demande en attente. Si l'autre m'a DÉJÀ demandé,
--    on accepte direct des deux côtés (évite deux demandes croisées qui restent bloquées).
create or replace function public.add_friend_by_code(p_code text)
returns table (id uuid, username text, status text)
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_name text; v_reverse_pending boolean;
begin
  select pr.id, pr.username into v_id, v_name
  from public.profiles pr where pr.friend_code = upper(trim(p_code));
  if v_id is null then raise exception 'Sceau introuvable'; end if;
  if v_id = auth.uid() then raise exception 'C''est ton propre Sceau'; end if;

  select exists(
    select 1 from public.friendships where a = v_id and b = auth.uid() and status = 'pending'
  ) into v_reverse_pending;

  if v_reverse_pending then
    update public.friendships set status = 'accepted' where a = v_id and b = auth.uid();
    insert into public.friendships (a, b, status) values (auth.uid(), v_id, 'accepted')
      on conflict (a, b) do update set status = 'accepted';
    return query select v_id, v_name, 'accepted'::text;
  else
    insert into public.friendships (a, b, status) values (auth.uid(), v_id, 'pending')
      on conflict (a, b) do nothing;
    return query select v_id, v_name, 'pending'::text;
  end if;
end; $$;

-- 4) Répondre à une demande reçue (accepter ou refuser).
create or replace function public.respond_friend_request(p_from uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_accept then
    update public.friendships set status = 'accepted' where a = p_from and b = auth.uid() and status = 'pending';
    insert into public.friendships (a, b, status) values (auth.uid(), p_from, 'accepted')
      on conflict (a, b) do update set status = 'accepted';
  else
    delete from public.friendships where a = p_from and b = auth.uid() and status = 'pending';
  end if;
end; $$;

-- 5) Mes demandes reçues, en attente.
create or replace function public.my_pending_requests()
returns table (id uuid, username text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username
  from public.friendships f
  join public.profiles p on p.id = f.a
  where f.b = auth.uid() and f.status = 'pending'
  order by f.created_at desc;
$$;

-- 6) Amis = seulement les amitiés acceptées.
create or replace function public.my_friends()
returns table (friend_id uuid, username text, common_cercles int, friend_wins int, my_wins int)
language sql stable security definer set search_path = public as $$
  with me as (select auth.uid() as uid),
  fr as (select f.b as fid from public.friendships f, me where f.a = me.uid and f.status = 'accepted'),
  common as (
    select fr.fid, lm.league_id
    from fr
    join public.league_members lm on lm.user_id = fr.fid and lm.left_at is null
    join public.league_members lme
      on lme.league_id = lm.league_id and lme.user_id = (select uid from me) and lme.left_at is null
  ),
  pts as (
    select c.fid, c.league_id,
      (select coalesce(sum(pr.points_awarded), 0)
       from public.predictions pr
       join public.leagues lg on lg.id = c.league_id
       join public.league_members m on m.league_id = c.league_id and m.user_id = c.fid and m.left_at is null
       where pr.user_id = c.fid and pr.settled and pr.match_start is not null and pr.match_start >= m.joined_at
         and (lg.serie_id is null or pr.serie_id = lg.serie_id)
         and (lg.game is null or pr.game = lg.game)) as fpts,
      (select coalesce(sum(pr.points_awarded), 0)
       from public.predictions pr
       join public.leagues lg on lg.id = c.league_id
       join public.league_members m on m.league_id = c.league_id and m.user_id = (select uid from me) and m.left_at is null
       where pr.user_id = (select uid from me) and pr.settled and pr.match_start is not null and pr.match_start >= m.joined_at
         and (lg.serie_id is null or pr.serie_id = lg.serie_id)
         and (lg.game is null or pr.game = lg.game)) as mpts
    from common c
  )
  select fr.fid, p.username,
         count(pts.league_id)::int,
         coalesce(sum((pts.fpts > pts.mpts)::int), 0)::int,
         coalesce(sum((pts.mpts > pts.fpts)::int), 0)::int
  from fr
  join public.profiles p on p.id = fr.fid
  left join pts on pts.fid = fr.fid
  group by fr.fid, p.username
  order by count(pts.league_id) desc, p.username;
$$;

grant execute on function public.add_friend_by_code(text) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.my_pending_requests() to authenticated;
grant execute on function public.my_friends() to authenticated;
