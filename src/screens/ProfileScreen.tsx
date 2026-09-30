import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, space } from '../theme';
import { useAuth } from '../auth/AuthContext';
import { fetchUserStats, type ResultRow, type UserStats } from '../lib/predictions';
import { fetchFriends, type Friend } from '../lib/friends';
import { ResultCard } from '../components/ResultCard';
import { SettingsScreen } from './SettingsScreen';
import { FriendsScreen } from './FriendsScreen';

export function ProfileScreen() {
  const { session, profile } = useAuth();
  const userId = session?.user?.id ?? null;
  const [stats, setStats] = useState<UserStats | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showFriends, setShowFriends] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return setLoading(false);
    setLoading(true);
    try {
      const [s, f] = await Promise.all([
        fetchUserStats(userId),
        fetchFriends().catch((e) => {
          console.warn('fetchFriends:', e);
          return [];
        }),
      ]);
      setStats(s);
      setFriends(f);
    } catch (e) {
      console.warn('Stats:', e);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const username = profile?.username ?? 'Joueur';
  const best = stats?.best;

  if (showSettings) return <SettingsScreen onBack={() => setShowSettings(false)} />;
  if (showFriends) return <FriendsScreen onBack={() => { setShowFriends(false); load(); }} />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.gold} />}
    >
      {/* Identité */}
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarTxt}>{username.slice(0, 2).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: space(3) }}>
          <Text style={styles.name}>{username}</Text>
        </View>
        <Pressable onPress={() => setShowSettings(true)} hitSlop={8}>
          <Ionicons name="settings-outline" size={22} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Mes potes — la couche amis (extension de l'identité) */}
      <Pressable style={styles.oracles} onPress={() => setShowFriends(true)}>
        <View style={styles.oraclesHead}>
          <Text style={styles.oraclesTitle}>Mes potes</Text>
          <View style={styles.oraclesAdd}>
            <Ionicons name="add" size={16} color={colors.gold} />
          </View>
        </View>
        {friends.length === 0 ? (
          <Text style={styles.oraclesEmpty}>Lie tes potes avec ton Code — c'est là que naît la discorde.</Text>
        ) : (
          <View style={styles.oraclesRow}>
            {friends.slice(0, 6).map((f) => (
              <View key={f.id} style={styles.miniAvatar}>
                <Text style={styles.miniAvatarTxt}>{f.username.slice(0, 2).toUpperCase()}</Text>
                {f.friendWins > f.myWins && (
                  <View style={styles.miniCrown}>
                    <Ionicons name="ribbon" size={10} color={colors.bg} />
                  </View>
                )}
              </View>
            ))}
            {friends.length > 6 && <Text style={styles.oraclesMore}>+{friends.length - 6}</Text>}
          </View>
        )}
        <Text style={styles.oraclesLink}>Voir tous mes joueurs →</Text>
      </Pressable>

      {loading && !stats ? (
        <ActivityIndicator color={colors.gold} style={{ marginTop: space(10) }} />
      ) : (
        <>
          {/* 3 stats clés */}
          <View style={styles.statsRow}>
            <Stat label="Réussite" value={`${stats?.successRate ?? 0}%`} />
            <Stat label="Calls" value={`${stats?.total ?? 0}`} />
            <Stat label="Série" value={`${stats?.streak ?? 0}`} icon="flame" gold />
          </View>

          {/* Palmarès */}
          <Text style={styles.section}>Palmarès</Text>
          <View style={styles.statsRow}>
            <Trophy icon="trophy" value={0} label="Titres" />
            <Trophy icon="medal" value={0} label="Podiums" />
            <Trophy icon="locate" value={stats?.exactCount ?? 0} label="Scores exacts" />
          </View>

          {/* Meilleur prono */}
          <Text style={styles.section}>Mon meilleur prono</Text>
          {best && best.points > 0 ? (
            <ResultCard row={bestToRow(best)} />
          ) : (
            <Text style={styles.empty}>Pas encore de prono gagnant. Va chercher ton premier gros score !</Text>
          )}

          {/* Historique */}
          <Pressable style={styles.histo} onPress={() => Alert.alert('Historique', 'Bientôt')}>
            <Ionicons name="time-outline" size={18} color={colors.textMuted} />
            <Text style={styles.histoTxt}>Historique des pronos</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

function Stat({ label, value, icon, gold }: { label: string; value: string; icon?: any; gold?: boolean }) {
  return (
    <View style={[styles.stat, gold && styles.statGold]}>
      <View style={styles.statValRow}>
        {icon && <Ionicons name={icon} size={18} color={colors.gold} style={{ marginRight: space(1) }} />}
        <Text style={[styles.statVal, gold && { color: colors.gold }]}>{value}</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Trophy({ icon, value, label }: { icon: any; value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={22} color={colors.gold} />
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function bestToRow(b: NonNullable<UserStats['best']>): ResultRow {
  return {
    matchId: 'best',
    game: b.game,
    serieId: null,
    tournament: b.tournament,
    teamA: b.teamA,
    teamB: b.teamB,
    teamALogo: b.teamALogo,
    teamBLogo: b.teamBLogo,
    scoreA: b.scoreA,
    scoreB: b.scoreB,
    resultA: b.resultA,
    resultB: b.resultB,
    boosted: b.boosted,
    pointsAwarded: b.points,
    settled: true,
  };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space(4), paddingBottom: space(10) },

  identity: { flexDirection: 'row', alignItems: 'center', marginBottom: space(6) },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.goldFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { ...font.h2, color: colors.gold, fontWeight: '800' },
  name: { ...font.h1, color: colors.text },
  rankTitle: { ...font.small, color: colors.gold, fontWeight: '700', marginTop: 1 },

  oracles: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space(4),
    marginBottom: space(2),
  },
  oraclesHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  oraclesTitle: { ...font.h2, color: colors.text },
  oraclesAdd: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oraclesEmpty: { ...font.small, color: colors.textMuted, marginTop: space(2) },
  oraclesRow: { flexDirection: 'row', alignItems: 'center', marginTop: space(3) },
  miniAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.goldFaint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space(2),
  },
  miniAvatarTxt: { ...font.small, color: colors.gold, fontWeight: '800' },
  miniCrown: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  oraclesMore: { ...font.small, color: colors.textMuted, fontWeight: '700', marginLeft: space(1) },
  oraclesLink: { ...font.small, color: colors.gold, fontWeight: '700', marginTop: space(3) },

  statsRow: { flexDirection: 'row', marginBottom: space(2) },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: space(4),
    alignItems: 'center',
    marginRight: space(2),
  },
  statGold: { borderColor: colors.goldFaint },
  statValRow: { flexDirection: 'row', alignItems: 'center' },
  statVal: { ...font.h1, color: colors.text, marginTop: space(1) },
  statLabel: { ...font.tag, color: colors.textFaint, textTransform: 'uppercase', marginTop: space(1) },

  section: { ...font.tag, color: colors.textFaint, textTransform: 'uppercase', marginTop: space(5), marginBottom: space(2) },

  empty: { ...font.small, color: colors.textMuted },

  histo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space(4),
    marginTop: space(6),
  },
  histoTxt: { ...font.body, color: colors.text, flex: 1, marginLeft: space(3), fontWeight: '600' },
});
