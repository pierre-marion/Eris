import { supabase } from './supabase';

export interface Community {
  total: number;
  onA: number;
  onB: number;
}

/** Répartition des calls de toute la communauté sur un match. */
export async function fetchCommunity(matchId: string): Promise<Community> {
  const { data, error } = await supabase.rpc('match_community', { p_match_id: matchId });
  if (error) throw new Error(error.message);
  const r = (data ?? [])[0];
  return { total: Number(r?.total ?? 0), onA: Number(r?.on_a ?? 0), onB: Number(r?.on_b ?? 0) };
}

export interface SquadCall {
  username: string;
  scoreA: number | null;
  scoreB: number | null;
  boosted: boolean;
  called: boolean;
}

/** Ton bilan perso sur une équipe : combien de fois callée, combien juste. */
export async function fetchTeamRecord(tag: string): Promise<{ total: number; correct: number }> {
  const { data, error } = await supabase.rpc('my_team_record', { p_team: tag });
  if (error) throw new Error(error.message);
  const r = (data ?? [])[0];
  return { total: Number(r?.total ?? 0), correct: Number(r?.correct ?? 0) };
}

/** Ce que tes co-membres de ligue ont callé sur ce match (ceux qui n'ont rien callé inclus). */
export async function fetchSquadCalls(matchId: string): Promise<SquadCall[]> {
  const { data, error } = await supabase.rpc('match_squad_calls', { p_match_id: matchId });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    username: r.username ?? 'joueur',
    scoreA: r.score_a ?? null,
    scoreB: r.score_b ?? null,
    boosted: r.boosted ?? false,
    called: r.called ?? false,
  }));
}
