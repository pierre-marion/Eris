import type { GameKey } from './theme';

export type Format = 'BO1' | 'BO3' | 'BO5';
export type MatchStatus = 'open' | 'live' | 'locked';

export interface Team {
  id: string;
  tag: string; // sigle court (acronyme) — fallback quand pas de logo
  name: string;
  logo?: string; // URL du logo (PandaScore image_url), nullable
  /** Rating officiel figé avant match : PWR Riot (Valo/LoL) ou VRS Valve (CS2). */
  rating?: number;
}

export interface Match {
  id: string;
  game: GameKey;
  tournament: string;
  format: Format;
  /** Date/heure de début, ISO-8601 (PandaScore begin_at). null si non planifié. */
  startsAt: string | null;
  /** Id de série PandaScore — clé de scope stable pour les ligues (nom = affichage). */
  serieId: string | null;
  /** Round / phase (Group Alpha, Playoffs, Grand Final…) — depuis tournament.name. */
  stage?: string | null;
  /** Nom brut du match (« Upper bracket final: X vs Y ») — sert à déduire l'enjeu. */
  matchName?: string | null;
  /** URL du stream (Twitch/YouTube), si dispo. */
  stream?: string | null;
  status: MatchStatus;
  teamA: Team;
  teamB: Team;
  /** Cotes = points de base façon MPP (issue rare = plus de points). */
  oddsA: number;
  oddsB: number;
  /** Bonus rareté si le score exact est trouvé (+20/+30/+50/+70/+100). */
  exactBonus: number;
}

export interface Prediction {
  /** Score saisi à la main (maps gagnées par chaque équipe). */
  scoreA?: number;
  scoreB?: number;
  boosted?: boolean;
}

export type Predictions = Record<string, Prediction>;
