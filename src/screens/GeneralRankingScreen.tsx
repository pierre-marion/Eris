import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, games, radius, space, type GameKey } from '../theme';
import { useAuth } from '../auth/AuthContext';
import { fetchGameLeaderboard, type LeaderEntry } from '../lib/leaderboard';
import { fetchCompetitions, type Competition } from '../lib/competitions';

const GAMES: GameKey[] = ['valorant', 'lol', 'cs', 'cod'];
type Item = { type: 'row'; entry: LeaderEntry } | { type: 'gap' };

export function GeneralRankingScreen({
  initialGame,
  onBack,
}: {
  initialGame: GameKey;
  onBack: () => void;
}) {
  const { session } = useAuth();
  const meId = session?.user?.id ?? null;
  const [game, setGame] = useState<GameKey>(initialGame);
  const [rows, setRows] = useState<LeaderEntry[]>([]);
  const [comps, setComps] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [board, c] = await Promise.all([
        fetchGameLeaderboard(game),
        fetchCompetitions(game).catch((e) => {
          console.warn('fetchCompetitions:', e);
          return [];
        }),
      ]);
      setRows(board);
      setComps(c);
    } catch (e) {
      console.warn('Classement général:', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [game]);

  useEffect(() => {
    load();
  }, [load]);

  const podium = rows.slice(0, 3);
  const tail = useMemo(() => buildTail(rows.slice(3), meId), [rows, meId]);
  const me = meId ? rows.find((r) => r.id === meId) : undefined;
  const yy = String(new Date().getFullYear()).slice(-2);

  const share = () => {
    if (!me) return;
    Share.share({
      message: `${me.rank}ᵉ / ${rows.length} sur la saison ${games[game].label} 20${yy} — ÉRIS 🎯`,
    }).catch(() => {});
  };

  return (
    <View style={styles.screen}>
      {/* En-tête : retour + titre + sélecteur de jeu (par jeu, hors event) */}
      <View style={styles.head}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.gold} />
        </Pressable>
        <Text style={styles.headTitle}>Classement général</Text>
        <View style={styles.gamePicker}>
          {GAMES.map((g) => {
            const active = g === game;
            return (
              <Pressable key={g} onPress={() => setGame(g)} style={[styles.gTile, active && { borderColor: games[g].dot }]}>
                <Text style={[styles.gTxt, active ? { color: games[g].dot } : styles.gTxtOff]}>{games[g].short}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        data={tail}
        keyExtractor={(it, i) => (it.type === 'row' ? it.entry.id : `gap-${i}`)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.gold} />}
        ListHeaderComponent={
          <View>
            {/* Contexte saison + pills events */}
            <Text style={styles.season}>Saison {games[game].label} {`20${yy}`} · cumul de tous les events</Text>
            {comps.length > 0 && (
              <View style={styles.pills}>
                {comps.slice(0, 6).map((c) => (
                  <View key={c.serieId} style={styles.pill}>
                    <Ionicons
                      name={c.status === 'live' ? 'ellipse' : c.status === 'past' ? 'checkmark-circle' : 'lock-closed'}
                      size={9}
                      color={c.status === 'live' ? colors.success : colors.textFaint}
                    />
                    <Text style={styles.pillTxt} numberOfLines={1}>{c.tournament}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Podium */}
            {loading && rows.length === 0 ? (
              <ActivityIndicator color={colors.gold} style={{ marginTop: space(8) }} />
            ) : podium.length > 0 ? (
              <View style={styles.podium}>
                {[podium[1], podium[0], podium[2]].map((p, i) =>
                  p ? <Step key={p.id} entry={p} place={p.rank} isMe={p.id === meId} big={i === 1} /> : <View key={i} style={{ flex: 1 }} />,
                )}
              </View>
            ) : (
              <Text style={styles.empty}>Personne au classement {games[game].label}.</Text>
            )}

            <Text style={styles.total}>{rows.length} joueur{rows.length > 1 ? 's' : ''} au total</Text>
          </View>
        }
        renderItem={({ item }) =>
          item.type === 'gap' ? (
            <Text style={styles.gap}>· · ·</Text>
          ) : (
            <Row entry={item.entry} isMe={item.entry.id === meId} />
          )
        }
        ListFooterComponent={
          me ? (
            <Pressable style={styles.share} onPress={share}>
              <Ionicons name="share-social-outline" size={18} color={colors.gold} />
              <Text style={styles.shareTxt}>Partager mon rang ({me.rank}ᵉ / {rows.length})</Text>
            </Pressable>
          ) : null
        }
      />
    </View>
  );
}

function buildTail(rows: LeaderEntry[], meId: string | null): Item[] {
  if (rows.length <= 8) return rows.map((entry) => ({ type: 'row', entry }));
  const items: Item[] = rows.slice(0, 5).map((entry) => ({ type: 'row', entry }));
  const myIdx = meId ? rows.findIndex((r) => r.id === meId) : -1;
  if (myIdx > 5) {
    items.push({ type: 'gap' });
    for (let i = Math.max(5, myIdx - 1); i < Math.min(rows.length, myIdx + 2); i++) {
      items.push({ type: 'row', entry: rows[i] });
    }
    if (myIdx + 2 < rows.length) items.push({ type: 'gap' });
  } else {
    for (let i = 5; i < Math.min(rows.length, 8); i++) items.push({ type: 'row', entry: rows[i] });
    if (rows.length > 8) items.push({ type: 'gap' });
  }
  return items;
}

function Step({ entry, place, isMe, big }: { entry: LeaderEntry; place: number; isMe: boolean; big: boolean }) {
  return (
    <View style={[styles.step, big && styles.stepBig]}>
      {place === 1 && <Ionicons name="trophy" size={18} color={colors.gold} style={{ marginBottom: space(1) }} />}
      <View style={[styles.avatar, big && styles.avatarBig, place === 1 && { borderColor: colors.gold }]}>
        <Text style={styles.avatarTxt}>{entry.username.slice(0, 2).toUpperCase()}</Text>
      </View>
      <Text style={[styles.stepName, isMe && { color: colors.gold }]} numberOfLines={1}>{entry.username}</Text>
      <Text style={styles.stepPts}>{entry.points}</Text>
      <View style={[styles.stand, big && styles.standBig]}>
        <Text style={styles.standRank}>{place}</Text>
      </View>
    </View>
  );
}

function Row({ entry, isMe }: { entry: LeaderEntry; isMe: boolean }) {
  return (
    <View style={[styles.row, isMe && styles.rowMe]}>
      <Text style={styles.rank}>{entry.rank}</Text>
      <Text style={[styles.name, isMe && styles.nameMe]} numberOfLines={1}>
        {entry.username}{isMe ? ' (toi)' : ''}
      </Text>
      <Text style={styles.points}>{entry.points.toLocaleString('fr-FR')}</Text>
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
  headTitle: { ...font.h2, color: colors.text, flex: 1, marginLeft: space(2) },
  gamePicker: { flexDirection: 'row' },
  gTile: {
    minWidth: 38,
    paddingHorizontal: space(2),
    paddingVertical: space(1.5),
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    marginLeft: space(1),
  },
  gTxt: { ...font.tag, fontWeight: '800' },
  gTxtOff: { color: colors.textFaint },

  list: { paddingHorizontal: space(4), paddingTop: space(4), paddingBottom: space(8) },
  season: { ...font.small, color: colors.textMuted, marginBottom: space(3) },
  pills: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space(4) },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: space(2.5),
    paddingVertical: space(1),
    marginRight: space(2),
    marginBottom: space(2),
    maxWidth: 150,
  },
  pillTxt: { ...font.tag, color: colors.textMuted, marginLeft: space(1) },

  podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', marginTop: space(2) },
  step: { flex: 1, alignItems: 'center' },
  stepBig: { marginBottom: space(2) },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.cardElevated,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBig: { width: 56, height: 56, borderRadius: 28 },
  avatarTxt: { ...font.body, color: colors.text, fontWeight: '800' },
  stepName: { ...font.small, color: colors.text, fontWeight: '700', marginTop: space(1) },
  stepPts: { ...font.small, color: colors.gold, fontWeight: '800' },
  stand: {
    width: '70%',
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    paddingVertical: space(2),
    marginTop: space(2),
  },
  standBig: { paddingVertical: space(4), borderColor: colors.goldFaint },
  standRank: { ...font.h2, color: colors.gold, fontWeight: '800' },

  total: { ...font.tag, color: colors.textFaint, textTransform: 'uppercase', textAlign: 'center', marginVertical: space(4) },
  gap: { ...font.h2, color: colors.textFaint, textAlign: 'center', marginVertical: space(2) },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space(3),
    paddingHorizontal: space(4),
    marginBottom: space(2),
  },
  rowMe: { borderColor: colors.goldFaint, backgroundColor: '#2A0E1C' },
  rank: { ...font.h2, color: colors.textMuted, width: 44 },
  name: { ...font.body, color: colors.text, flex: 1, fontWeight: '600' },
  nameMe: { color: colors.gold },
  points: { ...font.body, color: colors.gold, fontWeight: '800' },

  empty: { ...font.small, color: colors.textMuted, textAlign: 'center', marginTop: space(8) },
  share: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.goldFaint,
    borderRadius: radius.md,
    paddingVertical: space(3),
    marginTop: space(4),
  },
  shareTxt: { ...font.body, color: colors.gold, fontWeight: '700', marginLeft: space(2) },
});
