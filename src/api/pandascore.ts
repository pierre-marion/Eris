import type { GameKey } from '../theme';
import type { Format, Match, MatchStatus, Team } from '../types';
import { matchWinnerPoints } from '../lib/odds';
import { getRatings, lookupRating, type RatingMap } from '../ratings';

/**
 * Client PandaScore.
 * Contrat vérifié sur developers.pandascore.co :
 *  - Auth : header `Authorization: Bearer <token>`
 *  - Slugs : valorant / csgo (CS2 sert sous csgo) / lol
 *  - Upcoming : GET /{slug}/matches/upcoming
 *  - tier : sur `tournament.tier` ('s','a',...) — pas de filtre serveur sur /matches,
 *    donc on filtre côté client sur tier ∈ {'s','a','b'} (top pro ; c/d = mineur, jeté).
 *  - logo équipe : opponents[i].opponent.image_url (nullable)
 *  - PAS d'odds dans l'API standard -> on synthétise des cotes déterministes.
 */

const BASE = 'https://api.pandascore.co';
const TOKEN = process.env.EXPO_PUBLIC_PANDASCORE_TOKEN ?? '';

export const hasToken = (): boolean => TOKEN.trim().length > 0;

const GAME_SLUG: Record<GameKey, string> = {
  valorant: 'valorant',
  cs: 'csgo',
  lol: 'lol',
  cod: 'codmw', // Call of Duty: Modern Warfare (slug officiel PandaScore)
};

// --- Formes brutes PandaScore (partielles) ---
interface PSTeam {
  id: number;
  name: string;
  acronym: string | null;
  image_url: string | null;
}
interface PSOpponent {
  type: string;
  opponent: PSTeam | null;
}
interface PSMatch {
  id: number;
  begin_at: string | null;
  status: string;
  number_of_games: number;
  league: { name: string | null } | null;
  serie: { id: number | null; full_name: string | null; name: string | null } | null;
  tournament: { name: string | null; tier: string | null } | null;
  opponents: PSOpponent[];
  results?: { score: number; team_id: number }[];
  winner_id?: number | null;
  name?: string | null;
  streams_list?: { raw_url: string | null; official?: boolean; main?: boolean }[];
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`PandaScore ${res.status} sur ${path}${body ? ` — ${body.slice(0, 120)}` : ''}`);
  }
  return res.json() as Promise<T>;
}

// --- Synthèse de cotes (pas d'odds dans l'API) : déterministe et stable. ---
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
const synthOdds = (seed: string): number => 55 + (hash(seed) % 120); // 55..174
const BONUS_TIERS = [20, 30, 50, 70, 100];

function mapStatus(s: string): MatchStatus {
  if (s === 'running') return 'live';
  if (s === 'not_started') return 'open';
  return 'locked'; // finished / canceled / postponed
}

/**
 * Corrections de tags : PandaScore renvoie parfois un acronyme court/inattendu
 * (ex. Paper Rex -> "PR" alors que tout le monde dit "PRX"). Clé = nom en minuscules.
 */
const TAG_OVERRIDES: Record<string, string> = {
  'paper rex': 'PRX',
};

function mapTeam(o: PSOpponent): Team | null {
  const t = o?.opponent;
  if (!t) return null;
  const override = TAG_OVERRIDES[t.name.trim().toLowerCase()];
  const acronym = t.acronym?.trim();
  // Priorité : override > acronyme PandaScore > nom tronqué.
  const tag = override || (acronym && acronym.length > 0 ? acronym : t.name.slice(0, 4).toUpperCase());
  return { id: String(t.id), tag, name: t.name, logo: t.image_url ?? undefined };
}

/** Met une majuscule par mot si le libellé est tout en minuscules (cas fréquent côté PandaScore). */
function cleanLabel(s: string): string {
  if (s !== s.toLowerCase()) return s; // déjà des majuscules -> on n'y touche pas
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Libellé de compétition = ligue + série combinées (sans doublon).
 *  - "LEC" + "Split 2"        -> "LEC Split 2"
 *  - "IEM" + "Cologne 2026"   -> "IEM Cologne"
 *  - serie qui contient déjà la ligue ("VCT Masters London") -> tel quel
 */
function buildLabel(
  leagueName?: string | null,
  serieFull?: string | null,
  serieName?: string | null,
  tournamentName?: string | null,
): string {
  const league = leagueName?.trim();
  const serie = (serieFull || serieName)?.trim();
  let label: string;
  if (league && serie && !serie.toLowerCase().includes(league.toLowerCase())) {
    label = `${league} ${serie}`;
  } else {
    label = serie || league || tournamentName?.trim() || 'Tournoi';
  }
  return cleanLabel(stripYear(label));
}

function competitionName(m: PSMatch): string {
  return buildLabel(m.league?.name, m.serie?.full_name, m.serie?.name, m.tournament?.name);
}

/** Enlève l'année (2026, …) et nettoie les espaces/séparateurs résiduels. */
function stripYear(s: string): string {
  return s
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s*[·\-–|]\s*|\s*[·\-–|]\s*$/g, '')
    .trim();
}

/** Mappe un match PandaScore vers notre modèle — null si hors périmètre. */
function mapMatch(game: GameKey, m: PSMatch, ratings: RatingMap): Match | null {
  // tier S + A + B : PandaScore range le top pro de façon incohérente — ex. VCT
  // Americas=a mais VCT China/Pacific=b, LCP LoL=b. Le vrai mineur (VCL, CCT, KeSPA…)
  // est en c/d. On garde s/a/b, on jette c/d.
  const tier = m.tournament?.tier?.toLowerCase();
  if (tier !== 's' && tier !== 'a' && tier !== 'b') return null;
  if (m.number_of_games !== 1 && m.number_of_games !== 3 && m.number_of_games !== 5) return null; // BO1/BO3/BO5
  const teams = m.opponents.map(mapTeam).filter((t): t is Team => t !== null);
  if (teams.length < 2) return null;
  const [teamA, teamB] = teams;

  // Cotes via le moteur si on a les ratings des deux équipes ; sinon estimation.
  const rA = lookupRating(ratings, teamA);
  const rB = lookupRating(ratings, teamB);
  let oddsA: number;
  let oddsB: number;
  if (rA != null && rB != null) {
    teamA.rating = rA;
    teamB.rating = rB;
    const r = matchWinnerPoints(rA, rB, game);
    oddsA = r.pointsA;
    oddsB = r.pointsB;
  } else {
    oddsA = synthOdds(`${teamA.id}:${m.id}`);
    oddsB = synthOdds(`${teamB.id}:${m.id}`);
  }

  return {
    id: String(m.id),
    game,
    tournament: competitionName(m),
    format: m.number_of_games === 1 ? 'BO1' : m.number_of_games >= 5 ? 'BO5' : 'BO3',
    startsAt: m.begin_at,
    serieId: m.serie?.id != null ? String(m.serie.id) : null,
    stage: m.tournament?.name ? cleanLabel(stripYear(m.tournament.name)) : null,
    matchName: m.name ?? null,
    stream: pickStream(m.streams_list),
    status: mapStatus(m.status),
    teamA,
    teamB,
    oddsA,
    oddsB,
    exactBonus: BONUS_TIERS[hash(String(m.id)) % BONUS_TIERS.length],
  };
}

interface PSTournamentSerie {
  begin_at: string | null;
  end_at: string | null;
  league: { name: string | null } | null;
  serie: { id: number | null; full_name: string | null; name: string | null } | null;
}

export type EventStatus = 'live' | 'upcoming' | 'past';
export interface SerieInfo {
  serieId: string;
  name: string;
  status: EventStatus;
}

/**
 * Lancement Éris (mi-2026) : on n'affiche que les events 2026 à partir de là —
 * régionales VCT (EMEA/Americas/China/Pacific), Masters, Champions, futurs tier S/A.
 * Les events finis avant le lancement (Kickoff, stages antérieurs) sont masqués.
 * Ajuste cette date si tu veux remonter/descendre le début de saison.
 */
const APP_LAUNCH = Date.parse('2026-05-15');
const SEASON_END = Date.parse('2027-01-01'); // events de l'année 2026 uniquement

/**
 * Catalogue des events (séries) tier S+A d'un jeu, avec statut.
 *  - tier S + A : circuit pro (internationaux + ligues régionales VCT/LEC…),
 *    sans les mineures (Challengers/academy en tier B+).
 *  - statut dérivé des dates : en cours / à venir / terminé.
 * Inclut les events à venir dès que PandaScore les crée (Champions, EWC, Stage 2…).
 */
export async function fetchGameSeries(game: GameKey): Promise<SerieInfo[]> {
  const raw = await getJSON<PSTournamentSerie[]>(
    `/${GAME_SLUG[game]}/tournaments?filter%5Btier%5D=s,a,b&sort=-begin_at&per_page=100`,
  );
  const now = Date.now();
  // On agrège par SÉRIE, mais le statut se décide au niveau TOURNOI :
  //  - anyLive : un tournoi de la série tourne réellement maintenant (begin ≤ now ≤ end),
  //  - nextBegin : le prochain tournoi à venir (le plus proche),
  //  - latestEnd/earliestBegin : bornes globales (filtre saison + tri des passés).
  // Sinon une série « LCK 2026 » (Spring fini + Summer à venir) serait marquée « en cours »
  // juste parce que la date tombe dans [janvier … août].
  type Agg = { name: string; anyLive: boolean; nextBegin: number; latestEnd: number; earliestBegin: number };
  const agg = new Map<string, Agg>();
  for (const t of raw) {
    const s = t.serie;
    if (s?.id == null) continue;
    const id = String(s.id);
    const b = t.begin_at ? Date.parse(t.begin_at) : NaN;
    const e = t.end_at ? Date.parse(t.end_at) : NaN;
    let cur = agg.get(id);
    if (!cur) {
      cur = {
        name: buildLabel(t.league?.name, s.full_name, s.name),
        anyLive: false,
        nextBegin: Infinity,
        latestEnd: 0,
        earliestBegin: Infinity,
      };
      agg.set(id, cur);
    }
    if (!isNaN(b)) cur.earliestBegin = Math.min(cur.earliestBegin, b);
    if (!isNaN(e)) cur.latestEnd = Math.max(cur.latestEnd, e);
    // « live » exige un vrai tournoi en cours (begin ET end connus, now dedans).
    if (!isNaN(b) && !isNaN(e) && b <= now && now <= e) cur.anyLive = true;
    // prochain tournoi à venir de la série.
    if (!isNaN(b) && b > now) cur.nextBegin = Math.min(cur.nextBegin, b);
  }

  type Row = { serieId: string; name: string; status: EventStatus; sortKey: number };
  const rows: Row[] = [];
  for (const [serieId, v] of agg) {
    const end = v.latestEnd > 0 ? v.latestEnd : null;
    const begin = v.earliestBegin === Infinity ? null : v.earliestBegin;

    // Saison Éris : exclure les events finis avant le lancement de l'app…
    if (end !== null && end < APP_LAUNCH) continue;
    if (end === null && begin !== null && begin < APP_LAUNCH) continue;
    // …et garder l'année 2026 uniquement.
    if (v.nextBegin !== Infinity && v.nextBegin >= SEASON_END && !v.anyLive) continue;

    let status: EventStatus;
    let sortKey: number;
    if (v.anyLive) {
      status = 'live';
      sortKey = end ?? now; // live : fin la plus proche d'abord
    } else if (v.nextBegin !== Infinity) {
      status = 'upcoming';
      sortKey = v.nextBegin; // à venir : le plus proche en tête
    } else {
      status = 'past';
      sortKey = -(end ?? 0); // passés : le plus récent en tête
    }
    rows.push({ serieId, name: v.name, status, sortKey });
  }

  // Tri : en cours d'abord, puis à venir (le plus proche en tête), puis passés (récent d'abord).
  const rank: Record<EventStatus, number> = { live: 0, upcoming: 1, past: 2 };
  rows.sort((x, y) => {
    if (rank[x.status] !== rank[y.status]) return rank[x.status] - rank[y.status];
    return x.sortKey - y.sortKey;
  });
  return rows.map(({ serieId, name, status }) => ({ serieId, name, status }));
}

/**
 * Scores LIVE des matchs en cours (par id), orientés A/B comme l'app (opponents[0]=A).
 * Affichés dans Résultats sans valider le prono (la validation = settlement à la fin).
 */
export async function fetchLiveScores(): Promise<Record<string, { a: number; b: number }>> {
  if (!hasToken()) return {};
  const games: GameKey[] = ['valorant', 'cs', 'lol', 'cod'];
  const out: Record<string, { a: number; b: number }> = {};
  await Promise.all(
    games.map(async (g) => {
      try {
        const raw = await getJSON<PSMatch[]>(`/${GAME_SLUG[g]}/matches/running?per_page=50`);
        for (const m of raw) {
          const aId = m.opponents?.[0]?.opponent?.id;
          const bId = m.opponents?.[1]?.opponent?.id;
          const sa = m.results?.find((r) => r.team_id === aId)?.score;
          const sb = m.results?.find((r) => r.team_id === bId)?.score;
          if (sa != null && sb != null) out[String(m.id)] = { a: sa, b: sb };
        }
      } catch (e) {
        console.warn(`Live scores ${g}:`, e instanceof Error ? e.message : e);
      }
    }),
  );
  return out;
}

function pickStream(list?: { raw_url: string | null; official?: boolean; main?: boolean }[]): string | null {
  if (!list?.length) return null;
  const off = list.find((s) => s.official && s.raw_url);
  const main = list.find((s) => s.main && s.raw_url);
  const any = list.find((s) => s.raw_url);
  return (off ?? main ?? any)?.raw_url ?? null;
}

/** Face-à-face : bilan des confrontations directes entre deux équipes (+ les récentes). */
export async function fetchH2H(
  game: GameKey,
  aId: string,
  bId: string,
): Promise<{ aWins: number; bWins: number; recent: { aWon: boolean }[] }> {
  if (!hasToken()) return { aWins: 0, bWins: 0, recent: [] };
  try {
    const raw = await getJSON<PSMatch[]>(
      `/${GAME_SLUG[game]}/matches/past?filter%5Bopponent_id%5D=${aId}&sort=-begin_at&per_page=50`,
    );
    const aIdN = Number(aId);
    const bIdN = Number(bId);
    const h2h = raw.filter(
      (m) => m.winner_id != null && (m.opponents ?? []).some((o) => o.opponent?.id === bIdN),
    );
    let aWins = 0;
    let bWins = 0;
    for (const m of h2h) {
      if (m.winner_id === aIdN) aWins++;
      else if (m.winner_id === bIdN) bWins++;
    }
    return { aWins, bWins, recent: h2h.slice(0, 5).map((m) => ({ aWon: m.winner_id === aIdN })) };
  } catch (e) {
    console.warn('fetchH2H:', e);
    return { aWins: 0, bWins: 0, recent: [] };
  }
}

/** Forme récente d'une équipe : les N derniers résultats (V/D), plus récent d'abord. */
export async function fetchRecentForm(game: GameKey, teamId: string, n = 5): Promise<('V' | 'D')[]> {
  if (!hasToken()) return [];
  try {
    const raw = await getJSON<PSMatch[]>(
      `/${GAME_SLUG[game]}/matches/past?filter%5Bopponent_id%5D=${teamId}&sort=-begin_at&per_page=${n}`,
    );
    const tid = Number(teamId);
    return raw
      .filter((m) => m.winner_id != null)
      .map((m) => (m.winner_id === tid ? 'V' : 'D'));
  } catch (e) {
    console.warn('fetchRecentForm:', e);
    return [];
  }
}

/** Récupère les matchs à venir tier S de Valorant, CS et LoL (cotes via ratings). */
export async function fetchTierSMatches(): Promise<Match[]> {
  const games: GameKey[] = ['valorant', 'cs', 'lol', 'cod'];
  const query =
    'per_page=100&sort=begin_at&filter%5Bopponents_filled%5D=true'; // filter[opponents_filled]=true

  const perGame = await Promise.all(
    games.map(async (g) => {
      try {
        // upcoming (not_started) + running (live) : sinon un match qui démarre disparaît.
        const [upcoming, running, ratings] = await Promise.all([
          getJSON<PSMatch[]>(`/${GAME_SLUG[g]}/matches/upcoming?${query}`).catch((e) => {
            console.warn(`Upcoming ${g}:`, e instanceof Error ? e.message : e);
            return [];
          }),
          getJSON<PSMatch[]>(`/${GAME_SLUG[g]}/matches/running?${query}`).catch((e) => {
            console.warn(`Running ${g}:`, e instanceof Error ? e.message : e);
            return [];
          }),
          getRatings(g),
        ]);
        const byId = new Map<number, PSMatch>();
        for (const m of [...running, ...upcoming]) byId.set(m.id, m); // live en premier
        return [...byId.values()]
          .map((m) => mapMatch(g, m, ratings))
          .filter((m): m is Match => m !== null);
      } catch (e) {
        // un jeu en échec (slug invalide, 404…) ne doit pas couper les autres
        console.warn(`Matchs ${g}:`, e instanceof Error ? e.message : e);
        return [];
      }
    }),
  );

  return perGame.flat();
}
