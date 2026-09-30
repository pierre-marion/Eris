import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, games, radius, space, type GameKey } from '../theme';

/** Ordre d'affichage : Valorant · LoL · CS. */
export const GAME_ORDER: GameKey[] = ['valorant', 'lol', 'cs', 'cod'];

/**
 * Sélecteur de jeu = les 3 "logos" côte à côte.
 * Le jeu sélectionné est en couleur (net) ; les autres sont grisés (éteints).
 *
 * NB : faute des vrais fichiers de logos (marques), on dessine des pastilles
 * aux couleurs des jeux. Remplaçables par de vraies images si fournies.
 */
export function GameSwitcher({
  game,
  onChange,
}: {
  game: GameKey;
  onChange: (g: GameKey) => void;
}) {
  return (
    <View style={styles.row}>
      {GAME_ORDER.map((g) => {
        const active = g === game;
        const color = games[g].dot;
        return (
          <Pressable key={g} onPress={() => onChange(g)} hitSlop={6}>
            <View
              style={[
                styles.tile,
                active
                  ? { borderColor: color, backgroundColor: `${color}22` }
                  : styles.tileOff,
              ]}
            >
              <Text style={[styles.code, active ? { color } : styles.codeOff]}>
                {games[g].short}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  tile: {
    minWidth: 44,
    height: 36,
    paddingHorizontal: space(2),
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: space(2),
  },
  // Inactif : grisé / éteint.
  tileOff: { borderColor: colors.border, backgroundColor: 'transparent', opacity: 0.55 },
  code: { ...font.tag, fontWeight: '800', letterSpacing: 0.5 },
  codeOff: { color: colors.textFaint },
});
