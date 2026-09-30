import type { Match } from '../types';
import { matchWinnerPoints } from '../lib/odds';

/**
 * Données démo — équipes/tournois esport crédibles, pas de backend.
 * Les ratings (PWR Riot pour Valo/LoL, VRS Valve pour CS2) alimentent le moteur
 * de cotes : les points affichés sont CALCULÉS, plus des placeholders.
 * Dates relatives à maintenant pour le regroupement par jour.
 */
const NOW = new Date();
function at(daysFromNow: number, h: number, min: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(h, min, 0, 0);
  return d.toISOString();
}

type RawMatch = Omit<Match, 'oddsA' | 'oddsB'>;

const RAW: RawMatch[] = [
  {
    id: 'm4',
    game: 'valorant',
    tournament: 'VCT Masters London',
    serieId: 'demo-vct-masters',
    format: 'BO3',
    startsAt: at(0, 14, 0),
    status: 'live',
    teamA: { id: 'prx', tag: 'PRX', name: 'Paper Rex', rating: 1850 },
    teamB: { id: 'drx', tag: 'DRX', name: 'DRX', rating: 1700 },
    exactBonus: 50,
  },
  {
    id: 'm1',
    game: 'valorant',
    tournament: 'VCT Masters London',
    serieId: 'demo-vct-masters',
    format: 'BO3',
    startsAt: at(0, 18, 0),
    status: 'open',
    teamA: { id: 'fnc', tag: 'FNC', name: 'Fnatic', rating: 1820 },
    teamB: { id: 'sen', tag: 'SEN', name: 'Sentinels', rating: 1680 },
    exactBonus: 50,
  },
  {
    id: 'm2',
    game: 'cs',
    tournament: 'Major Cologne',
    serieId: 'demo-iem-cologne',
    format: 'BO3',
    startsAt: at(0, 20, 30),
    status: 'open',
    teamA: { id: 'vit', tag: 'VIT', name: 'Vitality', rating: 1968 },
    teamB: { id: 'navi', tag: 'NAVI', name: 'Natus Vincere', rating: 980 },
    exactBonus: 70,
  },
  {
    id: 'm3',
    game: 'lol',
    tournament: 'Mid-Season Invitational',
    serieId: 'demo-msi',
    format: 'BO5',
    startsAt: at(1, 11, 0),
    status: 'open',
    teamA: { id: 't1', tag: 'T1', name: 'T1', rating: 1900 },
    teamB: { id: 'geng', tag: 'GEN', name: 'Gen.G', rating: 1860 },
    exactBonus: 100,
  },
  {
    id: 'm5',
    game: 'cs',
    tournament: 'BLAST Premier',
    serieId: 'demo-blast',
    format: 'BO3',
    startsAt: at(1, 16, 0),
    status: 'open',
    teamA: { id: 'g2', tag: 'G2', name: 'G2 Esports', rating: 1240 },
    teamB: { id: 'faze', tag: 'FAZE', name: 'FaZe Clan', rating: 1180 },
    exactBonus: 70,
  },
  {
    id: 'm6',
    game: 'lol',
    tournament: 'LEC',
    serieId: 'demo-lec',
    format: 'BO5',
    startsAt: at(3, 19, 0),
    status: 'open',
    teamA: { id: 'g2l', tag: 'G2', name: 'G2 Esports', rating: 1720 },
    teamB: { id: 'fncl', tag: 'FNC', name: 'Fnatic', rating: 1650 },
    exactBonus: 100,
  },
];

/** Cotes calculées par le moteur à partir des ratings. */
export const MATCHES: Match[] = RAW.map((m) => {
  const { pointsA, pointsB } = matchWinnerPoints(
    m.teamA.rating ?? 1500,
    m.teamB.rating ?? 1500,
    m.game,
  );
  return { ...m, oddsA: pointsA, oddsB: pointsB };
});

/** Total de points de l'utilisateur (mock) — affiché en doré. */
export const USER_POINTS = 1247;

/**
 * Match TEST — toujours injecté en haut du feed (Valorant) pour dérouler
 * la boucle complète : prono → settle_match('eris-test-match', …) → points.
 * Mettre SHOW_TEST_MATCH à false dans FeedScreen pour le retirer.
 */
export const TEST_MATCH: Match = (() => {
  const teamA = { id: 'test-a', tag: 'TST', name: 'Test Alpha', rating: 1600 };
  const teamB = { id: 'test-b', tag: 'OMG', name: 'Test Omega', rating: 1300 };
  const { pointsA, pointsB } = matchWinnerPoints(teamA.rating!, teamB.rating!, 'valorant');
  return {
    id: 'eris-test-match',
    game: 'valorant',
    tournament: 'MATCH TEST',
    serieId: 'eris-test-serie',
    format: 'BO3',
    startsAt: at(0, 23, 30),
    status: 'open',
    teamA,
    teamB,
    oddsA: pointsA,
    oddsB: pointsB,
    exactBonus: 50,
  };
})();
