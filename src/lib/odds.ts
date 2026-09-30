import type { GameKey } from '../theme';

/**
 * Moteur de cotes ÉRIS.
 * Chaîne : classement officiel → proba de victoire → cote → points.
 * Aucune cote bookmaker (pas de signal casino / souci ANJ) — on calcule tout
 * à partir des ratings (PWR Riot pour Valo/LoL, VRS Valve pour CS2).
 *
 * Deux convertisseurs proba selon le jeu, puis tronc commun proba→points.
 */

/** Boutons de calibrage (à ajuster après le premier tournoi). */
export const ODDS_PARAMS = {
  /** Échelle Elo (Valo/LoL) : amplitude d'un écart de PWR. */
  S: 400,
  /** Ordre de grandeur des points. */
  base: 30,
  /** Amplification des upsets (1.3 modéré → 1.5 spectacle MPP fort). */
  gonflage: 1.3,
  /** Adoucissement du ratio CS2 (0<k<1 ; ~0.6 = sweet spot). */
  k: 0.6,
  /** Garde-fous : aucun match plus extrême que pMax/pMin → plafonne les upsets. */
  pMin: 0.2,
  pMax: 0.8,
};

type Params = typeof ODDS_PARAMS;

/**
 * Proba que A batte B.
 *  - Valo/LoL : Elo standard (le PWR est déjà un Elo calibré).
 *  - CS2 : ratio VRS adouci par l'exposant k (le ratio brut écrase trop les outsiders).
 */
export function winProbability(
  ratingA: number,
  ratingB: number,
  game: GameKey,
  p: Params = ODDS_PARAMS,
): number {
  if (game === 'cs') {
    const a = Math.pow(Math.max(ratingA, 1), p.k);
    const b = Math.pow(Math.max(ratingB, 1), p.k);
    return a / (a + b);
  }
  // Valo / LoL — Elo
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / p.S));
}

/** Cote = 1 / proba. */
export function odds(prob: number): number {
  return 1 / prob;
}

/** Points encaissés si on a le bon vainqueur : base × cote^gonflage (proba bornée). */
export function winnerPoints(prob: number, p: Params = ODDS_PARAMS): number {
  const clamped = Math.min(Math.max(prob, p.pMin), p.pMax);
  return Math.round(p.base * Math.pow(odds(clamped), p.gonflage));
}

/**
 * Levier 2 — bonus rareté sur le score EXACT, fonction du % de toute l'app
 * ayant trouvé ce score (rareté globale, comme MPP). S'auto-adapte BO3/BO5 :
 * le % réel observé dépend du format, une seule règle gère les deux.
 *   >40% +10 · 20–40% +20 · 8–20% +40 · 2–8% +70 · <2% +100
 * NB : le % vient de l'agrégation des pronos à la clôture du match (settlement),
 * pas calculable au moment de la saisie.
 */
export function rarityBonus(pctFoundExact: number): number {
  if (pctFoundExact >= 40) return 10;
  if (pctFoundExact >= 20) return 20;
  if (pctFoundExact >= 8) return 40;
  if (pctFoundExact >= 2) return 70;
  return 100;
}

/** Points de cote des deux équipes d'un match (Levier 1). */
export function matchWinnerPoints(
  ratingA: number,
  ratingB: number,
  game: GameKey,
  p: Params = ODDS_PARAMS,
): { probA: number; pointsA: number; pointsB: number } {
  const probA = winProbability(ratingA, ratingB, game, p);
  return {
    probA,
    pointsA: winnerPoints(probA, p),
    pointsB: winnerPoints(1 - probA, p),
  };
}
