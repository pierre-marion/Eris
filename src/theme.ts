/**
 * ÉRIS — Direction artistique.
 * "Brutalisme magenta / noir." Contraste violent, zéro dégradé, zéro effet.
 *
 * - Magenta #FF2D95 = accent principal : titres, boutons, aplats, états actifs.
 *   (le token s'appelle encore `gold` par héritage — il porte le magenta partout.)
 * - Vert #00E676 = UNIQUEMENT le positif/validé (gains, « ▲ 2 places »).
 * - Blocs sombres simples, barre d'accent rose à gauche pour ce qui demande une action.
 * - Typo massive (Anton) pour les moments forts, corps sobre (Inter).
 */

export const colors = {
  // Noir pur + surfaces sombres simples
  bg: '#0A0A0A',
  card: '#151515',
  cardElevated: '#1E1E1E',
  border: '#262626',
  borderSoft: '#1C1C1C',

  // Accent magenta (nom `gold` conservé → recolore toute l'app sans tout renommer)
  gold: '#FF2D95',
  goldDim: '#C71E75',
  goldFaint: '#3A1024',

  // Texte
  text: '#FFFFFF',
  textMuted: '#777777',
  textFaint: '#555555',

  // États : vert = positif only, rouge = live/danger
  success: '#00E676',
  danger: '#FF453A',
  white: '#FFFFFF',
} as const;

/** Teinte magenta sombre pour les fonds d'état actif (remplace l'ancien ton doré `#2A0E1C`). */
export const accentTint = '#2A0E1C';

/**
 * Couleur-jeu : utilisée UNIQUEMENT comme pastille 6px.
 * Rouge Valo, orange CS, bleu LoL, vert CoD.
 */
export const games = {
  valorant: { label: 'Valorant', short: 'VAL', dot: '#FF4655' },
  cs: { label: 'CS2', short: 'CS2', dot: '#F0A030' },
  lol: { label: 'LoL', short: 'LoL', dot: '#3B82F6' },
  cod: { label: 'Call of Duty', short: 'COD', dot: '#6CBF4B' },
} as const;

export type GameKey = keyof typeof games;

export const radius = { sm: 8, md: 14, lg: 20, pill: 999 } as const;

export const space = (n: number) => n * 4;

/**
 * Typo : Anton (massif, condensé) pour les moments forts ; Inter (sobre) pour le corps.
 * Les familles portent déjà le poids — le `fontWeight` inline des composants est ignoré.
 */
export const font = {
  brand: { fontFamily: 'Anton_400Regular', fontSize: 22, letterSpacing: 1 },
  h1: { fontFamily: 'Anton_400Regular', fontSize: 30, letterSpacing: 0.5 },
  // Titres de section (« Tes prochains matchs », « Mes potes »...) — Anton, pas Inter,
  // pour que les repères de navigation portent la même identité que la marque et les scores.
  section: { fontFamily: 'Anton_400Regular', fontSize: 19, letterSpacing: 0.3 },
  h2: { fontFamily: 'Inter_800ExtraBold', fontSize: 17 },
  body: { fontFamily: 'Inter_500Medium', fontSize: 15 },
  small: { fontFamily: 'Inter_500Medium', fontSize: 13 },
  tag: { fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 0.5 },
  score: { fontFamily: 'Anton_400Regular', fontSize: 32, letterSpacing: 0.5 },
} as const;
