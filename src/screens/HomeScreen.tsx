import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, games, radius, space, type GameKey } from '../theme';
import { eventLabel, type EventScope } from '../scope';
import { MATCHES } from '../data/matches';
import type { Match } from '../types';
import { fetchTierSMatches, hasToken } from '../api/pandascore';
import { dayKey, sortKey } from '../lib/dates';
import { useAuth } from '../auth/AuthContext';
import type { usePredictions } from '../hooks/usePredictions';
import { fetchMyLeagues, fetchLeagueLeaderboard, type League } from '../lib/leagues';
import { MatchCard } from '../components/MatchCard';

interface LeagueRow {
  league: League;
  rank: number | null;
}

export function HomeScreen({
  game,
  event,
  predictions,
  onGoToPronos,
  onGoToLeagues,
}: {
  game: GameKey;
  event: EventScope;
  predictions: ReturnType<typeof usePredictions>;
  onGoToPronos: () => void;
  onGoToLeagues: () => void;
}) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const { preds, update } = predictions;
  const [matches, setMatches] = useState<Match[]>(MATCHES);
  const [leagues, setLeagues] = useState<LeagueRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMatches(
        hasToken()
          ? await fetchTierSMatches().catch((e) => {
              console.warn('fetchTierSMatches:', e);
              return MATCHES;
            })
          : MATCHES,
      );

      if (userId) {
        const mine = await fetchMyLeagues().catch((e) => {
          console.warn('fetchMyLeagues:', e);
          return [];
        });
        const scoped = mine.filter(
          (l) =>
            (!l.game || l.game === game) &&
            (event.type !== 'event' || !l.serie_id || l.serie_id === event.serieId),
        );
        const rows = await Promise.all(
          scoped.map(async (league) => {
            try {
              const board = await fetchLeagueLeaderboard(league.id);
              return { league, rank: board.find((r) => r.user_id === userId)?.rank ?? null };
            } catch (e) {
              console.warn('fetchLeagueLeaderboard:', e);
              return { league, rank: null };
            }
          }),
        );
        setLeagues(rows);
      } else {
        setLeagues([]);
      }
    } finally {
      setLoading(false);
    }
  }, [game, event, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const gameLabel = games[game].label;
  const todayKey = dayKey(new Date().toISOString());

  // Matchs OUVERTS du scope (pas live = trop tard), triés par horaire.
  const openScoped = matches
    .filter(
      (m) =>
        m.game === game &&
        m.status === 'open' &&
        (event.type !== 'event' || m.serieId === event.serieId),
    )
    .sort((a, b) => sortKey(a.startsAt) - sortKey(b.startsAt));

  // Priorité aux matchs du jour ; sinon on montre les prochains (l'Autel n'est jamais vide pour rien).
  // Digest : 2 max sur la card, le reste via « Voir tous les pronos ».
  const todayMatches = openScoped.filter((m) => dayKey(m.startsAt) === todayKey);
  const hasToday = todayMatches.length > 0;
  const toShow = (hasToday ? todayMatches : openScoped).slice(0, 2);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      automaticallyAdjustKeyboardInsets
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.gold} />}
    >
      {/* BLOC 1 — À pronostiquer (pronostique direct ici) */}
      <View style={styles.blockHead}>
        <Text style={styles.blockTitle} numberOfLines={1}>
          {hasToday ? "À pronostiquer aujourd'hui" : 'Tes prochains matchs'}
        </Text>
        {hasToday && <Text style={styles.badge}>{todayMatches.length} en attente</Text>}
      </View>

      {toShow.length === 0 ? (
        <Pressable style={styles.empty} onPress={onGoToPronos}>
          <Ionicons name="time-outline" size={22} color={colors.textFaint} style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>Rien à pronostiquer</Text>
          <Text style={styles.emptyTxt}>
            Aucun match ouvert sur {eventLabel(event, gameLabel)} pour l'instant.
          </Text>
          <Text style={styles.link}>Voir tous les pronos →</Text>
        </Pressable>
      ) : (
        <>
          {toShow.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              pred={preds[m.id]}
              onChange={(patch) => update(m, patch)}
              onToggleBoost={() => update(m, { boosted: !preds[m.id]?.boosted })}
            />
          ))}
          <Pressable onPress={onGoToPronos}>
            <Text style={styles.link}>Voir tous les pronos →</Text>
          </Pressable>
        </>
      )}

      {/* BLOC 2 — Mes ligues (le suivi) */}
      <View style={[styles.blockHead, { marginTop: space(8) }]}>
        <Text style={styles.blockTitle}>Mes ligues</Text>
        <Pressable onPress={onGoToLeagues} hitSlop={6}>
          <Text style={styles.join}>Rejoindre</Text>
        </Pressable>
      </View>

      {loading && leagues.length === 0 ? (
        <ActivityIndicator color={colors.gold} style={{ marginTop: space(4) }} />
      ) : leagues.length === 0 ? (
        <Pressable style={styles.empty} onPress={onGoToLeagues}>
          <Ionicons name="people-outline" size={22} color={colors.textFaint} style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>Aucune ligue sur cet event</Text>
          <Text style={styles.emptyTxt}>Crée la tienne ou rejoins celle d'un pote via un code.</Text>
          <Text style={styles.link}>Aller aux ligues →</Text>
        </Pressable>
      ) : (
        leagues.map(({ league, rank }) => (
          <Pressable key={league.id} style={styles.league} onPress={onGoToLeagues}>
            <View style={{ flex: 1 }}>
              <Text style={styles.leagueName} numberOfLines={1}>{league.name}</Text>
              <Text style={styles.leagueScope} numberOfLines={1}>
                {league.tournament ?? `Tout ${gameLabel}`}
              </Text>
            </View>
            <Text style={styles.rank}>{rank ? `#${rank}` : '—'}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space(4), paddingBottom: space(10) },

  blockHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space(3),
  },
  blockTitle: { ...font.section, color: colors.text, flexShrink: 1, marginRight: space(2) },
  badge: { ...font.tag, color: colors.gold, fontWeight: '800' },
  join: { ...font.small, color: colors.gold, fontWeight: '700' },

  link: { ...font.small, color: colors.gold, fontWeight: '700', marginTop: space(2) },

  league: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space(3),
    marginBottom: space(2),
  },
  leagueName: { ...font.h2, color: colors.text },
  leagueScope: { ...font.small, color: colors.textMuted, marginTop: 2 },
  rank: { ...font.h2, color: colors.gold, fontWeight: '800', marginRight: space(2) },

  empty: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space(4),
  },
  emptyIcon: { marginBottom: space(2) },
  emptyTitle: { ...font.h2, color: colors.text },
  emptyTxt: { ...font.small, color: colors.textMuted, marginTop: space(2) },
});
