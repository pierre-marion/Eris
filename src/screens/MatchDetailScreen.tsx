import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, space } from '../theme';
import type { Match, Prediction } from '../types';
import { MatchCard } from '../components/MatchCard';
import { fetchH2H, fetchRecentForm } from '../api/pandascore';
import {
  fetchCommunity,
  fetchSquadCalls,
  fetchTeamRecord,
  type Community,
  type SquadCall,
} from '../lib/matchDetail';

type H2H = { aWins: number; bWins: number; recent: { aWon: boolean }[] };
type Record = { total: number; correct: number };

/** Déduit l'enjeu du match depuis son nom brut PandaScore. */
function enjeu(name?: string | null): string | null {
  if (!name) return null;
  const n = name.toLowerCase();
  if (n.includes('grand final')) return 'La finale. Tout se joue ici.';
  if (n.includes('final') && (n.includes('upper') || n.includes('lower'))) return 'Finale de bracket. Le perdant recule.';
  if (n.includes('final')) return 'La finale.';
  if (n.includes('elimination') || n.includes('lower bracket') || n.includes('decider')) return 'Le perdant est éliminé.';
  if (n.includes('semifinal') || n.includes('semi-final')) return 'Demi-finale.';
  if (n.includes('quarterfinal') || n.includes('quarter-final')) return 'Quart de finale.';
  return null;
}

export function MatchDetailScreen({
  match,
  pred,
  onChange,
  onToggleBoost,
  onBack,
}: {
  match: Match;
  pred?: Prediction;
  onChange: (patch: Partial<Prediction>) => void;
  onToggleBoost: () => void;
  onBack: () => void;
}) {
  const [comm, setComm] = useState<Community | null>(null);
  const [squad, setSquad] = useState<SquadCall[]>([]);
  const [formA, setFormA] = useState<('V' | 'D')[]>([]);
  const [formB, setFormB] = useState<('V' | 'D')[]>([]);
  const [h2h, setH2h] = useState<H2H | null>(null);
  const [recA, setRecA] = useState<Record | null>(null);
  const [recB, setRecB] = useState<Record | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [c, s, fa, fb, hh, ra, rb] = await Promise.all([
        fetchCommunity(match.id).catch((e) => {
          console.warn('fetchCommunity:', e);
          return null;
        }),
        fetchSquadCalls(match.id).catch((e) => {
          console.warn('fetchSquadCalls:', e);
          return [];
        }),
        fetchRecentForm(match.game, match.teamA.id).catch(() => []),
        fetchRecentForm(match.game, match.teamB.id).catch(() => []),
        fetchH2H(match.game, match.teamA.id, match.teamB.id).catch(() => null),
        fetchTeamRecord(match.teamA.tag).catch((e) => {
          console.warn('fetchTeamRecord:', e);
          return null;
        }),
        fetchTeamRecord(match.teamB.tag).catch((e) => {
          console.warn('fetchTeamRecord:', e);
          return null;
        }),
      ]);
      if (!alive) return;
      setComm(c);
      setSquad(s);
      setFormA(fa);
      setFormB(fb);
      setH2h(hh);
      setRecA(ra);
      setRecB(rb);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [match.id]);

  const total = comm ? comm.onA + comm.onB : 0;
  const pctA = total ? Math.round((comm!.onA / total) * 100) : 50;
  const pctB = 100 - pctA;
  const mine =
    pred?.scoreA != null && pred?.scoreB != null && pred.scoreA !== pred.scoreB
      ? pred.scoreA > pred.scoreB
        ? 'A'
        : 'B'
      : null;
  const minePct = mine === 'A' ? pctA : mine === 'B' ? pctB : null;
  const stake = enjeu(match.matchName);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.head}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.gold} />
        </Pressable>
        <Text style={styles.headTitle} numberOfLines={1}>
          {match.teamA.tag} vs {match.teamB.tag}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Enjeu */}
        {stake && (
          <View style={styles.stake}>
            <View style={styles.stakeBar} />
            <Text style={styles.stakeTxt}>{stake}</Text>
          </View>
        )}

        {/* Le call (card réutilisée : tap sur les scores = caller ici) */}
        <MatchCard match={match} pred={pred} onChange={onChange} onToggleBoost={onToggleBoost} />

        {/* Stream */}
        {match.stream && (
          <Pressable style={styles.stream} onPress={() => Linking.openURL(match.stream!).catch(() => {})}>
            <Ionicons name="play-circle" size={18} color={colors.gold} />
            <Text style={styles.streamTxt}>Regarder le match</Text>
          </Pressable>
        )}

        {/* Ce que les autres ont callé */}
        <Text style={styles.section}>CE QUE LES AUTRES ONT CALLÉ</Text>
        {total > 0 ? (
          <View>
            <View style={styles.commLabels}>
              <Text style={styles.commTeamA} numberOfLines={1}>
                {match.teamA.tag} {pctA}%{mine === 'A' ? ' · toi' : ''}
              </Text>
              <Text style={styles.commTeamB} numberOfLines={1}>
                {pctB}% {match.teamB.tag}{mine === 'B' ? ' · toi' : ''}
              </Text>
            </View>
            <View style={styles.commBar}>
              <View style={[styles.segA, { flex: Math.max(pctA, 0.001) }]} />
              <View style={[styles.segB, { flex: Math.max(pctB, 0.001) }]} />
            </View>
            <Text style={styles.commHint}>
              {total} call{total > 1 ? 's' : ''}
              {minePct != null && minePct < 40 ? ' · minoritaire, call plus payant' : ''}
              {minePct != null && minePct >= 60 ? ' · avec la masse, zéro gloire' : ''}
            </Text>
          </View>
        ) : (
          <Text style={styles.muted}>Personne n'a encore callé. Sois le premier.</Text>
        )}

        {/* Face-à-face */}
        <Text style={styles.section}>FACE À FACE</Text>
        {h2h && h2h.aWins + h2h.bWins > 0 ? (
          <View style={styles.h2h}>
            <Text style={[styles.h2hTag, h2h.aWins >= h2h.bWins && styles.h2hLead]} numberOfLines={1}>
              {match.teamA.tag}
            </Text>
            <Text style={styles.h2hScore}>
              {h2h.aWins} <Text style={styles.h2hDash}>–</Text> {h2h.bWins}
            </Text>
            <Text style={[styles.h2hTag, styles.h2hTagRight, h2h.bWins >= h2h.aWins && styles.h2hLead]} numberOfLines={1}>
              {match.teamB.tag}
            </Text>
          </View>
        ) : (
          <Text style={styles.muted}>Jamais affrontées récemment.</Text>
        )}

        {/* Forme récente */}
        <Text style={styles.section}>FORME RÉCENTE</Text>
        <FormRow tag={match.teamA.tag} form={formA} />
        <FormRow tag={match.teamB.tag} form={formB} />

        {/* Ton bilan sur ces équipes */}
        {((recA?.total ?? 0) > 0 || (recB?.total ?? 0) > 0) && (
          <>
            <Text style={styles.section}>TON BILAN SUR CES ÉQUIPES</Text>
            {recA && recA.total > 0 && <RecordRow tag={match.teamA.tag} r={recA} />}
            {recB && recB.total > 0 && <RecordRow tag={match.teamB.tag} r={recB} />}
          </>
        )}

        {/* Dans tes potes */}
        <Text style={styles.section}>DANS TES POTES</Text>
        {squad.length === 0 ? (
          <Text style={styles.muted}>Personne dans tes potes. Ajoute-en pour les espionner.</Text>
        ) : (
          squad.map((s, i) => <SquadRow key={i} s={s} />)
        )}
        {loading && <ActivityIndicator color={colors.gold} style={{ marginTop: space(4) }} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function FormRow({ tag, form }: { tag: string; form: ('V' | 'D')[] }) {
  return (
    <View style={styles.formRow}>
      <Text style={styles.formTag} numberOfLines={1}>{tag}</Text>
      <View style={styles.formBadges}>
        {form.length === 0 ? (
          <Text style={styles.muted}>—</Text>
        ) : (
          form.map((r, i) => (
            <View key={i} style={[styles.formBadge, r === 'V' ? styles.formWin : styles.formLoss]}>
              <Text style={styles.formBadgeTxt}>{r}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

function RecordRow({ tag, r }: { tag: string; r: Record }) {
  return (
    <View style={styles.recordRow}>
      <Text style={styles.recordTxt}>
        Tu as callé <Text style={styles.recordTag}>{tag}</Text> {r.total} fois ·{' '}
        <Text style={styles.recordHit}>{r.correct} juste</Text>
      </Text>
    </View>
  );
}

function SquadRow({ s }: { s: SquadCall }) {
  return (
    <View style={styles.squadRow}>
      <Text style={styles.squadName} numberOfLines={1}>{s.username}</Text>
      {s.called ? (
        <View style={styles.squadCall}>
          {s.boosted && <Ionicons name="flash" size={13} color={colors.gold} style={{ marginRight: space(1) }} />}
          <Text style={styles.squadScore}>{s.scoreA}–{s.scoreB}</Text>
        </View>
      ) : (
        <Text style={styles.squadNone}>rien callé</Text>
      )}
    </View>
  );
}

const GRAY = '#3A3A3A';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space(3),
    paddingVertical: space(3),
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  headTitle: { ...font.h2, color: colors.text, flex: 1, textAlign: 'center' },
  content: { padding: space(4), paddingBottom: space(10) },

  stake: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    paddingVertical: space(3),
    paddingRight: space(4),
    marginBottom: space(4),
    overflow: 'hidden',
  },
  stakeBar: { width: 4, alignSelf: 'stretch', backgroundColor: colors.gold, marginRight: space(3) },
  stakeTxt: { ...font.body, color: colors.text, fontWeight: '800', flex: 1 },

  stream: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: space(3),
    marginTop: space(1),
  },
  streamTxt: { ...font.body, color: colors.gold, fontWeight: '700', marginLeft: space(2) },

  section: { ...font.tag, color: colors.textFaint, letterSpacing: 1.5, marginTop: space(6), marginBottom: space(3) },
  muted: { ...font.small, color: colors.textMuted },

  commLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: space(2) },
  commTeamA: { ...font.body, color: colors.gold, fontWeight: '800' },
  commTeamB: { ...font.body, color: colors.textMuted, fontWeight: '800' },
  commBar: { flexDirection: 'row', height: 14, borderRadius: radius.pill, overflow: 'hidden' },
  segA: { backgroundColor: colors.gold },
  segB: { backgroundColor: GRAY },
  commHint: { ...font.small, color: colors.textFaint, marginTop: space(2) },

  h2h: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space(4),
    paddingHorizontal: space(4),
  },
  h2hTag: { ...font.h2, color: colors.textMuted, flex: 1 },
  h2hTagRight: { textAlign: 'right' },
  h2hLead: { color: colors.gold },
  h2hScore: { ...font.score, color: colors.text, paddingHorizontal: space(3) },
  h2hDash: { color: colors.textFaint },

  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: space(3),
    paddingHorizontal: space(4),
    marginBottom: space(2),
  },
  formTag: { ...font.h2, color: colors.text, flex: 1 },
  formBadges: { flexDirection: 'row' },
  formBadge: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: space(1.5),
  },
  formWin: { backgroundColor: colors.success },
  formLoss: { backgroundColor: colors.danger },
  formBadgeTxt: { ...font.tag, color: colors.bg, fontWeight: '800' },

  recordRow: { paddingVertical: space(2) },
  recordTxt: { ...font.body, color: colors.textMuted },
  recordTag: { color: colors.text, fontWeight: '800' },
  recordHit: { color: colors.gold, fontWeight: '800' },

  squadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space(3),
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  squadName: { ...font.body, color: colors.text, flex: 1, fontWeight: '600' },
  squadCall: { flexDirection: 'row', alignItems: 'center' },
  squadScore: { ...font.body, color: colors.gold, fontWeight: '800' },
  squadNone: { ...font.small, color: colors.textFaint, fontStyle: 'italic' },
});
