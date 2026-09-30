import type { GameKey } from './theme';

/** L'event actif dans le scope global. */
export type EventScope =
  | { type: 'all' } // tout le jeu
  | { type: 'annual' } // cumul saison (couche marathon)
  | { type: 'event'; serieId: string; label: string };

/** Scope global { jeu, event } — la colonne vertébrale de la nav. */
export interface Scope {
  game: GameKey;
  event: EventScope;
}

export const ALL_SCOPE: EventScope = { type: 'all' };

/** Libellé court de l'event pour le header. */
export function eventLabel(e: EventScope, gameLabel: string): string {
  if (e.type === 'annual') return 'Classement annuel';
  if (e.type === 'event') return e.label;
  return `Tout ${gameLabel}`;
}
