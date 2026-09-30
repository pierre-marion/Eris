import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { accentTint, colors, font, games, radius, space, type GameKey } from '../theme';
import type { EventScope } from '../scope';
import { useAuth } from '../auth/AuthContext';
import {
  deleteLeague,
  dynastyCrowns,
  fetchDynasty,
  fetchLeagueActivity,
  fetchLeagueLeaderboard,
  fetchMyLeagues,
  leaveLeague,
  rematchLeague,
  type ActivityRow,
  type DynastyCrown,
  type DynastyEdition,
  type League,
  type LeaguePreview,
  type LeagueStanding,
} from '../lib/leagues';
import { fetchBestInScope, type ScopedBest } from '../lib/predictions';
import { COPY, LEX, LINES, pick } from '../copy';
import { fetchGlobalLeaderboard } from '../lib/leaderboard';
import { fetchCompetitions, type Competition } from '../lib/competitions';
import { GeneralRankingScreen } from './GeneralRankingScreen';
import { JoinLeagueScreen } from './JoinLeagueScreen';
import { CreateLeagueScreen } from './CreateLeagueScreen';

interface LeagueRow {
  league: League;
  rank: number | null;
  count: number;
}

export function LeaguesScreen({
  game,
  event,
  onSetGame,
  onSetScope,
}: {
  game: GameKey;
  event: EventScope;
  onSetGame: (g: GameKey) => void;
  onSetScope: (g: GameKey, e: EventScope) => void;
}) {
  const { session } = useAuth();
  const meId = session?.user?.id ?? null;
  const [rows, setRows] = useState<LeagueRow[]>([]);
  const [global, setGlobal] = useState<{ rank: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<League | null>(null);
  const [showGlobal, setShowGlobal] = useState(false);
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [rematch, setRematch] = useState<{ league: League; nextEvent: Competition; memberCount: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const mine = await fetchMyLeagues();
      const scoped = mine.filter(
        (l) =>
          (!l.game || l.game === game) &&
          (event.type !== 'event' || !l.serie_id || l.serie_id === event.serieId),
      );
      const leagueRows = await Promise.all(
        scoped.map(async (league) => {
          try {
            const board = await fetchLeagueLeaderboard(league.id); // rang sur SA fenêtre
            return {
              league,
              rank: board.find((r) => r.user_id === meId)?.rank ?? null,
              count: board.length,
            };
          } catch (e) {
            console.warn('fetchLeagueLeaderboard:', e);
            return { league, rank: null, count: 0 };
          }
        }),
      );
      setRows(leagueRows);

      const board = await fetchGlobalLeaderboard().catch((e) => {
        console.warn('fetchGlobalLeaderboard:', e);
        return [];
      });
      const me = board.find((r) => r.id === meId);
      setGlobal(me ? { rank: me.rank, total: board.length } : null);
    } finally {
      setLoading(false);
    }
  }, [game, event, meId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchCompetitions(game).then(setCompetitions).catch(() => setCompetitions([]));
  }, [game]);

  // Après avoir rejoint : bascule le scope sur le jeu de la ligue + ouvre son classement.
  const onJoined = (preview: LeaguePreview) => {
    setJoining(false);
    if (preview.game) onSetGame(preview.game as GameKey);
    setSelected({
      id: preview.id,
      name: preview.name,
      code: preview.code,
      owner_id: '',
      game: preview.game,
      serie_id: preview.serie_id,
      tournament: preview.tournament,
      created_at: '',
    });
    load();
  };

  const onCreated = (league: League) => {
    setCreating(false);
    if (league.game) onSetGame(league.game as GameKey);
    setSelected(league);
    load();
  };

  if (creating) {
    return (
      <CreateLeagueScreen
        game={game}
        event={event}
        competitions={competitions}
        onBack={() => setCreating(false)}
        onCreated={onCreated}
      />
    );
  }
  if (joining) {
    return (
      <JoinLeagueScreen
        onBack={() => setJoining(false)}
        onJoined={onJoined}
        onCreate={() => {
          setJoining(false);
          setCreating(true);
        }}
      />
    );
  }
  if (showGlobal) {
    return <GeneralRankingScreen initialGame={game} onBack={() => setShowGlobal(false)} />;
  }
  if (rematch) {
    const { league: rLeague, nextEvent: rEvent, memberCount } = rematch;
    return (
      <RematchConfirmScreen
        league={rLeague}
        nextEvent={rEvent}
        memberCount={memberCount}
        onBack={() => setRematch(null)}
        onDone={(l) => {
          setRematch(null);
          onSetScope(l.game as GameKey, { type: 'event', serieId: rEvent.serieId, label: rEvent.tournament });
          setSelected(l);
          load();
        }}
      />
    );
  }
  if (selected) {
    const status: 'live' | 'upcoming' | 'past' | 'season' = !selected.serie_id
      ? 'season'
      : competitions.find((c) => c.serieId === selected.serie_id)?.status ?? 'live';
    // Event de rematch : le prochain à venir, hors event courant.
    const nextEvent =
      competitions.find((c) => c.status === 'upcoming' && c.serieId !== selected.serie_id) ?? null;
    return (
      <LeagueDetail
        league={selected}
        meId={meId}
        status={status}
        nextEvent={nextEvent}
        competitions={competitions}
        onBack={() => setSelected(null)}
        onLeft={load}
        onAskRematch={(memberCount) => {
          if (nextEvent) setRematch({ league: selected, nextEvent, memberCount });
        }}
        onSeason={() => {
          setSelected(null);
          setShowGlobal(true);
        }}
      />
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Actions */}
      <View style={styles.actions}>
        <Pressable style={[styles.action, styles.actionFilled]} onPress={() => setJoining(true)}>
          <Ionicons name="enter-outline" size={18} color={colors.bg} />
          <Text style={styles.actionFilledTxt}>Rejoindre</Text>
        </Pressable>
        <Pressable style={[styles.action, styles.actionOutline]} onPress={() => setCreating(true)}>
          <Ionicons name="add" size={18} color={colors.gold} />
          <Text style={styles.actionOutlineTxt}>Créer</Text>
        </Pressable>
      </View>

      {/* Classement général (couche marathon) */}
      <Pressable style={styles.general} onPress={() => setShowGlobal(true)}>
        <View style={styles.globe}>
          <Ionicons name="earth" size={22} color={colors.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.generalTitle}>{LEX.olympe}</Text>
          <Text style={styles.generalSub}>{LEX.ere} {games[game].label} · toute la communauté</Text>
        </View>
        {global && <Text style={styles.generalRank}>{global.rank}ᵉ / {global.total}</Text>}
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </Pressable>

      {/* Mes ligues privés */}
      <Text style={styles.section}>Mes ligues</Text>
      {loading && rows.length === 0 ? (
        <ActivityIndicator color={colors.gold} style={{ marginTop: space(4) }} />
      ) : rows.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="people-outline" size={22} color={colors.textFaint} style={styles.emptyIcon} />
          <Text style={styles.empty}>Aucune ligue ici. Rejoins-en une avec un code, ou ouvre la tienne.</Text>
        </View>
      ) : (
        rows.map(({ league, rank, count }) => (
          <Pressable key={league.id} style={styles.league} onPress={() => setSelected(league)}>
            <View style={styles.leagueIcon}>
              <Ionicons name="people" size={18} color={colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.leagueName} numberOfLines={1}>{league.name}</Text>
              <Text style={styles.leagueSub} numberOfLines={1}>
                {league.tournament ?? `Tout ${games[game].label}`} · {count} joueur{count > 1 ? 's' : ''}
              </Text>
            </View>
            <Text style={styles.rank}>{rank ? `${rank}ᵉ` : '—'}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </Pressable>
        ))
      )}
    </ScrollView>
  );
}

const STATE_BANNER: Record<string, { label: string; color: string; icon: any }> = {
  live: { label: 'En cours', color: colors.success, icon: 'ellipse' },
  season: { label: 'Saison entière · en cours', color: colors.success, icon: 'ellipse' },
  upcoming: { label: 'Démarre bientôt', color: colors.textMuted, icon: 'lock-closed' },
  past: { label: 'Terminée · podium figé', color: colors.textFaint, icon: 'flag' },
};

function LeagueDetail({
  league,
  meId,
  status,
  nextEvent,
  competitions,
  onBack,
  onLeft,
  onAskRematch,
  onSeason,
}: {
  league: League;
  meId: string | null;
  status: 'live' | 'upcoming' | 'past' | 'season';
  nextEvent: Competition | null;
  competitions: Competition[];
  onBack: () => void;
  onLeft: () => void;
  onAskRematch: (memberCount: number) => void;
  onSeason: () => void;
}) {
  const [tab, setTab] = useState<'classement' | 'activite' | 'dynastie'>('classement');
  const [standings, setStandings] = useState<LeagueStanding[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [myBest, setMyBest] = useState<ScopedBest | null>(null);
  const [editions, setEditions] = useState<DynastyEdition[]>([]);
  const [loading, setLoading] = useState(true);
  const isOwner = league.owner_id === meId;
  const finished = status === 'past';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, a, dyn] = await Promise.all([
        fetchLeagueLeaderboard(league.id),
        fetchLeagueActivity(league.id).catch((e) => {
          console.warn('fetchLeagueActivity:', e);
          return [];
        }),
        fetchDynasty(league.id).catch((e) => {
          console.warn('fetchDynasty:', e);
          return [];
        }),
      ]);
      setStandings(s);
      setActivity(a);
      setEditions(dyn);
      if (finished && meId) {
        setMyBest(
          await fetchBestInScope(meId, league.game, league.serie_id).catch((e) => {
            console.warn('fetchBestInScope:', e);
            return null;
          }),
        );
      }
    } catch (e) {
      console.warn('Page ligue:', e);
    } finally {
      setLoading(false);
    }
  }, [league.id, league.game, league.serie_id, finished, meId]);

  // Une édition est terminée si elle a été supplantée (pas la dernière) ou si son event est passé.
  const latestId = editions.length ? editions[editions.length - 1].leagueId : null;
  const isFinishedEdition = (e: DynastyEdition) =>
    e.leagueId !== latestId ||
    competitions.find((c) => c.serieId === e.serieId)?.status === 'past';
  const crowns = dynastyCrowns(editions, isFinishedEdition);
  const isDynasty = editions.length > 1;

  useEffect(() => {
    load();
  }, [load]);

  const invite = () =>
    Share.share({ message: `Rejoins « ${league.name} » sur ÉRIS — Code ${league.code} 🎯` }).catch(() => {});

  const shareBoard = () => {
    const lines = standings.slice(0, 10).map((s) => `${s.rank}. ${s.username} — ${s.points} pts`).join('\n');
    Share.share({ message: `Classement « ${league.name} » sur ÉRIS\n\n${lines}` }).catch(() => {});
  };

  const manage = () => {
    if (isOwner) {
      Alert.alert(league.name, 'Gérer la ligue', [
        { text: 'Renommer / virer un membre (bientôt)', onPress: () => {} },
        {
          text: 'Supprimer la ligue',
          style: 'destructive',
          onPress: async () => {
            await deleteLeague(league.id);
            onLeft();
            onBack();
          },
        },
        { text: 'Annuler', style: 'cancel' },
      ]);
    } else {
      Alert.alert(league.name, undefined, [
        {
          text: 'Quitter la ligue',
          style: 'destructive',
          onPress: async () => {
            await leaveLeague(league.id);
            onLeft();
            onBack();
          },
        },
        { text: 'Annuler', style: 'cancel' },
      ]);
    }
  };

  const gameLabel = league.game ? games[league.game as GameKey]?.label ?? league.game : null;
  const banner = STATE_BANNER[status];

  return (
    <View style={styles.screen}>
      {/* En-tête de navigation */}
      <View style={styles.detailHead}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.gold} />
        </Pressable>
        <Text style={styles.detailTitle} numberOfLines={1}>{league.name}</Text>
        <Pressable onPress={manage} hitSlop={8}>
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Identité — masquée sur l'écran de fin (le hero prend le haut) */}
        {!finished && (
          <View style={styles.identity}>
            <View style={styles.leagueIconLg}>
              <Ionicons name="people" size={26} color={colors.gold} />
            </View>
            <Text style={styles.identityName}>{league.name}</Text>
            <Text style={styles.identityMeta}>
              {[gameLabel, league.tournament ?? 'Saison entière', `${standings.length} joueur${standings.length > 1 ? 's' : ''}`]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        )}

        {finished ? (
          <LeagueFinished
            league={league}
            standings={standings}
            meId={meId}
            myBest={myBest}
            nextEvent={nextEvent}
            isOwner={isOwner}
            loading={loading}
            editions={editions}
            crowns={crowns}
            onAskRematch={onAskRematch}
            onSeason={onSeason}
          />
        ) : (
        <>
        {/* Bannière d'état */}
        <View style={styles.banner}>
          <Ionicons name={banner.icon} size={12} color={banner.color} />
          <Text style={[styles.bannerTxt, { color: banner.color }]}>{banner.label}</Text>
          <Text style={styles.bannerCode}>{LEX.sceau} {league.code}</Text>
        </View>

        {/* Actions */}
        <View style={styles.detailActions}>
          <Pressable style={[styles.action, styles.actionFilled]} onPress={invite}>
            <Ionicons name="person-add-outline" size={18} color={colors.bg} />
            <Text style={styles.actionFilledTxt}>{LEX.convoquer}</Text>
          </Pressable>
          <Pressable style={[styles.action, styles.actionOutline]} onPress={shareBoard}>
            <Ionicons name="share-social-outline" size={18} color={colors.gold} />
            <Text style={styles.actionOutlineTxt}>Partager</Text>
          </Pressable>
        </View>

        {/* Onglets internes (Dynastie n'apparaît que pour une chaîne de revanches) */}
        <View style={styles.innerTabs}>
          <InnerTab label={LEX.pantheon} active={tab === 'classement'} onPress={() => setTab('classement')} />
          <InnerTab label={LEX.rumeur} active={tab === 'activite'} onPress={() => setTab('activite')} />
          {isDynasty && (
            <InnerTab label="Dynastie" active={tab === 'dynastie'} onPress={() => setTab('dynastie')} />
          )}
        </View>

        {loading ? (
          <ActivityIndicator color={colors.gold} style={{ marginTop: space(8) }} />
        ) : tab === 'dynastie' ? (
          <DynastyPanel editions={editions} crowns={crowns} meId={meId} isFinished={isFinishedEdition} />
        ) : tab === 'classement' ? (
          status === 'upcoming' ? (
            <Text style={styles.empty}>
              {standings.length} joueur{standings.length > 1 ? 's' : ''} ont rejoint. Ça démarre bientôt — invite tes potes !
            </Text>
          ) : standings.length === 0 ? (
            <Text style={styles.empty}>Aucun point pour l'instant.</Text>
          ) : (
            standings.map((s) => {
              const me = s.user_id === meId;
              return (
                <View key={s.user_id} style={[styles.standing, s.rank === 1 && styles.standingFirst, me && styles.standingMe]}>
                  <Text style={[styles.rankCol, s.rank <= 3 && styles.rankTop]}>{s.rank}</Text>
                  <Text style={[styles.sName, me && styles.sNameMe]} numberOfLines={1}>
                    {s.username}{me ? ' (toi)' : ''}
                  </Text>
                  <Text style={styles.sPoints}>{s.points.toLocaleString('fr-FR')}</Text>
                </View>
              );
            })
          )
        ) : activity.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="pulse-outline" size={22} color={colors.textFaint} style={styles.emptyIcon} />
            <Text style={styles.empty}>Pas encore d'activité. Les gros pronos des potes s'afficheront ici.</Text>
          </View>
        ) : (
          activity.map((a, i) => (
            <View key={i} style={styles.activity}>
              {a.boosted && <Ionicons name="flash" size={14} color={colors.gold} style={{ marginRight: space(2) }} />}
              <Text style={styles.activityTxt} numberOfLines={1}>
                <Text style={styles.activityName}>{a.username}</Text>
                {' '}
                <Text style={styles.activityPts}>+{a.points}</Text>
                {a.teamA ? ` · ${a.teamA} ${a.scoreA}–${a.scoreB} ${a.teamB}` : ''}
              </Text>
            </View>
          ))
        )}
        </>
        )}
      </ScrollView>
    </View>
  );
}

function LeagueFinished({
  league,
  standings,
  meId,
  myBest,
  nextEvent,
  isOwner,
  loading,
  editions,
  crowns,
  onAskRematch,
  onSeason,
}: {
  league: League;
  standings: LeagueStanding[];
  meId: string | null;
  myBest: ScopedBest | null;
  nextEvent: Competition | null;
  isOwner: boolean;
  loading: boolean;
  editions: DynastyEdition[];
  crowns: DynastyCrown[];
  onAskRematch: (memberCount: number) => void;
  onSeason: () => void;
}) {
  const [showSaga, setShowSaga] = useState(false);
  const top3 = standings.slice(0, 3);
  const me = standings.find((s) => s.user_id === meId) ?? null;
  const total = standings.length;
  const isChampion = !!me && me.rank === 1;
  const winner = standings[0] ?? null;
  const crushed = Math.max(0, total - 1);
  const heroVanne = useMemo(
    () => pick((isChampion ? 'champ' : 'lose') + league.id, isChampion ? LINES.champWin : LINES.loseHero),
    [isChampion, league.id],
  );
  const recap = buildRecap(league, top3, me, total);
  const sharePodium = () => Share.share({ message: recap }).catch(() => {});
  const canRematch = isOwner && !!nextEvent;

  if (loading) return <ActivityIndicator color={colors.gold} style={{ marginTop: space(8) }} />;

  return (
    <View>
      {isChampion ? (
        // ── LE SACRE ──────────────────────────────────────────────
        <View style={styles.champHero}>
          <Text style={styles.champKicker}>CHAMPION</Text>
          <Text style={styles.champTitle}>TU RÈGNES.</Text>
          <Text style={styles.champSub}>
            {me!.points.toLocaleString('fr-FR')} points · {crushed} joueur{crushed > 1 ? 's' : ''} écrasé
            {crushed > 1 ? 's' : ''}
          </Text>
          <Text style={styles.champVanne}>{heroVanne}</Text>
        </View>
      ) : (
        // ── LA SENTENCE ───────────────────────────────────────────
        <View style={styles.loseHero}>
          <Text style={styles.loseKicker}>TERMINÉ</Text>
          <Text style={styles.loseTitle}>{(winner?.username ?? '???').toUpperCase()} RÈGNE.</Text>
          {me && (
            <Text style={styles.loseLine}>
              Toi, {me.rank}
              <Text style={styles.loseLineSmall}>e</Text>. Sur {total}.
            </Text>
          )}
          <Text style={styles.loseVanne}>{heroVanne}</Text>
        </View>
      )}

      {/* Le reste — relégué */}
      {isChampion ? (
        <>
          <Text style={styles.finSection}>LES SURVIVANTS</Text>
          {standings.slice(1).map((s) => (
            <FinRow key={s.user_id} s={s} />
          ))}
        </>
      ) : (
        <>
          <Text style={styles.finSection}>LE PODIUM · SANS TOI</Text>
          {top3.map((s) => (
            <FinRow key={s.user_id} s={s} me={s.user_id === meId} />
          ))}
          {me && me.rank > 3 && <FinRow s={me} me highlight />}
        </>
      )}

      {/* Dynastie */}
      {editions.length > 1 && (
        <View style={styles.dynBand}>
          <Pressable style={styles.dynBandHead} onPress={() => setShowSaga((v) => !v)}>
            <Ionicons name="ribbon" size={16} color={colors.gold} />
            <Text style={styles.dynBandTxt}>{dynastySummary(crowns, editions.length)}</Text>
            <Text style={styles.dynBandLink}>{showSaga ? 'masquer' : 'voir la saga'}</Text>
          </Pressable>
          {showSaga && <DynastySaga editions={editions} meId={meId} />}
        </View>
      )}

      {/* CTA — jamais une fin, toujours un relanceur */}
      <View style={{ marginTop: space(5) }}>
        {isChampion ? (
          <Pressable style={[styles.action, styles.actionFilled, styles.rematch]} onPress={sharePodium}>
            <Ionicons name="megaphone" size={18} color={colors.bg} />
            <Text style={styles.actionFilledTxt}>Va leur rappeler</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.action, styles.actionFilled, styles.rematch]}
            onPress={canRematch ? () => onAskRematch(total) : sharePodium}
          >
            <Ionicons name="flame" size={18} color={colors.bg} />
            <Text style={styles.actionFilledTxt}>La revanche. Maintenant.</Text>
          </Pressable>
        )}

        {isChampion && canRematch && (
          <Pressable style={[styles.action, styles.actionOutline, styles.shareCta]} onPress={() => onAskRematch(total)}>
            <Ionicons name="refresh" size={18} color={colors.gold} />
            <Text style={styles.actionOutlineTxt} numberOfLines={1}>Rejouer sur {nextEvent!.tournament}</Text>
          </Pressable>
        )}
        {!isChampion && (
          <Pressable style={[styles.action, styles.actionOutline, styles.shareCta]} onPress={sharePodium}>
            <Ionicons name="share-social-outline" size={18} color={colors.gold} />
            <Text style={styles.actionOutlineTxt}>Partager</Text>
          </Pressable>
        )}

        <Pressable style={styles.seasonLink} onPress={onSeason} hitSlop={8}>
          <Text style={styles.seasonLinkTxt}>Le classement annuel continue →</Text>
        </Pressable>
      </View>
    </View>
  );
}

function FinRow({ s, me, highlight }: { s: LeagueStanding; me?: boolean; highlight?: boolean }) {
  return (
    <View style={[styles.finRow, highlight && styles.finRowMe]}>
      <Text style={[styles.finRank, me && { color: colors.gold }]}>{s.rank}</Text>
      <Text style={[styles.finName, me && { color: colors.gold }]} numberOfLines={1}>
        {s.username}{me ? ' (toi)' : ''}
      </Text>
      <Text style={styles.finPts}>{s.points.toLocaleString('fr-FR')}</Text>
    </View>
  );
}

function RematchConfirmScreen({
  league,
  nextEvent,
  memberCount,
  onBack,
  onDone,
}: {
  league: League;
  nextEvent: Competition;
  memberCount: number;
  onBack: () => void;
  onDone: (l: League) => void;
}) {
  const [busy, setBusy] = useState(false);
  const gameLabel = league.game ? games[league.game as GameKey]?.label ?? league.game : '';

  const launch = async () => {
    setBusy(true);
    try {
      const l = await rematchLeague(league.id, nextEvent.serieId, nextEvent.tournament);
      Share.share({ message: `Rejoins « ${l.name} » sur ÉRIS — Code ${l.code} 🎯` }).catch(() => {});
      onDone(l);
    } catch (e: any) {
      Alert.alert('Rematch impossible', e?.message ?? 'Réessaie.');
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.detailHead}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.gold} />
        </Pressable>
        <Text style={styles.detailTitle} numberOfLines={1}>Rejouer</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Bandeau d'intention */}
        <View style={styles.rmHero}>
          <Text style={styles.rmHeroTitle}>On repart pour {nextEvent.tournament}</Text>
          <Text style={styles.rmHeroSub}>
            Même équipe, nouveau départ — tout le monde repart à zéro.
          </Text>
        </View>

        {/* Les 3 reconductions */}
        <Recond
          icon="people"
          title={league.name}
          sub={`${memberCount} membre${memberCount > 1 ? 's' : ''} réinvité${memberCount > 1 ? 's' : ''} automatiquement`}
        />
        <Recond
          icon="calendar"
          title={nextEvent.tournament}
          sub="À venir · event entier"
        />
        {/* Bascule du sélecteur — bloc mis en avant (accent doré, sur la DA pierre) */}
        <View style={styles.rmScope}>
          <Ionicons name="swap-horizontal" size={18} color={colors.gold} />
          <Text style={styles.rmScopeTxt}>
            Ton sélecteur passe sur{' '}
            <Text style={styles.rmScopeStrong}>{gameLabel} › {nextEvent.tournament}</Text>
          </Text>
        </View>

        {/* Transition visualisée */}
        <View style={styles.rmTransition}>
          <Text style={styles.rmFrom} numberOfLines={1}>{league.tournament ?? 'Event précédent'}</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.textFaint} />
          <Text style={styles.rmTo} numberOfLines={1}>{nextEvent.tournament}</Text>
        </View>

        {/* CTA */}
        <Pressable
          style={[styles.action, styles.actionFilled, styles.rematch, { marginTop: space(4) }]}
          onPress={launch}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <>
              <Ionicons name="rocket-outline" size={18} color={colors.bg} />
              <Text style={styles.actionFilledTxt}>Lancer et inviter les potes</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Recond({ icon, title, sub }: { icon: any; title: string; sub: string }) {
  return (
    <View style={styles.recond}>
      <View style={styles.recondIcon}>
        <Ionicons name={icon} size={18} color={colors.gold} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.recondTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.recondSub} numberOfLines={1}>{sub}</Text>
      </View>
      <Ionicons name="checkmark-circle" size={20} color={colors.success} />
    </View>
  );
}

function Podium({ top3, meId }: { top3: LeagueStanding[]; meId: string | null }) {
  return (
    <View style={styles.podium}>
      <PodiumCol s={top3[1] ?? null} place={2} meId={meId} />
      <PodiumCol s={top3[0] ?? null} place={1} meId={meId} />
      <PodiumCol s={top3[2] ?? null} place={3} meId={meId} />
    </View>
  );
}

function PodiumCol({ s, place, meId }: { s: LeagueStanding | null; place: 1 | 2 | 3; meId: string | null }) {
  if (!s) return <View style={styles.podCol} />;
  const me = s.user_id === meId;
  const h = place === 1 ? 88 : place === 2 ? 62 : 46;
  const first = place === 1;
  return (
    <View style={styles.podCol}>
      {first && <Text style={styles.podCrown}>👑</Text>}
      <View style={[styles.podAvatar, first && styles.podAvatarFirst]}>
        <Text style={[styles.podAvatarTxt, first && { color: colors.gold }]}>
          {s.username.slice(0, 2).toUpperCase()}
        </Text>
      </View>
      <Text style={[styles.podName, me && { color: colors.gold }]} numberOfLines={1}>
        {s.username}{me ? ' (toi)' : ''}
      </Text>
      <Text style={styles.podPts}>{s.points.toLocaleString('fr-FR')}</Text>
      <View style={[styles.podBase, { height: h }, first && styles.podBaseFirst]}>
        <Text style={[styles.podPlace, first && { color: colors.gold }]}>{place}</Text>
      </View>
    </View>
  );
}

function buildRecap(
  league: League,
  top3: LeagueStanding[],
  me: LeagueStanding | null,
  total: number,
): string {
  const medal = ['🥇', '🥈', '🥉'];
  const board = top3.map((s, i) => `${medal[i]} ${s.username} · ${s.points}`).join('\n');
  const mine = me ? `\n\nMoi : ${me.rank}ᵉ/${total}${me.rank <= 3 ? ' 😤' : ''}` : '';
  return `🏆 ${league.name} — terminée\n${board}${mine}\n\nÉRIS 🎯`;
}

/** Panneau Dynastie (onglet) : couronnes cumulées + la saga des éditions. */
function DynastyPanel({
  editions,
  crowns,
  meId,
  isFinished,
}: {
  editions: DynastyEdition[];
  crowns: DynastyCrown[];
  meId: string | null;
  isFinished: (e: DynastyEdition) => boolean;
}) {
  return (
    <View>
      <Text style={styles.dynLead}>{dynastySummary(crowns, editions.length)}</Text>
      {crowns.map((c, i) => {
        const me = c.id === meId;
        return (
          <View key={c.id} style={[styles.dynCrownRow, me && styles.standingMe]}>
            <Text style={[styles.dynCrownName, me && styles.sNameMe]} numberOfLines={1}>
              {i + 1}. {c.username}{me ? ' (toi)' : ''}
            </Text>
            <View style={styles.dynCrownsWrap}>
              <Ionicons name="ribbon" size={14} color={colors.gold} />
              <Text style={styles.dynCrownCount}>×{c.crowns}</Text>
            </View>
          </View>
        );
      })}
      <Text style={styles.dynSagaTitle}>La saga</Text>
      <DynastySaga editions={editions} meId={meId} isFinished={isFinished} />
    </View>
  );
}

/** Liste chronologique des éditions + leur champion (« en cours » si pas terminée). */
function DynastySaga({
  editions,
  meId,
  isFinished,
}: {
  editions: DynastyEdition[];
  meId: string | null;
  isFinished?: (e: DynastyEdition) => boolean;
}) {
  return (
    <View style={styles.dynSaga}>
      {editions.map((e, i) => {
        const decided = isFinished ? isFinished(e) : true;
        const champ = decided && e.championId ? e.championUsername : null;
        const me = decided && e.championId === meId;
        return (
          <View key={e.leagueId} style={styles.dynEdition}>
            <Text style={styles.dynEditionNo}>{i + 1}</Text>
            <Text style={styles.dynEditionName} numberOfLines={1}>{e.tournament ?? 'Édition'}</Text>
            {champ ? (
              <View style={styles.dynEditionWin}>
                <Ionicons name="ribbon" size={12} color={colors.gold} />
                <Text style={[styles.dynEditionWinTxt, me && styles.sNameMe]} numberOfLines={1}>{champ}</Text>
              </View>
            ) : (
              <Text style={styles.dynEditionPending}>en cours</Text>
            )}
          </View>
        );
      })}
    </View>
  );
}

function dynastySummary(crowns: DynastyCrown[], total: number): string {
  if (crowns.length === 0) return `Dynastie · ${total} éditions`;
  if (crowns.length === 1) {
    const c = crowns[0];
    return `${c.username} intraitable : ${c.crowns} titre${c.crowns > 1 ? 's' : ''}`;
  }
  return `${crowns[0].username} mène ${crowns[0].crowns}–${crowns[1].crowns}`;
}

function InnerTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.innerTab, active && styles.innerTabActive]}>
      <Text style={[styles.innerTabTxt, active && styles.innerTabTxtActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space(4), paddingBottom: space(10) },

  actions: { flexDirection: 'row', marginBottom: space(3) },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    paddingVertical: space(3.5),
    marginRight: space(2),
  },
  actionFilled: { backgroundColor: colors.gold },
  actionFilledTxt: { ...font.body, color: colors.bg, fontWeight: '800', marginLeft: space(2) },
  actionOutline: { borderWidth: 1, borderColor: colors.gold, marginRight: 0 },
  actionOutlineTxt: { ...font.body, color: colors.gold, fontWeight: '700', marginLeft: space(2) },

  detailTitle: { ...font.h2, color: colors.text, flex: 1, textAlign: 'center', marginHorizontal: space(2) },
  identity: { alignItems: 'center', marginBottom: space(4) },
  leagueIconLg: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: '#2A0E1C',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space(2),
  },
  identityName: { ...font.h1, color: colors.text },
  identityMeta: { ...font.small, color: colors.textMuted, marginTop: 2 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space(3),
    paddingVertical: space(2.5),
    marginBottom: space(3),
  },
  bannerTxt: { ...font.small, fontWeight: '700', marginLeft: space(2), flex: 1 },
  bannerCode: { ...font.tag, color: colors.textFaint },
  detailActions: { flexDirection: 'row', marginBottom: space(4) },
  innerTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.borderSoft, marginBottom: space(4) },
  innerTab: { flex: 1, alignItems: 'center', paddingVertical: space(3) },
  innerTabActive: { borderBottomWidth: 2, borderBottomColor: colors.gold },
  innerTabTxt: { ...font.body, color: colors.textMuted, fontWeight: '700' },
  innerTabTxtActive: { color: colors.gold },
  activity: {
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
  activityTxt: { ...font.small, color: colors.textMuted, flex: 1 },
  activityName: { color: colors.text, fontWeight: '700' },
  activityPts: { color: colors.gold, fontWeight: '800' },

  form: { marginBottom: space(4) },
  formRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space(4),
    paddingVertical: space(3),
    color: colors.text,
    ...font.body,
    marginRight: space(2),
  },
  submit: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { ...font.small, color: colors.danger, marginTop: space(2) },
  chips: { paddingBottom: space(3) },
  chip: {
    paddingHorizontal: space(3),
    paddingVertical: space(2),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    marginRight: space(2),
    maxWidth: 200,
  },
  chipActive: { borderColor: colors.gold, backgroundColor: '#2A0E1C' },
  chipTxt: { ...font.small, color: colors.textMuted, fontWeight: '600' },
  chipTxtActive: { color: colors.gold },

  general: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.goldFaint,
    padding: space(3),
    marginBottom: space(5),
  },
  globe: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: '#2A0E1C',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space(3),
  },
  generalTitle: { ...font.section, color: colors.text },
  generalSub: { ...font.small, color: colors.textMuted, marginTop: 2 },
  generalRank: { ...font.body, color: colors.gold, fontWeight: '800', marginRight: space(2) },

  section: { ...font.tag, color: colors.textFaint, textTransform: 'uppercase', marginBottom: space(3) },
  empty: { ...font.small, color: colors.textMuted, marginTop: space(2) },
  emptyWrap: { alignItems: 'center', marginTop: space(4) },
  emptyIcon: { marginBottom: space(1) },

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
  leagueIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: '#2A0E1C',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space(3),
  },
  leagueName: { ...font.h2, color: colors.text },
  leagueSub: { ...font.small, color: colors.textMuted, marginTop: 2 },
  rank: { ...font.h2, color: colors.gold, fontWeight: '800', marginRight: space(2) },

  detailHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space(4),
    paddingVertical: space(3),
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  leave: { ...font.small, color: colors.danger, fontWeight: '700' },

  standing: {
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
  standingFirst: { borderColor: colors.gold, backgroundColor: '#2A0E1C' },
  standingMe: { borderColor: colors.goldFaint, backgroundColor: '#1A0D14' },

  // Fin de ligue — LE SACRE (champion)
  champHero: {
    backgroundColor: colors.gold,
    borderRadius: radius.lg,
    padding: space(5),
    marginBottom: space(5),
  },
  champKicker: { ...font.tag, color: colors.bg, letterSpacing: 2, opacity: 0.8 },
  champTitle: { fontFamily: 'Anton_400Regular', fontSize: 46, color: colors.bg, lineHeight: 54, marginTop: space(1) },
  champSub: { fontFamily: 'Inter_800ExtraBold', fontSize: 15, color: colors.bg, marginTop: space(2) },
  champVanne: { ...font.small, color: 'rgba(10,10,10,0.72)', fontWeight: '600', marginTop: space(3) },

  // Fin de ligue — LA SENTENCE (perdant)
  loseHero: { marginBottom: space(5), marginTop: space(2) },
  loseKicker: { ...font.tag, color: colors.textFaint, letterSpacing: 2 },
  loseTitle: { fontFamily: 'Anton_400Regular', fontSize: 42, color: colors.text, lineHeight: 48, marginTop: space(1) },
  loseLine: { fontFamily: 'Inter_800ExtraBold', fontSize: 22, color: colors.gold, marginTop: space(3) },
  loseLineSmall: { fontSize: 14 },
  loseVanne: { ...font.small, color: colors.textMuted, marginTop: space(2) },

  // Fin de ligue — le reste relégué
  finSection: { ...font.tag, color: colors.textFaint, letterSpacing: 1.5, marginTop: space(2), marginBottom: space(1) },
  finRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space(2.5),
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  finRowMe: {
    backgroundColor: accentTint,
    borderColor: colors.gold,
    borderWidth: 1,
    borderBottomColor: colors.gold,
    borderRadius: radius.md,
    paddingHorizontal: space(3),
    marginTop: space(2),
  },
  finRank: { ...font.h2, color: colors.textMuted, width: 32 },
  finName: { ...font.body, color: colors.text, flex: 1, fontWeight: '700' },
  finPts: { ...font.body, color: colors.gold, fontWeight: '800' },

  // Fin de ligue — célébration (legacy, plus utilisé)
  celebrate: { alignItems: 'center', marginBottom: space(4) },
  crown: { fontSize: 34 },
  celebrateTxt: { ...font.h2, color: colors.text, marginTop: space(1) },
  celebrateSub: { ...font.small, color: colors.textMuted, marginTop: 2, textAlign: 'center' },

  // Podium
  podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', marginBottom: space(6) },
  podCol: { flex: 1, alignItems: 'center' },
  podCrown: { fontSize: 18, marginBottom: 2 },
  podAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space(1),
  },
  podAvatarFirst: { width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderColor: colors.gold },
  podAvatarTxt: { ...font.body, color: colors.text, fontWeight: '800' },
  podName: { ...font.small, color: colors.text, fontWeight: '700', maxWidth: '92%' },
  podPts: { ...font.tag, color: colors.gold, fontWeight: '800', marginBottom: space(2) },
  podBase: {
    width: '88%',
    borderTopLeftRadius: radius.sm,
    borderTopRightRadius: radius.sm,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomWidth: 0,
    alignItems: 'center',
    paddingTop: space(2),
  },
  podBaseFirst: { backgroundColor: '#2A0E1C', borderColor: colors.gold },
  podPlace: { ...font.h1, color: colors.textMuted, fontWeight: '800' },

  // Mon bilan
  bilan: {
    backgroundColor: '#1A0D14',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    padding: space(4),
    marginBottom: space(3),
  },
  bilanTag: { ...font.tag, color: colors.gold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: space(1) },
  bilanRank: { ...font.h2, color: colors.text },
  bilanRankStrong: { color: colors.gold, fontWeight: '800' },
  bilanChambre: { ...font.small, color: colors.gold, fontWeight: '800', marginTop: space(1) },
  bilanBest: { ...font.small, color: colors.textMuted, marginTop: space(2) },
  bilanPts: { color: colors.gold, fontWeight: '800' },

  // Récap partageable
  recapBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space(4),
    marginBottom: space(4),
  },
  recapTxt: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // Dynastie — bande (fin de ligue) + panneau (onglet)
  dynBand: {
    backgroundColor: '#1A0D14',
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    borderRadius: radius.md,
    paddingHorizontal: space(4),
    paddingVertical: space(3),
    marginBottom: space(3),
  },
  dynBandHead: { flexDirection: 'row', alignItems: 'center' },
  dynBandTxt: { ...font.small, color: colors.text, fontWeight: '700', flex: 1, marginLeft: space(2) },
  dynBandLink: { ...font.tag, color: colors.gold, fontWeight: '700' },

  dynLead: { ...font.h2, color: colors.gold, marginBottom: space(3) },
  dynCrownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: space(3),
    paddingHorizontal: space(4),
    marginBottom: space(2),
  },
  dynCrownName: { ...font.body, color: colors.text, flex: 1, fontWeight: '600' },
  dynCrownsWrap: { flexDirection: 'row', alignItems: 'center' },
  dynCrownCount: { ...font.body, color: colors.gold, fontWeight: '800', marginLeft: space(1) },

  dynSagaTitle: { ...font.tag, color: colors.textFaint, textTransform: 'uppercase', marginTop: space(4), marginBottom: space(2) },
  dynSaga: { marginTop: space(1) },
  dynEdition: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space(2.5),
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  dynEditionNo: { ...font.small, color: colors.textFaint, width: 20, fontWeight: '800' },
  dynEditionName: { ...font.small, color: colors.text, flex: 1, fontWeight: '600' },
  dynEditionWin: { flexDirection: 'row', alignItems: 'center', maxWidth: '45%' },
  dynEditionWinTxt: { ...font.small, color: colors.gold, fontWeight: '700', marginLeft: space(1) },
  dynEditionPending: { ...font.small, color: colors.textFaint, fontStyle: 'italic' },

  rematch: { marginRight: 0 },
  rematchNote: {
    ...font.small,
    color: colors.textMuted,
    textAlign: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space(4),
  },
  shareCta: { marginTop: space(2), marginRight: 0 },
  seasonLink: { alignItems: 'center', paddingVertical: space(4) },
  seasonLinkTxt: { ...font.small, color: colors.textFaint, fontWeight: '600' },

  // Écran de confirmation du rematch
  rmHero: { marginBottom: space(5) },
  rmHeroTitle: { ...font.h1, color: colors.text },
  rmHeroSub: { ...font.small, color: colors.textMuted, marginTop: space(1) },
  recond: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space(3),
    marginBottom: space(2),
  },
  recondIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: '#2A0E1C',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space(3),
  },
  recondTitle: { ...font.body, color: colors.text, fontWeight: '700' },
  recondSub: { ...font.small, color: colors.textMuted, marginTop: 2 },
  rmScope: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A0D14',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
    padding: space(4),
    marginTop: space(2),
    marginBottom: space(4),
  },
  rmScopeTxt: { ...font.small, color: colors.textMuted, flex: 1, marginLeft: space(3) },
  rmScopeStrong: { color: colors.gold, fontWeight: '800' },
  rmTransition: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rmFrom: {
    ...font.small,
    color: colors.textFaint,
    textDecorationLine: 'line-through',
    marginRight: space(2),
    maxWidth: '40%',
  },
  rmTo: { ...font.small, color: colors.gold, fontWeight: '800', marginLeft: space(2), maxWidth: '40%' },
  rankCol: { ...font.h2, color: colors.textMuted, width: 36 },
  rankTop: { color: colors.gold },
  sName: { ...font.body, color: colors.text, flex: 1, fontWeight: '600' },
  sNameMe: { color: colors.gold },
  sPoints: { ...font.body, color: colors.gold, fontWeight: '800' },
});
