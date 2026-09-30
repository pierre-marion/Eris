import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, games, radius, space, type GameKey } from '../theme';
import { useAuth } from '../auth/AuthContext';
import { deleteAccount } from '../lib/account';
import {
  cancelAllReminders,
  getNotifPrefs,
  NOTIF_CATEGORIES,
  NOTIF_DEFAULT,
  setNotifPref,
  type NotifCategory,
} from '../lib/notifications';

const GAMES: GameKey[] = ['valorant', 'cs', 'lol', 'cod'];
const NOTIF_META: Record<NotifCategory, { label: string; sub: string }> = {
  augures: { label: 'Mes Calls', sub: 'rappels de pronos à sceller' },
  resultats: { label: 'Résultats & points', sub: 'tes gains, tes ratés, tes rangs' },
  rumeur: { label: 'L’Activité', sub: 'quand ça chambre entre potes' },
  cercles: { label: 'Mes ligues', sub: 'la vie de tes ligues' },
};

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { session, profile, signOut, setGames, updateUsername } = useAuth();
  const [name, setName] = useState(profile?.username ?? '');
  const [notifs, setNotifs] = useState<Record<NotifCategory, boolean>>(NOTIF_DEFAULT);

  useEffect(() => {
    getNotifPrefs().then(setNotifs);
  }, []);

  const toggleNotif = (cat: NotifCategory, v: boolean) => {
    setNotifs((n) => ({ ...n, [cat]: v }));
    setNotifPref(cat, v);
    if (cat === 'augures' && !v) cancelAllReminders(); // coupe les rappels planifiés
  };

  const followed = profile?.games ?? [];
  const toggleGame = (g: GameKey, on: boolean) => {
    const next = on ? [...new Set([...followed, g])] : followed.filter((x) => x !== g);
    if (next.length === 0) return Alert.alert('Au moins un jeu', 'Garde au moins un jeu suivi.');
    setGames(next);
  };

  const saveName = () => {
    if (name.trim() && name.trim() !== profile?.username) updateUsername(name);
  };

  const provider = (session?.user?.app_metadata as { provider?: string })?.provider;

  const confirmDelete = () =>
    Alert.alert('Supprimer mon compte', 'Tes données (pronos, ligues, profil) seront effacées. Irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAccount();
          } finally {
            signOut();
          }
        },
      },
    ]);

  return (
    <View style={styles.screen}>
      <View style={styles.head}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.gold} />
        </Pressable>
        <Text style={styles.headTitle}>Réglages</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Compte */}
        <Text style={styles.section}>Compte</Text>
        <View style={styles.card}>
          <View style={[styles.row, styles.rowBorder]}>
            <Text style={styles.rowLabel}>Pseudo</Text>
            <TextInput
              style={styles.pseudoInput}
              value={name}
              onChangeText={setName}
              placeholder="ton_pseudo"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              textAlign="right"
            />
            {name.trim() !== profile?.username && (
              <Pressable onPress={saveName} style={styles.save}>
                <Text style={styles.saveTxt}>OK</Text>
              </Pressable>
            )}
          </View>
          <Row label="Email" value={session?.user?.email ?? '—'} />
          <Row
            label="Connexion"
            value={provider === 'discord' ? 'Discord lié ✓' : provider ?? 'Email'}
            last
          />
        </View>

        {/* Jeux suivis */}
        <Text style={styles.section}>Jeux suivis</Text>
        <View style={styles.card}>
          {GAMES.map((g, i) => (
            <View key={g} style={[styles.row, i < GAMES.length - 1 && styles.rowBorder]}>
              <View style={[styles.dot, { backgroundColor: games[g].dot }]} />
              <Text style={styles.rowLabel}>{games[g].label}</Text>
              <Switch
                value={followed.includes(g)}
                onValueChange={(on) => toggleGame(g, on)}
                trackColor={{ true: colors.goldDim, false: colors.border }}
                thumbColor={colors.text}
              />
            </View>
          ))}
        </View>
        <Text style={styles.note}>Pilote ce que tu vois dans le sélecteur du header, partout dans l'app.</Text>

        {/* Notifications */}
        <Text style={styles.section}>Notifications</Text>
        <View style={styles.card}>
          {NOTIF_CATEGORIES.map((cat, i) => (
            <View key={cat} style={[styles.row, i < NOTIF_CATEGORIES.length - 1 && styles.rowBorder]}>
              <View style={{ flex: 1, marginRight: space(3) }}>
                <Text style={styles.rowLabel}>{NOTIF_META[cat].label}</Text>
                <Text style={styles.rowSub}>{NOTIF_META[cat].sub}</Text>
              </View>
              <Switch
                value={notifs[cat]}
                onValueChange={(v) => toggleNotif(cat, v)}
                trackColor={{ true: colors.goldDim, false: colors.border }}
                thumbColor={colors.text}
              />
            </View>
          ))}
        </View>
        <Text style={styles.note}>
          Les rappels de pronos sont locaux. Le reste (résultats, chambrage…) arrive avec les notifs push.
        </Text>

        {/* À propos */}
        <Text style={styles.section}>À propos</Text>
        <View style={styles.card}>
          <Pressable style={[styles.row, styles.rowBorder]} onPress={() => Alert.alert('CGU & confidentialité', 'Bientôt')}>
            <Text style={styles.rowLabel}>CGU & confidentialité</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </Pressable>
          <View style={styles.row}>
            <Ionicons name="lock-closed" size={14} color={colors.textFaint} />
            <Text style={[styles.rowLabel, { marginLeft: space(2) }]}>Sans argent réel · loi 1901</Text>
          </View>
        </View>

        {/* Déconnexion + suppression */}
        <Pressable style={styles.logout} onPress={() => signOut()}>
          <Text style={styles.logoutTxt}>Déconnexion</Text>
        </Pressable>
        <Pressable style={styles.delete} onPress={confirmDelete}>
          <Text style={styles.deleteTxt}>Supprimer mon compte</Text>
        </Pressable>

        <Text style={styles.version}>ÉRIS · v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space(4),
    paddingVertical: space(3),
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  headTitle: { ...font.h2, color: colors.text, marginLeft: space(2) },
  content: { padding: space(4), paddingBottom: space(10) },

  section: { ...font.tag, color: colors.textFaint, textTransform: 'uppercase', marginTop: space(5), marginBottom: space(2) },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space(4),
  },
  pseudoInput: { flex: 1, ...font.body, color: colors.text, paddingVertical: 0 },
  save: { backgroundColor: colors.gold, borderRadius: radius.sm, paddingHorizontal: space(3), paddingVertical: space(1.5), marginLeft: space(2) },
  saveTxt: { ...font.small, color: colors.bg, fontWeight: '800' },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: space(3.5) },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: space(3) },
  rowLabel: { ...font.body, color: colors.text, flex: 1 },
  rowSub: { ...font.small, color: colors.textFaint, marginTop: 1 },
  rowValue: { ...font.body, color: colors.textMuted, maxWidth: 200 },
  note: { ...font.small, color: colors.textFaint, marginTop: space(2) },

  logout: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: space(4),
    alignItems: 'center',
    marginTop: space(6),
  },
  logoutTxt: { ...font.body, color: colors.text, fontWeight: '700' },
  delete: { paddingVertical: space(4), alignItems: 'center', marginTop: space(2) },
  deleteTxt: { ...font.small, color: colors.danger, fontWeight: '700' },
  version: { ...font.tag, color: colors.textFaint, textAlign: 'center', marginTop: space(4) },
});
