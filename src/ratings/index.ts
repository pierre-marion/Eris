import AsyncStorage from '@react-native-async-storage/async-storage';
import { games as GAME_DEFS, type GameKey } from '../theme';
import type { Team } from '../types';
import { supabase } from '../lib/supabase';

/**
 * Fournisseur de ratings (snapshot des classements officiels).
 *   - CS2  : VRS Valve — repo GitHub officiel (Markdown). ✅ auto, fiable.
 *   - Valo : PWR Riot / vlr.gg — pas d'API propre (scraper à héberger). ⏳ à venir.
 *   - LoL  : pas de flux de rating — Elo à calculer. ⏳ à venir.
 *
 * Renvoie une map { nom_normalisé -> rating } par jeu, mise en cache (TTL).
 */

export type RatingMap = Record<string, number>;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 h
const cacheKey = (g: GameKey) => `eris.ratings.${g}`;

/** Normalise un nom d'équipe pour le matching (casse, accents, mots parasites). */
export function normalizeTeam(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(team|esports?|gaming|club|gg)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Corrections manuelles : nom PandaScore normalisé -> nom source normalisé. */
const NAME_OVERRIDES: Record<string, string> = {
  // ex. 'navi': 'natusvincere',
};

/** Cherche le rating d'une équipe dans une map (nom, puis acronyme, puis override). */
export function lookupRating(map: RatingMap, team: Team): number | undefined {
  const byName = map[normalizeTeam(team.name)];
  if (byName != null) return byName;
  const override = NAME_OVERRIDES[normalizeTeam(team.name)];
  if (override && map[override] != null) return map[override];
  const byTag = map[normalizeTeam(team.tag)];
  return byTag;
}

// ─────────────────────────────────────────────────────────────
// CS2 — VRS Valve (officiel)
// ─────────────────────────────────────────────────────────────
const VRS_REPO = 'ValveSoftware/counter-strike_regional_standings';

async function fetchCs2Ratings(): Promise<RatingMap> {
  const year = new Date().getFullYear();
  const file = (await latestGlobalFile(year)) ?? (await latestGlobalFile(year - 1));
  if (!file) throw new Error('VRS : aucun snapshot trouvé');

  const raw = `https://raw.githubusercontent.com/${VRS_REPO}/main/live/${file.year}/${file.name}`;
  const md = await (await fetch(raw)).text();

  const map: RatingMap = {};
  for (const line of md.split('\n')) {
    if (!/^\|\s*\d+\s*\|/.test(line)) continue; // lignes de classement uniquement
    const cells = line.split('|').map((c) => c.trim());
    const points = parseInt(cells[2], 10);
    const name = cells[3];
    if (name && !isNaN(points)) map[normalizeTeam(name)] = points;
  }
  return map;
}

async function latestGlobalFile(year: number): Promise<{ name: string; year: number } | null> {
  const api = `https://api.github.com/repos/${VRS_REPO}/contents/live/${year}`;
  const res = await fetch(api, { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) return null;
  const files: Array<{ name: string }> = await res.json();
  const globals = files
    .map((f) => f.name)
    .filter((n) => n.startsWith('standings_global_'))
    .sort();
  const name = globals[globals.length - 1];
  return name ? { name, year } : null;
}

// ─────────────────────────────────────────────────────────────
// Dispatch + cache
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// Valo / LoL — table `ratings` Supabase (seedée depuis le GPR officiel Riot)
// ─────────────────────────────────────────────────────────────
async function fetchTableRatings(game: GameKey): Promise<RatingMap> {
  const { data, error } = await supabase
    .from('ratings')
    .select('team, rating')
    .eq('game', game);
  if (error) throw error;
  const map: RatingMap = {};
  for (const r of data ?? []) map[normalizeTeam(r.team)] = Number(r.rating);
  return map;
}

const FETCHERS: Partial<Record<GameKey, () => Promise<RatingMap>>> = {
  cs: fetchCs2Ratings, // auto (repo Valve)
  valorant: () => fetchTableRatings('valorant'), // table seedée GPR
  lol: () => fetchTableRatings('lol'), // table seedée GPR
};

async function readCache(game: GameKey): Promise<RatingMap | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(game));
    if (!raw) return null;
    const { at, data } = JSON.parse(raw) as { at: number; data: RatingMap };
    if (Date.now() - at > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}

async function writeCache(game: GameKey, data: RatingMap) {
  try {
    await AsyncStorage.setItem(cacheKey(game), JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* cache best-effort */
  }
}

/** Ratings d'un jeu (cache → fetch → cache périmé en secours). {} si pas de source. */
export async function getRatings(game: GameKey): Promise<RatingMap> {
  const fetcher = FETCHERS[game];
  if (!fetcher) return {};

  const cached = await readCache(game);
  if (cached) return cached;

  try {
    const fresh = await fetcher();
    await writeCache(game, fresh);
    return fresh;
  } catch (e) {
    console.warn(`Ratings ${game}:`, e instanceof Error ? e.message : e);
    // secours : un cache périmé vaut mieux que rien
    const raw = await AsyncStorage.getItem(cacheKey(game)).catch(() => null);
    if (raw) return (JSON.parse(raw) as { data: RatingMap }).data;
    return {};
  }
}

/** Toutes les maps de ratings, par jeu (jeux sans source → {} → cotes synthétiques). */
export async function getAllRatings(): Promise<Record<GameKey, RatingMap>> {
  const keys = Object.keys(GAME_DEFS) as GameKey[];
  const maps = await Promise.all(keys.map((g) => getRatings(g)));
  return Object.fromEntries(keys.map((k, i) => [k, maps[i]])) as Record<GameKey, RatingMap>;
}
