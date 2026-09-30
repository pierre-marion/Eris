import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { Animated, Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, space, type GameKey } from '../theme';
import { ALL_SCOPE, type EventScope } from '../scope';
import type { usePredictions } from '../hooks/usePredictions';
import type { Match, Prediction } from '../types';
import { fetchLiveScores, fetchTierSMatches, hasToken } from '../api/pandascore';
import { fetchCompetitions, type Competition } from '../lib/competitions';
import { MATCHES } from '../data/matches';
import { GamePill } from '../components/GamePill';
import { FeedScreen } from './FeedScreen';
import { ResultsScreen } from './ResultsScreen';

type Sub = 'upcoming' | 'results';
type Scores = Record<string, { a: number; b: number }>;

// Carrousel : une card à la fois, la suivante dépasse un peu pour inviter au swipe.
const GAP = space(2);
const CARD_W = Dimensions.get('window').width - space(4) - space(7);

/** Page Pronos : zone "En direct" (conditionnelle) + sous-onglet À venir / Résultats. */
export function PronosScreen({
  game,
  predictions,
}: {
  game: GameKey;
  predictions: ReturnType<typeof usePredictions>;
}) {
  const { preds } = predictions;
  const [sub, setSub] = useState<Sub>('upcoming');
  const [liveMatches, setLiveMatches] = useState<Match[]>([]);
  const [scores, setScores] = useState<Scores>({});
  // Filtre région/event LOCAL au feed (le header ne choisit que le jeu).
  const [filter, setFilter] = useState<EventScope>(ALL_SCOPE);
  const [comps, setComps] = useState<Competition[]>([]);

  // Compétitions du jeu → chips de filtre. Reset du filtre quand on change de jeu.
  useEffect(() => {
    setFilter(ALL_SCOPE);
    fetchCompetitions(game).then(setComps).catch(() => setComps([]));
  }, [game]);

  // Matchs en cours + scores live, rafraîchis pendant qu'on est sur la page.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const all = hasToken() ? await fetchTierSMatches() : MATCHES;
        const live = hasToken() ? await fetchLiveScores() : {};
        if (!alive) return;
        setLiveMatches(all.filter((m) => m.status === 'live'));
        setScores(live);
      } catch (e) {
        console.warn('Live matches:', e);
        /* la zone disparaît, le reste de la page tient */
      }
    };
    load();
    const id = setInterval(load, 45000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Mes Calls scellés sur un match en cours, dans le scope courant — le moment de tension.
  const liveScoped = useMemo(
    () =>
      liveMatches.filter(
        (m) =>
          m.game === game &&
          (filter.type !== 'event' || m.serieId === filter.serieId) &&
          preds[m.id]?.scoreA != null &&
          preds[m.id]?.scoreB != null,
      ),
    [liveMatches, game, filter, preds],
  );

  // Chips : uniquement les events en cours + à venir (pas les terminés).
  const chipComps = comps.filter((c) => c.status !== 'past');

  const filterBar = chipComps.length > 0 && (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterScroll}
      contentContainerStyle={styles.filterRow}
    >
      <FilterChip label="Tous" active={filter.type !== 'event'} onPress={() => setFilter(ALL_SCOPE)} />
      {chipComps.map((c) => (
        <FilterChip
          key={c.serieId}
          label={c.tournament}
          live={c.status === 'live'}
          active={filter.type === 'event' && filter.serieId === c.serieId}
          onPress={() => setFilter({ type: 'event', serieId: c.serieId, label: c.tournament })}
        />
      ))}
    </ScrollView>
  );

  return (
    <View style={styles.screen}>
      {liveScoped.length > 0 && (
        <View style={styles.liveZone}>
          <View style={styles.liveHead}>
            <PulseDot />
            <Text style={styles.liveHeadTxt}>EN DIRECT</Text>
            <View style={{ flex: 1 }} />
            {liveScoped.length > 1 && (
              <Text style={styles.liveCount}>{liveScoped.length} matchs</Text>
            )}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_W + GAP}
            decelerationRate="fast"
            contentContainerStyle={styles.carousel}
          >
            {liveScoped.map((m) => (
              <View key={m.id} style={{ width: CARD_W, marginRight: GAP }}>
                <LiveCard match={m} pred={preds[m.id]} score={scores[m.id]} />
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.toggle}>
        <Seg label="À venir" active={sub === 'upcoming'} onPress={() => setSub('upcoming')} />
        <Seg label="Résultats" active={sub === 'results'} onPress={() => setSub('results')} />
      </View>

      {/* Filtre région / event — sous le toggle, il affine le sous-onglet */}
      {filterBar}

      <View style={styles.body}>
        <View style={[styles.page, sub !== 'upcoming' && styles.hidden]}>
          <FeedScreen game={game} event={filter} predictions={predictions} />
        </View>
        <View style={[styles.page, sub !== 'results' && styles.hidden]}>
          <ResultsScreen game={game} event={filter} />
        </View>
      </View>
    </View>
  );
}

function FilterChip({
  label,
  active,
  live,
  onPress,
}: {
  label: string;
  active: boolean;
  live?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      {live && <View style={styles.chipLiveDot} />}
      <Text style={[styles.chipTxt, active && styles.chipTxtActive]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

/** Pastille rouge qui pulse — la tension du direct. */
function PulseDot() {
  const a = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 0.25, duration: 700, useNativeDriver: true }),
        Animated.timing(a, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [a]);
  return <Animated.View style={[styles.liveDot, { opacity: a }]} />;
}

function LiveCard({ match, pred, score }: { match: Match; pred?: Prediction; score?: { a: number; b: number } }) {
  const mapNo = score ? score.a + score.b + 1 : null;
  const augure = `${pred?.scoreA ?? '–'}–${pred?.scoreB ?? '–'}`;
  const st = liveStatus(pred, score);
  return (
    <View style={styles.liveCard}>
      <View style={styles.liveCardHead}>
        <GamePill game={match.game} tournament={match.tournament} stage={match.stage} />
        {mapNo != null && <Text style={styles.mapTag}>map {mapNo}</Text>}
      </View>

      {/* Score live (ou fallback sans score) */}
      <View style={styles.liveRow}>
        <Team team={match.teamA} />
        {score ? (
          <Text style={styles.liveScore}>
            {score.a} <Text style={styles.liveDash}>–</Text> {score.b}
          </Text>
        ) : (
          <Text style={styles.liveScoreNone}>···</Text>
        )}
        <Team team={match.teamB} />
      </View>

      {/* Ton Call + statut (icône pro, pas d'emoji) */}
      <View style={styles.liveFoot}>
        <Text style={styles.liveAugure}>Ton Call : {augure}</Text>
        <View style={styles.statusRow}>
          <Ionicons name={st.icon} size={14} color={st.tone} />
          <Text style={[styles.liveStatus, { color: st.tone }]}>{st.label}</Text>
        </View>
      </View>
    </View>
  );
}

function Team({ team }: { team: Match['teamA'] }) {
  return (
    <View style={styles.team}>
      {team.logo ? (
        <Image source={{ uri: team.logo }} style={styles.teamLogo} resizeMode="contain" />
      ) : (
        <View style={styles.teamLogoFallback}>
          <Text style={styles.teamLogoTxt}>{team.tag.slice(0, 3)}</Text>
        </View>
      )}
      <Text style={styles.teamTag} numberOfLines={1}>{team.tag}</Text>
    </View>
  );
}

type Status = { icon: ComponentProps<typeof Ionicons>['name']; label: string; tone: string };

/** Statut taquin : compare ton pronostic au score qui tourne (icône + mot, pas d'emoji). */
function liveStatus(pred?: Prediction, score?: { a: number; b: number }): Status {
  if (!score) return { icon: 'hourglass-outline', label: 'en attente', tone: colors.textMuted };
  if (score.a === score.b) return { icon: 'pulse', label: 'tout se joue', tone: colors.gold };
  const predA = (pred?.scoreA ?? 0) > (pred?.scoreB ?? 0);
  const leadA = score.a > score.b;
  return predA === leadA
    ? { icon: 'trending-up', label: 'en bonne voie', tone: colors.gold }
    : { icon: 'trending-down', label: 'ça sent le roussi', tone: colors.danger };
}

function Seg({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.seg, active && styles.segActive]}>
      <Text style={[styles.segTxt, active && styles.segTxtActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  // Filtre région / event — compact
  filterScroll: { flexGrow: 0 }, // sinon le ScrollView horizontal gonfle en hauteur
  filterRow: { paddingHorizontal: space(4), paddingTop: space(3), paddingBottom: space(1), gap: space(2) },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    paddingHorizontal: space(3),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { borderColor: colors.gold, backgroundColor: '#2A0E1C' },
  chipLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.danger, marginRight: space(1.5) },
  chipTxt: { ...font.small, color: colors.textMuted, fontWeight: '700', maxWidth: 160 },
  chipTxtActive: { color: colors.gold },

  // Zone "En direct" — traitement doré plus chaud, en haut (tension max).
  liveZone: { paddingTop: space(3) },
  liveHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space(2), paddingHorizontal: space(4) },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger, marginRight: space(2) },
  liveHeadTxt: { ...font.tag, color: colors.danger, fontWeight: '800', letterSpacing: 1 },
  liveCount: { ...font.tag, color: colors.goldDim, fontWeight: '700' },
  carousel: { paddingHorizontal: space(4) },

  liveCard: {
    backgroundColor: '#2A0E1C',
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radius.lg,
    padding: space(4),
  },
  liveCardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mapTag: { ...font.tag, color: colors.goldDim, fontWeight: '700', textTransform: 'uppercase' },

  liveRow: { flexDirection: 'row', alignItems: 'center', marginTop: space(3) },
  team: { flex: 1, alignItems: 'center' },
  teamLogo: { width: 36, height: 36, marginBottom: space(1) },
  teamLogoFallback: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space(1),
  },
  teamLogoTxt: { ...font.small, color: colors.textMuted, fontWeight: '700' },
  teamTag: { ...font.body, color: colors.text, fontWeight: '700' },
  liveScore: { ...font.score, color: colors.gold, paddingHorizontal: space(3) },
  liveDash: { color: colors.goldDim },
  liveScoreNone: { ...font.small, color: colors.danger, fontWeight: '800', paddingHorizontal: space(3) },

  liveFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space(3),
    paddingTop: space(3),
    borderTopWidth: 1,
    borderTopColor: colors.goldFaint,
  },
  liveAugure: { ...font.small, color: colors.textMuted },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  liveStatus: { ...font.small, fontWeight: '700', marginLeft: space(1) },

  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    marginHorizontal: space(4),
    marginTop: space(3),
  },
  seg: { flex: 1, paddingVertical: space(2), borderRadius: radius.pill, alignItems: 'center' },
  segActive: { backgroundColor: colors.cardElevated },
  segTxt: { ...font.small, color: colors.textMuted, fontWeight: '700' },
  segTxtActive: { color: colors.gold },

  body: { flex: 1 },
  // flex:1 (pas position:absolute) : sous la New Architecture (Fabric), empiler des
  // frères en position:absolute + display:none casse leur rendu (rien ne s'affiche).
  // En flux normal, la page display:none ne prend aucune place — pas d'empilement requis.
  page: { flex: 1 },
  hidden: { display: 'none' },
});
