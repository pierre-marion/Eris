import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, games, radius, space, type GameKey } from '../theme';
import { eventLabel, type EventScope } from '../scope';
import { useAuth } from '../auth/AuthContext';
import { fetchGameLeaderboard, fetchGlobalLeaderboard } from '../lib/leaderboard';
import { fetchLeagueEventLeaderboard, fetchMyLeagues, type League } from '../lib/leagues';

interface Entry {
  id: string;
  username: string;
  points: number;
  rank: number;
}
type Mode = 'global' | 'game' | { leagueId: string; name: string };
type Item = { type: 'row'; entry: Entry } | { type: 'gap' };

const modeKey = (m: Mode) => (typeof m === 'string' ? m : m.leagueId);

export function LeaderboardScreen({
  game,
  event,
  onBack,
}: {
  game: GameKey;
  event: EventScope;
  onBack?: () => void;
}) {
  const { session } = useAuth();
  const meId = session?.user?.id ?? null;
  const [mode, setMode] = useState<Mode>('global');
  const [leagues, setLeagues] = useState<League[]>([]);
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  // Ligues couvrant le scope (pour le sélecteur).
  useEffect(() => {
    if (!meId) return setLeagues([]);
    fetchMyLeagues()
      .then((mine) =>
        setLeagues(
          mine.filter(
            (l) =>
              (!l.game || l.game === game) &&
              (event.type !== 'event' || !l.serie_id || l.serie_id === event.serieId),
          ),
        ),
      )
      .catch(() => setLeagues([]));
  }, [meId, game, event]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const serie = event.type === 'event' ? event.serieId : null;
      let res: Entry[];
      if (mode === 'global') {
        res = await fetchGlobalLeaderboard();
      } else if (mode === 'game') {
        res = await fetchGameLeaderboard(game);
      } else {
        res = (await fetchLeagueEventLeaderboard(mode.leagueId, game, serie)).map((s) => ({
          id: s.user_id,
          username: s.username,
          points: s.points,
          rank: s.rank,
        }));
      }
      setRows(res);
    } catch (e) {
      console.warn('Classement:', e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [mode, game, event]);

  useEffect(() => {
    load();
  }, [load]);

  const items = useMemo(() => withSkips(rows, meId), [rows, meId]);

  const subtitle =
    mode === 'global'
      ? 'Général · toute l’app'
      : mode === 'game'
        ? `${games[game].label} · tous events`
        : `${mode.name} · ${eventLabel(event, games[game].label)}`;

  const share = async () => {
    const lines = rows
      .slice(0, 10)
      .map((r) => `${r.rank}. ${r.username} — ${r.points} pts`)
      .join('\n');
    await Share.share({ message: `Classement ÉRIS — ${subtitle}\n\n${lines}` }).catch(() => {});
  };

  return (
    <View style={styles.screen}>
      {onBack && (
        <View style={styles.backHead}>
          <Pressable onPress={onBack} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={colors.gold} />
          </Pressable>
          <Text style={styles.backTitle}>Classement</Text>
        </View>
      )}

      {/* Sélecteur : Global · {jeu} · mes ligues */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Chip label="Global" active={mode === 'global'} onPress={() => setMode('global')} />
        <Chip label={games[game].label} active={mode === 'game'} onPress={() => setMode('game')} />
        {leagues.map((l) => (
          <Chip
            key={l.id}
            label={l.name}
            active={typeof mode !== 'string' && mode.leagueId === l.id}
            onPress={() => setMode({ leagueId: l.id, name: l.name })}
          />
        ))}
      </ScrollView>

      {/* Indicateur de fraîcheur */}
      <View style={styles.liveRow}>
        <View style={styles.liveDot} />
        <Text style={styles.liveTxt}>Mis à jour après chaque match</Text>
        <Text style={styles.sub}>{subtitle}</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it, i) => (it.type === 'row' ? it.entry.id : `gap-${i}`)}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.gold} />}
        renderItem={({ item }) =>
          item.type === 'gap' ? (
            <Text style={styles.gap}>· · ·</Text>
          ) : (
            <Row entry={item.entry} isMe={item.entry.id === meId} />
          )
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.gold} style={{ marginTop: space(10) }} />
          ) : (
            <Text style={styles.empty}>Personne au classement pour ce scope.</Text>
          )
        }
        ListFooterComponent={
          rows.length > 0 ? (
            <Pressable style={styles.share} onPress={share}>
              <Ionicons name="share-social-outline" size={18} color={colors.gold} />
              <Text style={styles.shareTxt}>Partager le classement</Text>
            </Pressable>
          ) : null
        }
      />
    </View>
  );
}

/** Top 5 + saut (···) + ma zone, pour les longs classements. */
function withSkips(rows: Entry[], meId: string | null): Item[] {
  if (rows.length <= 12) return rows.map((entry) => ({ type: 'row', entry }));
  const items: Item[] = rows.slice(0, 5).map((entry) => ({ type: 'row', entry }));
  const myIdx = meId ? rows.findIndex((r) => r.id === meId) : -1;
  if (myIdx > 5) {
    const start = Math.max(5, myIdx - 1);
    const end = Math.min(rows.length, myIdx + 2);
    if (start > 5) items.push({ type: 'gap' });
    for (let i = start; i < end; i++) items.push({ type: 'row', entry: rows[i] });
    if (end < rows.length) items.push({ type: 'gap' });
  } else {
    for (let i = 5; i < 8 && i < rows.length; i++) items.push({ type: 'row', entry: rows[i] });
    if (rows.length > 8) items.push({ type: 'gap' });
  }
  return items;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipTxt, active && styles.chipTxtActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function Row({ entry, isMe }: { entry: Entry; isMe: boolean }) {
  const first = entry.rank === 1;
  const top3 = entry.rank <= 3;
  return (
    <View style={[styles.row, first && styles.rowFirst, isMe && styles.rowMe]}>
      <Text style={[styles.rank, top3 && styles.rankTop]}>{entry.rank}</Text>
      <Text style={[styles.name, isMe && styles.nameMe]} numberOfLines={1}>
        {entry.username}
        {isMe ? ' (toi)' : ''}
      </Text>
      <Text style={styles.points}>{entry.points.toLocaleString('fr-FR')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  backHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space(4),
    paddingTop: space(3),
  },
  backTitle: { ...font.h2, color: colors.text, marginLeft: space(2) },

  chips: { paddingHorizontal: space(4), paddingTop: space(3), paddingBottom: space(1) },
  chip: {
    paddingHorizontal: space(3),
    paddingVertical: space(2),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: space(2),
    maxWidth: 180,
  },
  chipActive: { borderColor: colors.gold, backgroundColor: '#2A0E1C' },
  chipTxt: { ...font.small, color: colors.textMuted, fontWeight: '700' },
  chipTxtActive: { color: colors.gold },

  liveRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space(4), paddingVertical: space(2) },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.goldDim, marginRight: space(2) },
  liveTxt: { ...font.tag, color: colors.textMuted, textTransform: 'uppercase' },
  sub: { ...font.small, color: colors.textFaint, marginLeft: space(3), flex: 1, textAlign: 'right' },

  list: { paddingHorizontal: space(4), paddingTop: space(2), paddingBottom: space(8) },
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
  rowFirst: { borderColor: colors.gold, backgroundColor: '#2A0E1C' },
  rowMe: { borderColor: colors.goldFaint, backgroundColor: '#1A0D14' },
  rank: { ...font.h2, color: colors.textMuted, width: 36 },
  rankTop: { color: colors.gold },
  name: { ...font.body, color: colors.text, flex: 1, fontWeight: '600' },
  nameMe: { color: colors.gold },
  points: { ...font.body, color: colors.gold, fontWeight: '800' },

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

  empty: { ...font.small, color: colors.textMuted, textAlign: 'center', marginTop: space(10) },
});
