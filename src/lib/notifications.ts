// ÉRIS — moteur de notifications.
// CE QUI MARCHE ICI (Expo Go) : notifications LOCALES planifiées — les rappels de prono.
// CE QUI ATTEND UN DEV BUILD + SERVEUR : le push distant (résultats, Activité, cycle, progression).
//   → tokens Expo (getExpoPushTokenAsync) + Edge Function/cron qui envoie. Volontairement non branché.

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { NOTIF } from '../copy';
import type { Match, Predictions } from '../types';

// Affichage en foreground (bannière + liste, pas de son agressif).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// ── Réglages : 4 catégories (= 4 toggles) ─────────────────────────────────────
export const NOTIF_CATEGORIES = ['augures', 'resultats', 'rumeur', 'cercles'] as const;
export type NotifCategory = (typeof NOTIF_CATEGORIES)[number];

export const NOTIF_DEFAULT: Record<NotifCategory, boolean> = {
  augures: true, // rappels de prono — vital
  resultats: true, // feedback gains/ratés
  rumeur: true, // social — ON mais désactivable (le plus intrusif)
  cercles: true, // cycle de ligue
};

const prefKey = (c: NotifCategory) => `notif_${c}`;

export async function getNotifPrefs(): Promise<Record<NotifCategory, boolean>> {
  const pairs = await AsyncStorage.multiGet(NOTIF_CATEGORIES.map(prefKey));
  const out = { ...NOTIF_DEFAULT };
  for (const [k, v] of pairs) {
    if (v != null) out[k.replace('notif_', '') as NotifCategory] = v === '1';
  }
  return out;
}

export async function setNotifPref(cat: NotifCategory, on: boolean): Promise<void> {
  await AsyncStorage.setItem(prefKey(cat), on ? '1' : '0');
}

// ── Permission + canal ────────────────────────────────────────────────────────
export async function registerForNotifications(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;
  if (!granted && current.canAskAgain) {
    granted = (await Notifications.requestPermissionsAsync()).granted;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'ÉRIS',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  return granted;
}

// ── Heures de calme : pas de notif entre minuit et 8h (heure locale) ──────────
const QUIET_END = 8; // 08:00
function avoidQuietHours(d: Date): Date {
  if (d.getHours() < QUIET_END) {
    const shifted = new Date(d);
    shifted.setHours(QUIET_END, 0, 0, 0); // repoussée à 8h le même jour
    return shifted;
  }
  return d;
}

async function scheduleAt(date: Date, body: string): Promise<void> {
  const when = avoidQuietHours(date);
  if (when.getTime() <= Date.now()) return; // déjà passé → on saute
  await Notifications.scheduleNotificationAsync({
    content: { title: 'ÉRIS', body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
  });
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * (Re)planifie les rappels de prono LOCAUX pour les matchs ouverts non pronostiqués.
 * Throttle : on borne aux 8 prochains matchs, et les heures creuses sont repoussées.
 * Appelé quand la liste de matchs ou les pronos changent.
 */
export async function syncPronoReminders(matches: Match[], preds: Predictions): Promise<void> {
  await cancelAllReminders();
  const prefs = await getNotifPrefs();
  if (!prefs.augures) return;

  const now = Date.now();
  const pending = matches
    .filter((m) => m.status === 'open' && m.startsAt && Date.parse(m.startsAt) > now)
    .filter((m) => {
      const p = preds[m.id];
      return !(p?.scoreA != null && p?.scoreB != null); // pas encore d'Call
    })
    .sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!))
    .slice(0, 8);

  if (pending.length === 0) return;

  for (const m of pending) {
    const start = Date.parse(m.startsAt!);
    const name = `${m.teamA.tag} vs ${m.teamB.tag}`;
    await scheduleAt(new Date(start - 2 * 3_600_000), NOTIF.remindH2(name)); // H-2
    await scheduleAt(new Date(start - 30 * 60_000), NOTIF.remindH30); // H-30
  }

  // J-1 : la veille à 18h du match le plus proche (un seul rappel, pas du spam).
  const j1 = new Date(Date.parse(pending[0].startsAt!));
  j1.setDate(j1.getDate() - 1);
  j1.setHours(18, 0, 0, 0);
  await scheduleAt(j1, NOTIF.remindJ1);
}
