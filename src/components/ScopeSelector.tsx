import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, games, radius, space, type GameKey } from '../theme';
import { ALL_SCOPE, type EventScope } from '../scope';

const GAMES: GameKey[] = ['valorant', 'lol', 'cs', 'cod'];

/** Sélecteur de scope — JEU uniquement, en liste (compte de calls du jour + chambrage). */
export function ScopeSelector({
  game,
  followed,
  counts,
  onFollowGame,
  onChange,
}: {
  game: GameKey;
  event: EventScope; // compat d'appel (non affiché)
  followed: GameKey[];
  counts: Partial<Record<GameKey, number>>;
  onFollowGame: (game: GameKey) => void;
  onChange: (game: GameKey, event: EventScope) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const pick = (g: GameKey, isFollowed: boolean) => {
    if (!isFollowed) onFollowGame(g);
    onChange(g, ALL_SCOPE);
    setOpen(false);
    setShowAdd(false);
  };

  const followedGames = GAMES.filter((g) => followed.includes(g));
  const unfollowed = GAMES.filter((g) => !followed.includes(g));

  return (
    <>
      <Pressable style={styles.trigger} onPress={() => setOpen(true)} hitSlop={6}>
        <View style={[styles.dot, { backgroundColor: games[game].dot }]} />
        <Text style={styles.triggerGame}>{games[game].label}</Text>
        <Ionicons name="chevron-down" size={14} color={colors.gold} style={{ marginLeft: 4 }} />
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={styles.sheet}>
          <Text style={styles.section}>TES JEUX</Text>
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
            {followedGames.map((g) => (
              <GameRow
                key={g}
                g={g}
                active={g === game}
                count={counts[g] ?? 0}
                onPress={() => pick(g, true)}
              />
            ))}

            {unfollowed.length > 0 && (
              <>
                {!showAdd ? (
                  <Pressable style={styles.addBtn} onPress={() => setShowAdd(true)}>
                    <Ionicons name="add" size={18} color={colors.gold} />
                    <Text style={styles.addBtnTxt}>Ajouter un jeu</Text>
                  </Pressable>
                ) : (
                  unfollowed.map((g) => (
                    <GameRow key={g} g={g} active={false} count={counts[g] ?? 0} add onPress={() => pick(g, false)} />
                  ))
                )}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function GameRow({
  g,
  active,
  count,
  add,
  onPress,
}: {
  g: GameKey;
  active: boolean;
  count: number;
  add?: boolean;
  onPress: () => void;
}) {
  const muted = !add && count === 0;
  return (
    <Pressable
      style={[styles.row, active && styles.rowActive, muted && styles.rowMuted]}
      onPress={onPress}
    >
      <View style={[styles.avatar, { borderColor: games[g].dot }, active && styles.avatarActive]}>
        <Text style={[styles.avatarTxt, { color: games[g].dot }]}>{games[g].short}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.name, active && styles.nameActive]}>{games[g].label}</Text>
        <Text style={[styles.sub, active && styles.subActive]}>
          {add ? 'appuie pour ajouter' : subtitle(count)}
        </Text>
      </View>
      {add && <Ionicons name="add" size={20} color={colors.gold} />}
    </Pressable>
  );
}

/** Le compteur chambre selon l'urgence. */
function subtitle(count: number): string {
  if (count === 0) return "rien pour l'instant";
  if (count === 1) return '1 match · dernière chance';
  if (count === 2) return '2 matchs · bouge';
  if (count <= 4) return `${count} matchs t'attendent`;
  return `${count} matchs · tu fous quoi`;
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: space(2) },
  triggerGame: { ...font.h2, color: colors.text },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space(5),
    paddingBottom: space(8),
  },
  section: { ...font.tag, color: colors.textMuted, letterSpacing: 1.5, marginBottom: space(3) },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingVertical: space(3),
    paddingHorizontal: space(3),
    marginBottom: space(2),
  },
  rowActive: { backgroundColor: colors.gold },
  rowMuted: { opacity: 0.5 },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space(3),
  },
  avatarActive: { backgroundColor: colors.bg, borderColor: colors.bg },
  avatarTxt: { ...font.tag, fontWeight: '800' },

  name: { ...font.h2, color: colors.text },
  nameActive: { color: colors.bg },
  sub: { ...font.small, color: colors.textMuted, marginTop: 1 },
  subActive: { color: 'rgba(10,10,10,0.72)', fontWeight: '700' },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space(3),
    marginTop: space(1),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  addBtnTxt: { ...font.body, color: colors.gold, fontWeight: '700', marginLeft: space(1) },
});
