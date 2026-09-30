import { fetchGameSeries, hasToken, type EventStatus } from '../api/pandascore';
import { MATCHES } from '../data/matches';
import type { GameKey } from '../theme';

export interface Competition {
  serieId: string;
  tournament: string;
  status: EventStatus;
}

/**
 * Events d'un jeu, avec statut (en cours / à venir / terminé).
 * Live : catalogue /tournaments tier S+A PandaScore. Sinon : dérivé démo.
 */
export async function fetchCompetitions(game: GameKey): Promise<Competition[]> {
  if (hasToken()) {
    try {
      const series = await fetchGameSeries(game);
      if (series.length) {
        return series.map((s) => ({ serieId: s.serieId, tournament: s.name, status: s.status }));
      }
    } catch (e) {
      console.warn('fetchGameSeries:', e);
      /* secours démo ci-dessous */
    }
  }

  const seen = new Map<string, string>();
  for (const m of MATCHES) {
    if (m.game === game && m.serieId && !seen.has(m.serieId)) seen.set(m.serieId, m.tournament);
  }
  return [...seen.entries()].map(([serieId, tournament]) => ({
    serieId,
    tournament,
    status: 'live' as EventStatus,
  }));
}
