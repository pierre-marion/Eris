import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { colors, font, games, space, type GameKey } from '../theme';
import { COPY } from '../copy';
import { syncPronoReminders } from '../lib/notifications';
import { MATCHES, TEST_MATCH } from '../data/matches';
import type { Match } from '../types';
import { MatchCard } from '../components/MatchCard';
import { MatchDetailScreen } from './MatchDetailScreen';
import { fetchTierSMatches, hasToken } from '../api/pandascore';

/** Injecte le match test en haut du feed (mettre à false pour le retirer). */
const SHOW_TEST_MATCH = false;
import { dayKey, dayLabel, sortKey } from '../lib/dates';
import type { usePredictions } from '../hooks/usePredictions';
import type { EventScope } from '../scope';

type Source = 'live' | 'demo';
type Section = { key: string; title: string; data: Match[] };

/** Regroupe les matchs par jour (triés), un jour = une section. */
function groupByDay(matches: Match[]): Section[] {
  const sorted = [...matches].sort((a, b) => sortKey(a.startsAt) - sortKey(b.startsAt));
  const sections: Section[] = [];
  const index = new Map<string, Section>();
  for (const m of sorted) {
    const key = dayKey(m.startsAt);
    let section = index.get(key);
    if (!section) {
      section = { key, title: dayLabel(m.startsAt), data: [] };
      index.set(key, section);
      sections.push(section);
    }
    section.data.push(m);
  }
  return sections;
}

export function FeedScreen({
  game,
  event,
  predictions,
}: {
  game: GameKey;
  event: EventScope;
  predictions: ReturnType<typeof usePredictions>;
}) {
  const { preds, settledIds, update } = predictions;
  const [matches, setMatches] = useState<Match[]>(MATCHES);
  const [detail, setDetail] = useState<Match | null>(null);
  const [, setSource] = useState<Source>('demo');
  const [loading, setLoading] = useState<boolean>(hasToken());
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!hasToken()) {
      setMatches(MATCHES);
      setSource('demo');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const live = await fetchTierSMatches();
      if (live.length > 0) {
        setMatches(live);
        setSource('live');
      } else {
        setMatches(MATCHES);
        setSource('demo');
        setError('Aucun match tier S à venir pour le moment — affichage démo.');
      }
    } catch (e) {
      setMatches(MATCHES);
      setSource('demo');
      setError(e instanceof Error ? e.message : 'Erreur PandaScore — affichage démo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // (Re)planifie les rappels de prono locaux dès que matchs ou Calls changent.
  useEffect(() => {
    syncPronoReminders(matches, preds).catch((e) => console.warn('syncPronoReminders:', e));
  }, [matches, preds]);

  // Scope { jeu, event } : filtré par jeu, par event si choisi, puis par jour.
  const sections = useMemo(() => {
    const all = SHOW_TEST_MATCH ? [TEST_MATCH, ...matches] : matches;
    return groupByDay(
      all.filter(
        (m) =>
          m.game === game &&
          m.status !== 'live' && // le direct vit dans la zone "En direct" de Pronos
          !settledIds.has(m.id) &&
          (event.type !== 'event' || m.serieId === event.serieId),
      ),
    );
  }, [matches, game, event, settledIds]);

  return (
    <View style={styles.screen}>
      <SectionList
        sections={sections}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.gold} />
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.dayHeader}>{(section as Section).title}</Text>
        )}
        ListHeaderComponent={
          <View style={styles.top}>
            {loading && <ActivityIndicator color={colors.gold} style={{ marginTop: space(2) }} />}
            {error && <Text style={styles.error}>{error}</Text>}
          </View>
        }
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Rien sur {games[game].label}</Text>
              <Text style={styles.emptyTxt}>{COPY.empty}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <MatchCard
            match={item}
            pred={preds[item.id]}
            onChange={(patch) => update(item, patch)}
            onToggleBoost={() => update(item, { boosted: !preds[item.id]?.boosted })}
            onOpen={() => setDetail(item)}
          />
        )}
      />

      <Modal visible={!!detail} animationType="slide" onRequestClose={() => setDetail(null)}>
        {detail && (
          <MatchDetailScreen
            match={detail}
            pred={preds[detail.id]}
            onChange={(patch) => update(detail, patch)}
            onToggleBoost={() => update(detail, { boosted: !preds[detail.id]?.boosted })}
            onBack={() => setDetail(null)}
          />
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { paddingHorizontal: space(4), paddingTop: 0, paddingBottom: space(8) },
  top: { alignItems: 'flex-start' },
  summary: { ...font.h2, color: colors.gold },
  error: { ...font.small, color: colors.textFaint, marginTop: space(2) },

  dayHeader: {
    ...font.tag,
    color: colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    backgroundColor: colors.bg,
    paddingTop: space(2),
    paddingBottom: space(2),
  },

  empty: { paddingTop: space(10), alignItems: 'center' },
  emptyTitle: { ...font.h2, color: colors.text },
  emptyTxt: { ...font.small, color: colors.textMuted, marginTop: space(2), textAlign: 'center' },
});
