import { supabase } from './supabase';

export interface League {
  id: string;
  name: string;
  code: string;
  owner_id: string;
  game: string | null;
  serie_id: string | null;
  tournament: string | null;
  parent_id?: string | null;
  created_at: string;
}

export interface LeagueStanding {
  user_id: string;
  username: string;
  points: number;
  rank: number;
}

/** Mes ligues (RLS : seulement celles dont je suis membre actif). */
export async function fetchMyLeagues(): Promise<League[]> {
  const { data, error } = await supabase
    .from('leagues')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as League[];
}

/** Aperçu du code dérivé du nom (indicatif — le serveur gère les collisions). */
export function deriveCodePreview(name: string): string {
  const base = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || 'LIG';
  const yy = String(new Date().getFullYear()).slice(-2);
  return `${base}-${yy}`;
}

/** Crée une ligue scopée (game + serie optionnelle) et m'y ajoute. */
export async function createLeague(
  name: string,
  game: string | null,
  serieId: string | null,
  tournament: string | null,
): Promise<League> {
  const { data, error } = await supabase.rpc('create_league', {
    p_name: name,
    p_game: game,
    p_serie_id: serieId,
    p_tournament: tournament,
  });
  if (error) throw new Error(error.message);
  return data as League;
}

/** Rejouer : crée une ligue enfant (parent → enfant) sur l'event suivant, mêmes potes. */
export async function rematchLeague(
  leagueId: string,
  serieId: string,
  tournament: string,
): Promise<League> {
  const { data, error } = await supabase.rpc('rematch_league', {
    p_league_id: leagueId,
    p_serie_id: serieId,
    p_tournament: tournament,
  });
  if (error) throw new Error(error.message);
  return data as League;
}

export interface LeaguePreview {
  id: string;
  name: string;
  code: string;
  game: string | null;
  serie_id: string | null;
  tournament: string | null;
  ownerUsername: string | null;
  memberCount: number;
}

/** Aperçu d'une ligue par code, sans la rejoindre (null si code invalide). */
export async function previewLeague(code: string): Promise<LeaguePreview | null> {
  const { data, error } = await supabase.rpc('preview_league', { p_code: code });
  if (error) throw new Error(error.message);
  const r = (data ?? [])[0];
  if (!r) return null;
  return {
    id: r.id,
    name: r.name,
    code: r.code,
    game: r.game ?? null,
    serie_id: r.serie_id ?? null,
    tournament: r.tournament ?? null,
    ownerUsername: r.owner_username ?? null,
    memberCount: Number(r.member_count ?? 0),
  };
}

/** Rejoint une ligue via son code d'invitation. */
export async function joinLeague(code: string): Promise<League> {
  const { data, error } = await supabase.rpc('join_league', { p_code: code });
  if (error) throw new Error(error.message);
  return data as League;
}

/** Quitte une ligue (soft delete). */
export async function leaveLeague(leagueId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_league', { p_league_id: leagueId });
  if (error) throw new Error(error.message);
}

/** Supprime une ligue (créateur seulement). */
export async function deleteLeague(leagueId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_league', { p_league_id: leagueId });
  if (error) throw new Error(error.message);
}

export interface ActivityRow {
  username: string;
  points: number;
  teamA: string | null;
  teamB: string | null;
  scoreA: number | null;
  scoreB: number | null;
  boosted: boolean;
  tournament: string | null;
  at: string;
}

/** Feed d'activité d'une ligue (gros pronos gagnants des membres). */
export async function fetchLeagueActivity(leagueId: string): Promise<ActivityRow[]> {
  const { data, error } = await supabase.rpc('league_activity', { p_league_id: leagueId });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    username: r.username ?? 'Joueur',
    points: r.points ?? 0,
    teamA: r.team_a ?? null,
    teamB: r.team_b ?? null,
    scoreA: r.score_a ?? null,
    scoreB: r.score_b ?? null,
    boosted: r.boosted ?? false,
    tournament: r.tournament ?? null,
    at: r.at,
  }));
}

export interface DynastyEdition {
  leagueId: string;
  tournament: string | null;
  serieId: string | null;
  createdAt: string;
  championId: string | null;
  championUsername: string | null;
  championPoints: number;
}

/** Toutes les éditions d'une dynastie (chaîne parent→enfant) + leur champion. */
export async function fetchDynasty(leagueId: string): Promise<DynastyEdition[]> {
  const { data, error } = await supabase.rpc('league_dynasty', { p_league_id: leagueId });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    leagueId: r.league_id,
    tournament: r.tournament ?? null,
    serieId: r.serie_id ?? null,
    createdAt: r.created_at,
    championId: r.champion_id ?? null,
    championUsername: r.champion_username ?? null,
    championPoints: Number(r.champion_points ?? 0),
  }));
}

export interface DynastyCrown {
  id: string;
  username: string;
  crowns: number;
}

/**
 * Couronnes par joueur, comptées uniquement sur les éditions TERMINÉES.
 * `isFinished` décide via le statut de l'event (PandaScore) — une édition en cours
 * affiche un meneur, pas un champion.
 */
export function dynastyCrowns(
  editions: DynastyEdition[],
  isFinished: (e: DynastyEdition) => boolean,
): DynastyCrown[] {
  const map = new Map<string, DynastyCrown>();
  for (const e of editions) {
    if (!e.championId || e.championPoints <= 0 || !isFinished(e)) continue;
    const cur = map.get(e.championId) ?? { id: e.championId, username: e.championUsername ?? 'joueur', crowns: 0 };
    cur.crowns += 1;
    map.set(e.championId, cur);
  }
  return [...map.values()].sort((a, b) => b.crowns - a.crowns);
}

/** Classement scopé d'une ligue (scope fixe de création). */
export async function fetchLeagueLeaderboard(leagueId: string): Promise<LeagueStanding[]> {
  const { data, error } = await supabase.rpc('league_leaderboard', { p_league_id: leagueId });
  if (error) throw new Error(error.message);
  return (data ?? []) as LeagueStanding[];
}

/** Classement live d'une ligue scopé sur l'event du header (game + serie_id, null = tout). */
export async function fetchLeagueEventLeaderboard(
  leagueId: string,
  game: string | null,
  serieId: string | null,
): Promise<LeagueStanding[]> {
  const { data, error } = await supabase.rpc('league_event_leaderboard', {
    p_league_id: leagueId,
    p_game: game,
    p_serie_id: serieId,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as LeagueStanding[];
}
