import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { colors, font, games, radius, space, type GameKey } from '../theme';
import { eventLabel, type EventScope } from '../scope';
import { COPY } from '../copy';
import { useAuth } from '../auth/AuthContext';
import { fetchResults, type ResultRow } from '../lib/predictions';
import { fetchLiveScores } from '../api/pandascore';
import { ResultCard } from '../components/ResultCard';

export function ResultsScreen({ game, event }: { game: GameKey; event: EventScope }) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [live, setLive] = useState<Record<string, { a: number; b: number }>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [res, scores] = await Promise.all([
        fetchResults(userId),
        fetchLiveScores().catch(() => ({})),
      ]);
      setRows(res);
      setLive(scores);
    } catch (e) {
      console.warn('Chargement résultats:', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.game === game &&
          (event.type !== 'event' || r.serieId === event.serieId) &&
          !(!r.settled && live[r.matchId]), // en direct → dans la zone "En direct", pas ici
      ),
    [rows, game, event, live],
  );

  const settled = shown.filter((r) => r.settled);
  const points = settled.reduce((s, r) => s + r.pointsAwarded, 0);
  const won = settled.filter((r) => r.pointsAwarded > 0).length;

  return (
    <View style={styles.screen}>
      <FlatList
        data={shown}
        keyExtractor={(r) => r.matchId}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.gold} />
        }
        ListHeaderComponent={
          <View style={styles.metrics}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel} numberOfLines={1}>points · {eventLabel(event, games[game].label)}</Text>
              <Text style={styles.metricGold}>+{points}</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>Réussite</Text>
              <Text style={styles.metricVal}>
                {won}/{settled.length}
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => <ResultCard row={item} live={live[item.matchId]} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.gold} style={{ marginTop: space(10) }} />
          ) : (
            <Text style={styles.empty}>{COPY.empty}</Text>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { paddingHorizontal: space(4), paddingTop: space(4), paddingBottom: space(8) },

  metrics: { flexDirection: 'row', marginBottom: space(5) },
  metric: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space(4),
    marginRight: space(2),
  },
  metricLabel: { ...font.tag, color: colors.textFaint, textTransform: 'uppercase' },
  metricGold: { color: colors.gold, fontSize: 26, fontWeight: '800', marginTop: space(1) },
  metricVal: { ...font.h1, color: colors.text, marginTop: space(1) },

  empty: { ...font.small, color: colors.textMuted, textAlign: 'center', marginTop: space(10) },
});
