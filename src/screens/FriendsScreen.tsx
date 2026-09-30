import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors, font, radius, space } from '../theme';
import {
  addFriendByCode,
  fetchFriends,
  fetchPendingRequests,
  myFriendCode,
  removeFriend,
  respondFriendRequest,
  rivalryLabel,
  type Friend,
  type FriendRequest,
} from '../lib/friends';

const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

export function FriendsScreen({ onBack }: { onBack: () => void }) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [code, setCode] = useState('');
  const [mySeal, setMySeal] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [responding, setResponding] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, seal, pending] = await Promise.all([
        fetchFriends().catch((e) => {
          console.warn('fetchFriends:', e);
          return [];
        }),
        myFriendCode().catch((e) => {
          console.warn('myFriendCode:', e);
          return null;
        }),
        fetchPendingRequests().catch((e) => {
          console.warn('fetchPendingRequests:', e);
          return [];
        }),
      ]);
      setFriends(list);
      setMySeal(seal);
      setRequests(pending);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const copySeal = async () => {
    if (!mySeal) return;
    await Clipboard.setStringAsync(mySeal).catch(() => {});
    setCopied(true);
  };
  const shareSeal = () =>
    mySeal && Share.share({ message: `Ajoute-moi sur ÉRIS — mon Code d'joueur : ${mySeal} 👁️` }).catch(() => {});

  const add = async () => {
    const c = clean(input);
    if (c.length < 4) return;
    setAdding(true);
    try {
      const f = await addFriendByCode(c);
      setInput('');
      await load();
      if (f.status === 'accepted') {
        Alert.alert('Pote ajouté', `${f.username} rejoint tes potes.`);
      } else {
        Alert.alert('Demande envoyée', `${f.username} doit l'accepter pour vous lier.`);
      }
    } catch (e: any) {
      Alert.alert('Oups', e?.message ?? 'Code introuvable.');
    } finally {
      setAdding(false);
    }
  };

  const respond = async (r: FriendRequest, accept: boolean) => {
    setResponding(r.id);
    try {
      await respondFriendRequest(r.id, accept);
      await load();
    } catch (e: any) {
      Alert.alert('Oups', e?.message ?? 'Réponse impossible.');
    } finally {
      setResponding(null);
    }
  };

  const confirmRemove = (f: Friend) =>
    Alert.alert(f.username, undefined, [
      {
        text: 'Retirer cet joueur',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeFriend(f.id);
          } catch (e) {
            Alert.alert('Oups', e instanceof Error ? e.message : 'Impossible de retirer ce joueur.');
          }
          load();
        },
      },
      { text: 'Annuler', style: 'cancel' },
    ]);

  const shown = friends.filter((f) => f.username.toLowerCase().includes(code.toLowerCase()));

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.head}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.gold} />
        </Pressable>
        <Text style={styles.headTitle}>Mes potes</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Ton Code */}
        <Text style={styles.section}>Ton code</Text>
        <View style={styles.sealCard}>
          <Text style={styles.seal}>{mySeal ?? '••••••'}</Text>
          <View style={styles.sealActions}>
            <Pressable style={styles.sealBtn} onPress={copySeal}>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={colors.gold} />
              <Text style={styles.sealBtnTxt}>{copied ? 'Copié' : 'Copier'}</Text>
            </Pressable>
            <Pressable style={styles.sealBtn} onPress={shareSeal}>
              <Ionicons name="share-social-outline" size={16} color={colors.gold} />
              <Text style={styles.sealBtnTxt}>Partager</Text>
            </Pressable>
          </View>
        </View>
        <Text style={styles.note}>Partage-le : un joueur l'entre pour vous lier.</Text>

        {/* Ajouter par Code */}
        <Text style={styles.section}>Ajouter par Code</Text>
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={(t) => setInput(clean(t))}
            placeholder="CODE"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
          />
          <Pressable style={[styles.addBtn, (adding || clean(input).length < 4) && styles.addBtnOff]} onPress={add} disabled={adding || clean(input).length < 4}>
            {adding ? <ActivityIndicator color={colors.bg} /> : <Ionicons name="add" size={22} color={colors.bg} />}
          </Pressable>
        </View>

        {/* Demandes reçues */}
        {requests.length > 0 && (
          <>
            <Text style={styles.section}>Demandes reçues · {requests.length}</Text>
            {requests.map((r) => (
              <View key={r.id} style={styles.request}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarTxt}>{r.username.slice(0, 2).toUpperCase()}</Text>
                </View>
                <Text style={[styles.name, { flex: 1 }]} numberOfLines={1}>
                  {r.username}
                </Text>
                {responding === r.id ? (
                  <ActivityIndicator color={colors.gold} />
                ) : (
                  <View style={styles.requestActions}>
                    <Pressable style={styles.declineBtn} onPress={() => respond(r, false)} hitSlop={6}>
                      <Ionicons name="close" size={18} color={colors.textMuted} />
                    </Pressable>
                    <Pressable style={styles.acceptBtn} onPress={() => respond(r, true)} hitSlop={6}>
                      <Ionicons name="checkmark" size={18} color={colors.bg} />
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </>
        )}

        {/* Liste */}
        <Text style={styles.section}>Mes potes {friends.length > 0 && `· ${friends.length}`}</Text>
        {friends.length > 3 && (
          <TextInput
            style={styles.search}
            value={code}
            onChangeText={setCode}
            placeholder="Chercher un joueur…"
            placeholderTextColor={colors.textFaint}
          />
        )}

        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: space(6) }} />
        ) : shown.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="people-outline" size={22} color={colors.textFaint} style={styles.emptyIcon} />
            <Text style={styles.empty}>
              {friends.length === 0
                ? "Aucun joueur pour l'instant. Partage ton Code pour lier tes potes."
                : 'Aucun joueur à ce nom.'}
            </Text>
          </View>
        ) : (
          shown.map((f) => {
            const leads = f.friendWins > f.myWins;
            return (
              <Pressable key={f.id} style={styles.friend} onLongPress={() => confirmRemove(f)}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarTxt}>{f.username.slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name} numberOfLines={1}>{f.username}</Text>
                    {leads && <Ionicons name="ribbon" size={14} color={colors.gold} style={{ marginLeft: space(1) }} />}
                  </View>
                  <Text style={styles.rivalry} numberOfLines={1}>{rivalryLabel(f)}</Text>
                </View>
              </Pressable>
            );
          })
        )}
        {friends.length > 0 && <Text style={styles.note}>Appui long sur un joueur pour le retirer.</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space(4),
    paddingVertical: space(3),
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  headTitle: { ...font.section, color: colors.text },
  content: { padding: space(4), paddingBottom: space(10) },

  section: { ...font.tag, color: colors.textFaint, textTransform: 'uppercase', marginTop: space(5), marginBottom: space(2) },

  sealCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.goldFaint,
    borderRadius: radius.md,
    padding: space(4),
    alignItems: 'center',
  },
  seal: { color: colors.gold, fontSize: 26, fontWeight: '800', letterSpacing: 4 },
  sealActions: { flexDirection: 'row', marginTop: space(3) },
  sealBtn: { flexDirection: 'row', alignItems: 'center', marginHorizontal: space(3) },
  sealBtnTxt: { ...font.small, color: colors.gold, fontWeight: '700', marginLeft: space(1) },
  note: { ...font.small, color: colors.textFaint, marginTop: space(2) },

  addRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space(4),
    paddingVertical: space(3.5),
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 4,
    marginRight: space(2),
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnOff: { opacity: 0.4 },

  search: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space(4),
    paddingVertical: space(3),
    color: colors.text,
    ...font.body,
    marginBottom: space(2),
  },

  emptyWrap: { alignItems: 'center', marginTop: space(5) },
  emptyIcon: { marginBottom: space(2) },
  empty: { ...font.small, color: colors.textMuted, textAlign: 'center' },

  friend: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space(3),
    marginBottom: space(2),
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.goldFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space(3),
  },
  avatarTxt: { ...font.body, color: colors.gold, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  name: { ...font.h2, color: colors.text },
  rivalry: { ...font.small, color: colors.textMuted, marginTop: 1 },

  request: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.goldFaint,
    borderRadius: radius.md,
    padding: space(3),
    marginBottom: space(2),
  },
  requestActions: { flexDirection: 'row' },
  declineBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space(2),
  },
  acceptBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
