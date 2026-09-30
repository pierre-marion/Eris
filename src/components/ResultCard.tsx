import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, space } from '../theme';
import { LINES, pick } from '../copy';
import type { ResultRow } from '../lib/predictions';
import { GamePill } from './GamePill';

/** Carte d'un match : résultat réel (réglé) · score live (en cours) · prono + badge. */
export function ResultCard({ row, live }: { row: ResultRow; live?: { a: number; b: number } }) {
  const pending = !row.settled;
  const isLive = pending && !!live;
  const exact =
    row.settled && row.scoreA != null && row.scoreA === row.resultA && row.scoreB === row.resultB;
  const won = row.pointsAwarded > 0;
  const hasPred = row.scoreA != null && row.scoreB != null;

  const showA = row.settled ? row.resultA : isLive ? live!.a : null;
  const showB = row.settled ? row.resultB : isLive ? live!.b : null;

  // Vanne selon l'issue (le fait — +gain — reste dans le texte).
  const resultMsg = useMemo(() => {
    if (!row.settled) return '';
    const g = row.pointsAwarded;
    const key = g <= 0 ? 'resLoss' : exact ? 'resExact' : row.boosted ? 'resBoost' : g >= 120 ? 'resUpset' : 'resWin';
    return pick(row.matchId + key, LINES[key]).replace('{g}', String(g));
  }, [row.matchId, row.settled, row.pointsAwarded, exact, row.boosted]);

  return (
    <View style={[styles.card, row.boosted && won && styles.cardBoost]}>
      {row.boosted && (
        <View style={styles.boostBanner}>
          <Ionicons name="flash" size={12} color={colors.bg} />
          <Text style={styles.boostBannerTxt}>BOOST ×2</Text>
        </View>
      )}

      <View style={styles.body}>
        <View style={styles.header}>
          <GamePill game={row.game} tournament={row.tournament ?? 'Tournoi'} />
          {isLive && <Text style={styles.liveTag}>● EN DIRECT</Text>}
        </View>

        {/* Score : logos + résultat / live / en attente */}
        <View style={styles.row}>
          <View style={styles.team}>
            <Logo uri={row.teamALogo} tag={row.teamA} />
            <Text style={styles.tag} numberOfLines={1}>{row.teamA ?? '—'}</Text>
          </View>

          {showA != null ? (
            <Text style={[styles.score, isLive && styles.scoreLive]}>
              {showA} <Text style={styles.dash}>–</Text> {showB}
            </Text>
          ) : (
            <Text style={styles.pendingScore}>· · ·</Text>
          )}

          <View style={styles.team}>
            <Logo uri={row.teamBLogo} tag={row.teamB} />
            <Text style={styles.tag} numberOfLines={1}>{row.teamB ?? '—'}</Text>
          </View>
        </View>

        {/* Call + badge */}
        <View style={styles.footer}>
          <Text style={styles.pred}>Ton Call : {hasPred ? `${row.scoreA}–${row.scoreB}` : '—'}</Text>
          {row.settled ? (
            <Badge won={won} exact={!!exact} boosted={row.boosted} points={row.pointsAwarded} />
          ) : isLive ? (
            <Text style={styles.pendingLive}>Call en cours…</Text>
          ) : (
            <Text style={styles.pending}>En attente du résultat</Text>
          )}
        </View>

        {/* Vanne selon l'issue */}
        {row.settled && !!resultMsg && <Text style={styles.perfectMsg}>{resultMsg}</Text>}
      </View>
    </View>
  );
}

function Logo({ uri, tag }: { uri: string | null; tag: string | null }) {
  if (uri) return <Image source={{ uri }} style={styles.logo} resizeMode="contain" />;
  return (
    <View style={styles.logoFallback}>
      <Text style={styles.logoFallbackTxt}>{(tag ?? '?').slice(0, 3)}</Text>
    </View>
  );
}

function Badge({
  won,
  exact,
  boosted,
  points,
}: {
  won: boolean;
  exact: boolean;
  boosted: boolean;
  points: number;
}) {
  if (!won) {
    return (
      <View style={[styles.badge, styles.badgeLoss]}>
        <Text style={[styles.badgeTxt, { color: colors.textFaint }]}>Raté · +0</Text>
      </View>
    );
  }
  const label = exact
    ? boosted
      ? `Score exact ×2 · +${points}`
      : `Score exact · +${points}`
    : `+${points} points`;
  return (
    <View style={[styles.badge, { backgroundColor: '#2A0E1C', borderColor: colors.gold }]}>
      <Text style={[styles.badgeTxt, { color: colors.gold }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: space(3),
    overflow: 'hidden',
  },
  cardBoost: { borderColor: colors.goldFaint },
  body: { padding: space(4) },

  boostBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    paddingVertical: space(1.5),
  },
  boostBannerTxt: { ...font.tag, color: colors.bg, fontWeight: '800', marginLeft: space(1) },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveTag: { ...font.tag, color: colors.danger, fontWeight: '800' },

  row: { flexDirection: 'row', alignItems: 'center', marginTop: space(3) },
  team: { flex: 1, alignItems: 'center' },
  logo: { width: 44, height: 44, marginBottom: space(1) },
  logoFallback: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space(1),
  },
  logoFallbackTxt: { ...font.small, color: colors.textMuted, fontWeight: '700' },
  tag: { ...font.h2, color: colors.text },

  score: { ...font.score, color: colors.text, paddingHorizontal: space(3) },
  scoreLive: { color: colors.danger },
  dash: { color: colors.textFaint },
  pendingScore: { ...font.score, color: colors.textFaint, paddingHorizontal: space(3) },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space(3),
    paddingTop: space(3),
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  pred: { ...font.small, color: colors.textMuted },
  perfectMsg: { ...font.small, color: colors.gold, fontWeight: '700', fontStyle: 'italic', marginTop: space(2) },
  pending: { ...font.small, color: colors.textMuted, fontStyle: 'italic' },
  pendingLive: { ...font.small, color: colors.danger, fontWeight: '700' },

  badge: {
    paddingHorizontal: space(3),
    paddingVertical: space(1.5),
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  badgeLoss: { backgroundColor: colors.card, borderColor: colors.border },
  badgeTxt: { ...font.small, fontWeight: '800' },
});
