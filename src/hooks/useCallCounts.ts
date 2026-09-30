import { useEffect, useMemo, useState } from 'react';
import type { GameKey } from '../theme';
import type { Predictions } from '../types';
import { fetchTierSMatches, hasToken } from '../api/pandascore';
import { dayKey } from '../lib/dates';

/**
 * Compteur de "calls" à faire par jeu = matchs pro d'AUJOURD'HUI, pas commencés
 * et pas encore callés. (Compter tout l'à-venir donnerait des nombres absurdes.)
 * Fetch une fois + refresh périodique ; le filtrage par call est en mémoire.
 */
export function useCallCounts(preds: Predictions): Partial<Record<GameKey, number>> {
  const [open, setOpen] = useState<{ id: string; game: GameKey; startsAt: string | null }[]>([]);

  useEffect(() => {
    if (!hasToken()) return;
    let alive = true;
    const load = () =>
      fetchTierSMatches()
        .then((ms) => {
          if (!alive) return;
          setOpen(ms.filter((m) => m.status === 'open').map((m) => ({ id: m.id, game: m.game, startsAt: m.startsAt })));
        })
        .catch((e) => console.warn('useCallCounts fetchTierSMatches:', e));
    load();
    const t = setInterval(load, 120000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return useMemo(() => {
    const today = dayKey(new Date().toISOString());
    const c: Partial<Record<GameKey, number>> = {};
    for (const m of open) {
      if (!m.startsAt || dayKey(m.startsAt) !== today) continue; // aujourd'hui only
      const p = preds[m.id];
      if (p?.scoreA != null && p?.scoreB != null) continue; // déjà callé
      c[m.game] = (c[m.game] ?? 0) + 1;
    }
    return c;
  }, [open, preds]);
}
