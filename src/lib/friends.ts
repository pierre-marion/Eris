import { supabase } from './supabase';

export interface Friend {
  id: string;
  username: string;
  commonCercles: number;
  friendWins: number; // ligues communes où le pote te devance
  myWins: number; // ligues communes où tu le devances
}

/** Mes joueurs + la rivalité (ligues communes, qui mène). */
export async function fetchFriends(): Promise<Friend[]> {
  const { data, error } = await supabase.rpc('my_friends');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.friend_id,
    username: r.username ?? 'joueur',
    commonCercles: Number(r.common_cercles ?? 0),
    friendWins: Number(r.friend_wins ?? 0),
    myWins: Number(r.my_wins ?? 0),
  }));
}

/** Mon Code perso (généré à la première demande). */
export async function myFriendCode(): Promise<string> {
  const { data, error } = await supabase.rpc('my_friend_code');
  if (error) throw new Error(error.message);
  return data as string;
}

/** Demande à ajouter un joueur via son Code. 'accepted' si la demande était déjà réciproque. */
export async function addFriendByCode(
  code: string,
): Promise<{ id: string; username: string; status: 'pending' | 'accepted' }> {
  const { data, error } = await supabase.rpc('add_friend_by_code', { p_code: code });
  if (error) throw new Error(error.message);
  const r = (data ?? [])[0];
  if (!r) throw new Error('Code introuvable');
  return { id: r.id, username: r.username ?? 'joueur', status: r.status };
}

/** Retire un joueur de mes amis (ou annule une demande envoyée). */
export async function removeFriend(id: string): Promise<void> {
  const { error } = await supabase.rpc('remove_friend', { p_friend: id });
  if (error) throw new Error(error.message);
}

export interface FriendRequest {
  id: string;
  username: string;
}

/** Demandes d'ami reçues, en attente de réponse. */
export async function fetchPendingRequests(): Promise<FriendRequest[]> {
  const { data, error } = await supabase.rpc('my_pending_requests');
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({ id: r.id, username: r.username ?? 'joueur' }));
}

/** Accepte ou refuse une demande reçue. */
export async function respondFriendRequest(id: string, accept: boolean): Promise<void> {
  const { error } = await supabase.rpc('respond_friend_request', { p_from: id, p_accept: accept });
  if (error) throw new Error(error.message);
}

/** Texte de rivalité prêt à afficher. */
export function rivalryLabel(f: Friend): string {
  if (f.commonCercles === 0) return 'Pas encore de ligue commune';
  const base = `${f.commonCercles} ligue${f.commonCercles > 1 ? 's' : ''} commune${f.commonCercles > 1 ? 's' : ''}`;
  if (f.friendWins > f.myWins) return `${base} · te mène ${f.friendWins}–${f.myWins}`;
  if (f.myWins > f.friendWins) return `${base} · tu mènes ${f.myWins}–${f.friendWins}`;
  return `${base} · à égalité ${f.myWins}–${f.friendWins}`;
}
