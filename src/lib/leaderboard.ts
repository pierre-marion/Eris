import { supabase } from './supabase';

export interface LeaderEntry {
  id: string;
  username: string;
  points: number;
  rank: number;
}

/** Classement global de toute l'app, par points décroissants. */
export async function fetchGlobalLeaderboard(limit = 100): Promise<LeaderEntry[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, points')
    .order('points', { ascending: false })
    .order('username', { ascending: true })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((r, i) => ({
    id: r.id,
    username: r.username ?? 'Joueur',
    points: r.points ?? 0,
    rank: i + 1,
  }));
}

/** Classement d'un jeu : points réglés des joueurs sur ce jeu uniquement. */
export async function fetchGameLeaderboard(game: string): Promise<LeaderEntry[]> {
  const { data, error } = await supabase.rpc('game_leaderboard', { p_game: game });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: { user_id: string; username: string | null; points: number; rank: number }) => ({
    id: r.user_id,
    username: r.username ?? 'Joueur',
    points: r.points ?? 0,
    rank: r.rank,
  }));
}
