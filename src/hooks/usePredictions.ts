import { useCallback, useEffect, useRef, useState } from 'react';
import type { Match, Prediction, Predictions } from '../types';
import { fetchPredictions, fetchSettledMatchIds, savePrediction } from '../lib/predictions';

/**
 * État partagé des pronos : chargement + sauvegarde cloud (cote figée).
 * Utilisé par l'écran Pronos ET le Home, pour pronostiquer depuis les deux.
 */
export function usePredictions(userId: string | null) {
  const [preds, setPreds] = useState<Predictions>({});
  const [settledIds, setSettledIds] = useState<Set<string>>(new Set());
  const predsRef = useRef<Predictions>(preds);
  predsRef.current = preds;

  useEffect(() => {
    if (!userId) {
      setPreds({});
      setSettledIds(new Set());
      return;
    }
    fetchPredictions(userId).then(setPreds).catch((e) => console.warn('Pronos:', e));
    fetchSettledMatchIds(userId).then(setSettledIds).catch((e) => console.warn('Réglés:', e));
  }, [userId]);

  /** Met à jour un prono (état local optimiste + upsert cloud avec la cote figée). */
  const update = useCallback(
    (match: Match, patch: Partial<Prediction>) => {
      const next = { ...predsRef.current[match.id], ...patch };
      setPreds((p) => ({ ...p, [match.id]: next }));
      if (userId) {
        savePrediction(userId, match.id, next, {
          oddsA: match.oddsA,
          oddsB: match.oddsB,
          format: match.format,
          teamA: match.teamA.tag,
          teamB: match.teamB.tag,
          tournament: match.tournament,
          game: match.game,
          matchStart: match.startsAt,
          serieId: match.serieId,
          teamALogo: match.teamA.logo ?? null,
          teamBLogo: match.teamB.logo ?? null,
        }).catch((e) => console.warn('Save prono:', e));
      }
    },
    [userId],
  );

  return { preds, settledIds, update };
}
