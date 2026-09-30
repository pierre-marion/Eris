/** Utilitaires de date — sans dépendance (Hermes a un Intl limité). */

const DAYS_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MONTHS = [
  'janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
  'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
];

const pad = (n: number) => String(n).padStart(2, '0');

function parse(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Heure seule : "18:00". Vide si pas de date. */
export function timeLabel(iso: string | null): string {
  const d = parse(iso);
  return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : '';
}

/** Clé de regroupement par jour : "2026-06-17" (ou "tbd"). */
export function dayKey(iso: string | null): string {
  const d = parse(iso);
  return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : 'tbd';
}

/** Titre de jour : "Aujourd'hui", "Demain", sinon "mar. 17 juin". */
export function dayLabel(iso: string | null): string {
  const d = parse(iso);
  if (!d) return 'À venir';
  const diff = Math.round((startOfDay(d) - startOfDay(new Date())) / 86_400_000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  if (diff === -1) return 'Hier';
  return `${DAYS_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Timestamp pour tri (null/non planifié en dernier). */
export function sortKey(iso: string | null): number {
  const d = parse(iso);
  return d ? d.getTime() : Number.MAX_SAFE_INTEGER;
}
