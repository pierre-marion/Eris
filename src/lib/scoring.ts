import type { Format, Match, Prediction } from '../types';

/** Nombre de maps que doit gagner le vainqueur selon le format. */
export function mapsToWin(format: Format): number {
  if (format === 'BO5') return 3;
  if (format === 'BO1') return 1;
  return 2;
}

/**
 * Un score de série est-il valide pour le format ?
 * BO1 -> le vainqueur a exactement 1 map, le perdant 0.
 * BO3 -> le vainqueur a exactement 2 maps, le perdant 0 ou 1.
 * BO5 -> exactement 3 / perdant 0..2.
 */
export function isValidSeries(format: Format, a?: number, b?: number): boolean {
  if (a == null || b == null || a === b) return false;
  const win = mapsToWin(format);
  return Math.max(a, b) === win && Math.min(a, b) < win;
}

/** Vainqueur déduit du score saisi (celui qui a le plus de maps). */
export function derivedWinner(match: Match, pred?: Prediction): string | undefined {
  if (!pred || pred.scoreA == null || pred.scoreB == null || pred.scoreA === pred.scoreB) {
    return undefined;
  }
  return pred.scoreA > pred.scoreB ? match.teamA.id : match.teamB.id;
}

/**
 * Gain MINIMUM d'un prono = la cote du bon vainqueur (×2 si boosté).
 * Le bonus rareté du score exact n'est PAS compté ici : il est incertain
 * (dépend du % de joueurs ayant trouvé le score) et s'ajoute à la clôture.
 * Un score impossible (ou incomplet) ne rapporte rien.
 */
export function potentialPoints(match: Match, pred?: Prediction): number {
  if (!isValidSeries(match.format, pred?.scoreA, pred?.scoreB)) return 0;
  const winner = derivedWinner(match, pred);
  let total = winner === match.teamA.id ? match.oddsA : match.oddsB;
  if (pred?.boosted) total *= 2;
  return total;
}
