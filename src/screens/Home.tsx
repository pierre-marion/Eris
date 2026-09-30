import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { accentTint, colors, font, radius, space, type GameKey } from '../theme';
import { useAuth } from '../auth/AuthContext';
import { usePredictions } from '../hooks/usePredictions';
import { useCallCounts } from '../hooks/useCallCounts';
import { ScopeSelector } from '../components/ScopeSelector';
import { fetchTierSMatches, hasToken } from '../api/pandascore';
import { registerForNotifications } from '../lib/notifications';
import { ALL_SCOPE, type EventScope } from '../scope';
import { HomeScreen } from './HomeScreen';
import { PronosScreen } from './PronosScreen';
import { LeaguesScreen } from './LeaguesScreen';
import { ProfileScreen } from './ProfileScreen';

type Tab = 'accueil' | 'pronos' | 'ligues' | 'profil';
const TITLES: Record<Tab, string> = {
  accueil: 'Accueil',
  pronos: 'Pronos',
  ligues: 'Ligues',
  profil: 'Profil',
};

/** Coquille : header fixe (logo · titre de page · cloche / pastilles de jeu),
 *  pages au milieu, barre d'onglets en bas. Le header ne bouge pas entre les pages. */
export function Home() {
  const { session, profile, signOut, followGame } = useAuth();
  const userId = session?.user?.id ?? null;
  const followed = profile?.games ?? (['valorant', 'cs', 'lol', 'cod'] as GameKey[]);
  const predictions = usePredictions(userId); // état partagé Home ↔ Pronos
  const counts = useCallCounts(predictions.preds); // calls du jour par jeu
  const [tab, setTab] = useState<Tab>('accueil');
  const [game, setGame] = useState<GameKey>('valorant');
  const [event, setEvent] = useState<EventScope>(ALL_SCOPE);

  // Le scope a-t-il été figé (par l'auto-pick OU par un choix manuel) ?
  const scopeChosen = useRef(false);
  const chooseGame = (g: GameKey) => {
    scopeChosen.current = true;
    setGame(g);
  };

  // Demande la permission notifs une fois connecté (les rappels de prono en dépendent).
  useEffect(() => {
    registerForNotifications().catch((e) => console.warn('registerForNotifications:', e));
  }, []);

  // Au lancement : atterrir sur le jeu (suivi) qui a le prochain match. Une seule fois.
  const followedKey = followed.join(',');
  useEffect(() => {
    if (scopeChosen.current || !hasToken()) return;
    let alive = true;
    (async () => {
      try {
        const all = await fetchTierSMatches();
        if (!alive || scopeChosen.current) return;
        const soon = all
          .filter((m) => m.status === 'open' && m.startsAt && Date.parse(m.startsAt) > Date.now())
          .sort((a, b) => Date.parse(a.startsAt!) - Date.parse(b.startsAt!));
        const pick = soon.find((m) => followed.includes(m.game)) ?? soon[0];
        if (pick) {
          scopeChosen.current = true;
          setGame(pick.game);
        }
      } catch (e) {
        console.warn('Auto-pick jeu:', e);
        /* on reste sur le jeu par défaut */
      }
    })();
    return () => {
      alive = false;
    };
  }, [followedKey]);

  return (
    <View style={styles.root}>
      {/* HEADER — barre arrondie : jeu (gauche) · pastille calls + cloche (droite) */}
      <View style={styles.header}>
        {tab !== 'profil' ? (
          <ScopeSelector
            game={game}
            event={event}
            followed={followed}
            counts={counts}
            onFollowGame={followGame}
            onChange={(g, e) => {
              chooseGame(g);
              setEvent(e);
            }}
          />
        ) : (
          <Text style={styles.brand}>ÉRIS</Text>
        )}

        <View style={styles.right}>
          {tab !== 'profil' && (counts[game] ?? 0) > 0 && (
            <View style={styles.callsPill}>
              <Text style={styles.callsPillTxt}>
                {counts[game]} call{(counts[game] ?? 0) > 1 ? 's' : ''}
              </Text>
            </View>
          )}
          <Pressable
            onPress={() => Alert.alert('Notifications', 'Bientôt')}
            onLongPress={() =>
              Alert.alert('Déconnexion', 'Se déconnecter de ÉRIS ?', [
                { text: 'Annuler', style: 'cancel' },
                { text: 'Déconnexion', style: 'destructive', onPress: () => signOut() },
              ])
            }
            hitSlop={8}
            style={styles.bell}
          >
            <Ionicons name="notifications-outline" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      {/* PAGES — toutes restent montées (display:none sur les inactives) : leurs fetchs/
          intervals ne tournent qu'une fois par session, pas à chaque changement d'onglet.
          Empiler via position:absolute (comme avant) casse le rendu sous la New Architecture
          (Fabric) — ici chaque page est en flux normal (flex:1), donc pas d'empilement
          nécessaire : la seule visible (display:flex) remplit le parent, les autres
          (display:none) ne prennent aucune place. */}
      <View style={styles.content}>
        <View style={tab === 'accueil' ? styles.page : styles.hidden}>
          <HomeScreen
            game={game}
            event={event}
            predictions={predictions}
            onGoToPronos={() => setTab('pronos')}
            onGoToLeagues={() => setTab('ligues')}
          />
        </View>
        <View style={tab === 'pronos' ? styles.page : styles.hidden}>
          <PronosScreen game={game} predictions={predictions} />
        </View>
        <View style={tab === 'ligues' ? styles.page : styles.hidden}>
          <LeaguesScreen
            game={game}
            event={event}
            onSetGame={chooseGame}
            onSetScope={(g, e) => {
              chooseGame(g);
              setEvent(e);
            }}
          />
        </View>
        <View style={tab === 'profil' ? styles.page : styles.hidden}>
          <ProfileScreen />
        </View>
      </View>

      {/* ONGLETS BAS — la nav d'Éris (noir & or) */}
      <View style={styles.bar}>
        <TabBtn
          label="Accueil"
          active={tab === 'accueil'}
          onPress={() => setTab('accueil')}
          renderIcon={(c, on) => <Ionicons name={on ? 'home' : 'home-outline'} size={20} color={c} />}
        />
        <TabBtn
          label="Pronos"
          active={tab === 'pronos'}
          onPress={() => setTab('pronos')}
          renderIcon={(c, on) => (
            <Ionicons name={on ? 'game-controller' : 'game-controller-outline'} size={20} color={c} />
          )}
        />
        <TabBtn
          label="Ligues"
          active={tab === 'ligues'}
          onPress={() => setTab('ligues')}
          renderIcon={(c, on) => <Ionicons name={on ? 'trophy' : 'trophy-outline'} size={20} color={c} />}
        />
        <TabBtn
          label="Profil"
          active={tab === 'profil'}
          onPress={() => setTab('profil')}
          renderIcon={(c, on) => <Ionicons name={on ? 'person' : 'person-outline'} size={20} color={c} />}
        />
      </View>
    </View>
  );
}

function TabBtn({
  label,
  active,
  onPress,
  renderIcon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  renderIcon: (color: string, active: boolean) => React.ReactNode;
}) {
  const color = active ? colors.gold : colors.textFaint;
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      {renderIcon(color, active)}
      <Text style={[styles.tabTxt, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginHorizontal: space(4),
    marginTop: space(2),
    marginBottom: space(1),
    paddingLeft: space(4),
    paddingRight: space(2),
    paddingVertical: space(2),
  },
  brand: { fontFamily: 'Anton_400Regular', fontSize: 20, color: colors.gold, letterSpacing: 1 },
  right: { flexDirection: 'row', alignItems: 'center' },
  callsPill: {
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    paddingHorizontal: space(3),
    paddingVertical: space(1.5),
    marginRight: space(2),
  },
  callsPillTxt: { ...font.small, color: colors.bg, fontWeight: '800' },
  bell: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: { flex: 1 },
  page: { flex: 1 },
  hidden: { display: 'none' },

  bar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginHorizontal: space(4),
    marginBottom: space(2),
    marginTop: space(1),
    paddingVertical: space(2),
    paddingHorizontal: space(2),
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: space(2), marginHorizontal: space(1), borderRadius: radius.md },
  tabActive: { backgroundColor: accentTint },
  tabTxt: { ...font.tag, fontWeight: '700', marginTop: 3 },
});
