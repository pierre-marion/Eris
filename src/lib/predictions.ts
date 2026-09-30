import { supabase } from './supabase';
import type { GameKey } from '../theme';
import type { Prediction, Predictions } from '../types';

/** Charge tous les pronos de l'utilisateur, indexés par match. */
export async function fetchPredictions(userId: string): Promise<Predictions> {
  const { data, error } = await supabase
    .from('predictions')
    .select('match_id, score_a, score_b, boosted')
    .eq('user_id', userId);
  if (error) throw error;

  const out: Predictions = {};
  for (const r of data ?? []) {
    out[r.match_id] = {
      scoreA: r.score_a ?? undefined,
      scoreB: r.score_b ?? undefined,
      boosted: r.boosted ?? false,
    };
  }
  return out;
}

/** Snapshot d'affichage + cote figée + scope, posé au moment de la saisie. */
export interface PredictionMeta {
  oddsA: number;
  oddsB: number;
  format: string;
  teamA: string;
  teamB: string;
  tournament: string;
  game: GameKey;
  /** Coup d'envoi du match — borne des ligues (kickoff ≥ adhésion). */
  matchStart: string | null;
  /** Id de série PandaScore — clé de scope des ligues. */
  serieId: string | null;
  /** Logos figés (pour de vraies cards dans Résultats). */
  teamALogo: string | null;
  teamBLogo: string | null;
}

/** Crée ou met à jour le prono d'un match (clé unique user+match). */
export async function savePrediction(
  userId: string,
  matchId: string,
  pred: Prediction,
  meta: PredictionMeta,
): Promise<void> {
  const { error } = await supabase.from('predictions').upsert(
    {
      user_id: userId,
      match_id: matchId,
      game: meta.game,
      score_a: pred.scoreA ?? null,
      score_b: pred.scoreB ?? null,
      boosted: pred.boosted ?? false,
      odds_a: meta.oddsA,
      odds_b: meta.oddsB,
      format: meta.format,
      team_a: meta.teamA,
      team_b: meta.teamB,
      tournament: meta.tournament,
      match_start: meta.matchStart,
      serie_id: meta.serieId,
      team_a_logo: meta.teamALogo,
      team_b_logo: meta.teamBLogo,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,match_id' },
  );
  if (error) throw error;
}

/** Un prono réglé (settled), pour la page Résultats. */
export interface ResultRow {
  matchId: string;
  game: GameKey;
  serieId: string | null;
  tournament: string | null;
  teamA: string | null;
  teamB: string | null;
  teamALogo: string | null;
  teamBLogo: string | null;
  scoreA: number | null; // prono
  scoreB: number | null;
  resultA: number | null; // résultat réel
  resultB: number | null;
  boosted: boolean;
  pointsAwarded: number;
  settled: boolean; // false = match commencé/fini mais pas encore réglé
}

/**
 * Pronos "passés" de l'utilisateur : réglés OU dont le match a déjà commencé
 * (kickoff passé), pour qu'un match fini non réglé ne disparaisse pas.
 */
export async function fetchResults(userId: string): Promise<ResultRow[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('predictions')
    .select(
      'match_id, game, serie_id, tournament, team_a, team_b, team_a_logo, team_b_logo, score_a, score_b, result_a, result_b, boosted, points_awarded, settled, match_start',
    )
    .eq('user_id', userId)
    .or(`settled.eq.true,match_start.lte.${now},match_start.is.null`)
    .order('match_start', { ascending: false, nullsFirst: false });
  if (error) throw error;

  return (data ?? []).map((r) => ({
    matchId: r.match_id,
    game: r.game as GameKey,
    serieId: r.serie_id ?? null,
    tournament: r.tournament ?? null,
    teamA: r.team_a ?? null,
    teamB: r.team_b ?? null,
    teamALogo: r.team_a_logo ?? null,
    teamBLogo: r.team_b_logo ?? null,
    scoreA: r.score_a ?? null,
    scoreB: r.score_b ?? null,
    resultA: r.result_a ?? null,
    resultB: r.result_b ?? null,
    boosted: r.boosted ?? false,
    pointsAwarded: r.points_awarded ?? 0,
    settled: r.settled ?? false,
  }));
}

export interface UserStats {
  total: number;
  successRate: number; // %
  streak: number; // bons pronos d'affilée (du plus récent)
  exactCount: number;
  best: {
    teamA: string | null;
    teamB: string | null;
    teamALogo: string | null;
    teamBLogo: string | null;
    scoreA: number | null;
    scoreB: number | null;
    resultA: number | null;
    resultB: number | null;
    game: GameKey;
    points: number;
    boosted: boolean;
    exact: boolean;
    tournament: string | null;
  } | null;
}

/** Bilan transversal de l'utilisateur (tous jeux/events confondus). */
export async function fetchUserStats(userId: string): Promise<UserStats> {
  const { data, error } = await supabase
    .from('predictions')
    .select('game, settled, points_awarded, score_a, score_b, result_a, result_b, team_a, team_b, team_a_logo, team_b_logo, tournament, boosted, match_start')
    .eq('user_id', userId)
    .order('match_start', { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const settled = rows.filter((r) => r.settled);
  const won = settled.filter((r) => (r.points_awarded ?? 0) > 0).length;
  const isExact = (r: { score_a: number | null; result_a: number | null; score_b: number | null; result_b: number | null }) =>
    r.score_a != null && r.score_a === r.result_a && r.score_b === r.result_b;

  let streak = 0;
  for (const r of settled) {
    if ((r.points_awarded ?? 0) > 0) streak++;
    else break;
  }

  let best: UserStats['best'] = null;
  for (const r of settled) {
    if (!best || (r.points_awarded ?? 0) > best.points) {
      best = {
        teamA: r.team_a ?? null,
        teamB: r.team_b ?? null,
        teamALogo: r.team_a_logo ?? null,
        teamBLogo: r.team_b_logo ?? null,
        scoreA: r.score_a ?? null,
        scoreB: r.score_b ?? null,
        resultA: r.result_a ?? null,
        resultB: r.result_b ?? null,
        game: r.game as GameKey,
        points: r.points_awarded ?? 0,
        boosted: r.boosted ?? false,
        exact: isExact(r),
        tournament: r.tournament ?? null,
      };
    }
  }

  return {
    total: rows.length,
    successRate: settled.length ? Math.round((won / settled.length) * 100) : 0,
    streak,
    exactCount: settled.filter(isExact).length,
    best,
  };
}

/** Mon meilleur prono gagnant sur un scope donné (pour le bilan de fin de ligue). */
export interface ScopedBest {
  teamA: string | null;
  teamB: string | null;
  scoreA: number | null;
  scoreB: number | null;
  points: number;
  boosted: boolean;
}

export async function fetchBestInScope(
  userId: string,
  game: string | null,
  serieId: string | null,
): Promise<ScopedBest | null> {
  let q = supabase
    .from('predictions')
    .select('team_a, team_b, score_a, score_b, points_awarded, boosted')
    .eq('user_id', userId)
    .eq('settled', true)
    .order('points_awarded', { ascending: false })
    .limit(1);
  if (game) q = q.eq('game', game);
  if (serieId) q = q.eq('serie_id', serieId);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const r = (data ?? [])[0];
  if (!r || (r.points_awarded ?? 0) <= 0) return null;
  return {
    teamA: r.team_a ?? null,
    teamB: r.team_b ?? null,
    scoreA: r.score_a ?? null,
    scoreB: r.score_b ?? null,
    points: r.points_awarded ?? 0,
    boosted: r.boosted ?? false,
  };
}

/** Ids des matchs déjà réglés (pour les retirer du feed). */
export async function fetchSettledMatchIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('predictions')
    .select('match_id')
    .eq('user_id', userId)
    .eq('settled', true);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.match_id));
}
