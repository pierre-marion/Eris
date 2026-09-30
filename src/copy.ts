// ÉRIS — source de vérité du copywriting.
// Ton : brutal, chambreur, direct. Règle d'or : aucun texte neutre s'il peut être drôle.
// Pas de mythologie — termes clairs (call, ligue, points), la vanne fait le reste.

/** Lexique — termes directs. */
export const LEX = {
  oracle: 'joueur',
  cercle: 'ligue',
  pantheon: 'Classement',
  olympe: 'Classement général',
  ere: 'Saison',
  augure: 'Call', // un prono
  faveur: 'points',
  pommeDor: 'Boost', // bonus ×2
  augureParfait: 'Score exact',
  ferveur: 'Série',
  convoquer: 'Inviter',
  sceau: 'Code',
  rumeur: 'Activité',
} as const;

/** Micro-textes chambreurs. Partout, pas juste dans les gros messages. */
export const COPY = {
  callSealed: "C'est plié.",
  empty: 'Calme plat. Reviens plus tard.',
  locked: 'Trop tard. Le match est lancé.',
  boostPlaced: 'Boost posé. Ça passe ou ça casse.',
  perfect: 'Pile poil. Les autres vont adorer.',
  perfectApple: 'Chaos total. Insupportable.',
  missed: "Aïe. T'avais pas vu ça venir.",
  climbed: (n: number) => `+${n} place${n > 1 ? 's' : ''}. Quelqu'un va faire la gueule.`,
  overtaken: 'On vient de te passer devant. Tu laisses faire ?',
  leagueOpen: 'Ta ligue est ouverte. Invite tes victimes.',
  joined: "Un joueur de plus dans l'arène.",
  leagueEnd: 'Voici qui domine, et qui rampe.',
  rematch: 'On remet ça ? Les comptes se règlent la saison prochaine.',
  first: 'insupportable',
  last: 'a abandonné la vie',
  goTaunt: 'Va les narguer',
  noTeams: 'on sait pas encore qui va perdre',
  pending: (n: number) => `${n} call${n > 1 ? 's' : ''} en attente. Bouge.`,
} as const;

/**
 * Rotation in-app : tire une variante au hasard SANS répéter les dernières (par clé).
 * `{g}` etc. sont interpolés côté appelant. Mémoire en module (reset au reload).
 */
const _recent: Record<string, string[]> = {};
export function pick(key: string, variants: readonly string[]): string {
  if (variants.length <= 1) return variants[0] ?? '';
  const seen = _recent[key] ?? [];
  const fresh = variants.filter((v) => !seen.includes(v));
  const pool = fresh.length ? fresh : [...variants];
  const choice = pool[Math.floor(Math.random() * pool.length)];
  _recent[key] = [...seen, choice].slice(-Math.min(5, variants.length - 1));
  return choice;
}

/** Jeux de variantes (le fait d'abord via `{g}`, la vanne autour). Termes de-mythologisés. */
export const LINES = {
  // Card de match — call validé / verrouillé
  callSealed: ["C'est plié.", 'Signé. Plus de marche arrière.', 'Acté. On en reparle plus tard.', "Scellé. T'assumes."],
  locked: ['Trop tard. Spectateur.', "T'as pas callé. Les autres jouent.", 'Trop tard. Le match est lancé.'],
  tbd: ['On sait pas encore qui va perdre.', "Deux équipes mystères. L'une va décevoir.", 'Affiche à venir. Le drame aussi.'],
  // Résultats ({g} = gain)
  resWin: ['+{g}. Propre.', '+{g}. Comme prévu. Par toi.', '+{g}. Bien vu.'],
  resUpset: ["+{g}. T'avais vu l'upset. Personne d'autre.", '+{g}. Le call que personne osait.'],
  resExact: ['PILE POIL. +{g}.', 'Au score près. +{g}. Vicieux.', 'Score exact. +{g}. Insupportable.'],
  resBoost: ['×2 encaissé. +{g}. Insolent.', 'Le Boost a payé. +{g}.'],
  resLoss: ['Raté. +0. Voilà.', 'Perdu. Ça arrive.', 'Le favori a gagné. Toi non.', "Tenté, perdu. Au moins t'as osé."],
  // Classement (position)
  rankFirst: ['Insupportable.', 'Le trône. Profite, ça dure jamais.', 'Numéro 1. Tes potes te détestent.'],
  rankSecond: ['Si proche du trône.', 'Deuxième. Le premier des perdants.'],
  rankMid: ['Le ventre mou. Confortable et triste.', 'Ni gloire ni honte. Le pire endroit.'],
  rankLast: ['A abandonné la vie.', "Le sous-sol. Quelqu'un doit l'occuper.", 'Dernier. Mais dernier motivé, non ?'],
  // Fin de ligue — le sacre (1er)
  champWin: [
    "Personne ne t'a vu venir. Maintenant ils te détestent.",
    'Tu les as tous écrasés. Savoure, ça dure jamais.',
    "Le trône est à toi. Ils s'en remettront. Ou pas.",
  ],
  // Fin de ligue — la sentence (perdant)
  loseHero: [
    "Tu n'as jamais été dans le coup.",
    'Un match. Tu as perdu pour un match.',
    'Tu as mis ton Boost sur le mauvais match. Bravo.',
    'Si près. Puis plus rien.',
  ],
} as const;

/**
 * Catalogue des notifications, par catégorie (= 4 toggles de réglage).
 * Chaque texte appelle à AGIR maintenant. `local` = Expo Go OK ; `remote` = dev build + serveur.
 */
export const NOTIF = {
  // 1. Calls — rappels de prono (conversion). LOCAL.
  arenaOpen: "Ça démarre. Tes premiers calls t'attendent.",
  remindJ1: 'Des matchs demain, et toujours pas de call ? Bouge.',
  remindH2: (match: string) => `2h avant ${match}. Pose ton call ou tais-toi.`,
  remindH30: 'Dernier appel. Ça verrouille dans 30 min.',
  boostIdle: 'Ton Boost dort encore. Quel match tu tentes ?',

  // 2. Résultats & points — feedback. REMOTE.
  won: (pts: number) => `Bien vu. +${pts} dans la poche.`,
  resPerfect: 'Pile poil. Les autres vont grincer des dents.',
  resPerfectBoost: (pts: number) => `Chaos total. +${pts}. Insupportable.`,
  resMissed: "Aïe. T'avais pas vu ça venir.",
  resUpset: "Tout le monde s'est planté. Toi non. Savoure.",
  resGrouped: (n: number, pts: number) => `${n} résultats tombés. +${pts} au total. Va voir.`,

  // 3. Social / chambrage. REMOTE. (le plus intrusif → désactivable)
  overtaken: (name: string) => `${name} te passe devant. Tu laisses faire ?`,
  overtook: (name: string) => `Tu écrases ${name}. Il l'a senti passer.`,
  joined: "Un joueur de plus dans l'arène.",
  rivalBoost: (name: string) => `${name} tente le tout pour le tout. Tu réponds quoi ?`,
  fellPodium: "Tu n'es plus sur le podium. Honteux.",
  bestOfDay: (league: string) => `Meilleur joueur du jour dans ${league}. Nargue-les.`,

  // 4. Ligues — cycle. REMOTE.
  leagueStart: (league: string) => `${league} démarre. Premier call ?`,
  penultimate: 'Plus qu\'un match avant le verdict. Tout peut basculer.',
  leagueWon: (league: string) => `Tu domines ${league}. Savoure.`,
  leagueLost: (winner: string) => `Terminé. ${winner} gagne, toi tu rampes. Revanche ?`,
  leagueRematch: (admin: string, league: string, event: string) =>
    `${admin} relance ${league} sur ${event}. Les comptes se règlent.`,
  leagueFull: (n: number) => `Ta ligue compte ${n} joueurs. Le carnage peut commencer.`,

  // 5. Progression. REMOTE.
  streakAtRisk: (n: number) => `Ta série est à ${n}. Un mauvais call et tout s'effondre.`,
  top100: 'Top 100 général. On commence à te connaître.',
  recordPoints: 'Meilleur score de ta carrière. Chapeau.',
} as const;
