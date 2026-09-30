import { StyleSheet, Text, View } from 'react-native';
import { colors, font, games, space, type GameKey } from '../theme';

/**
 * Le SEUL endroit où la couleur-jeu apparaît : une pastille de 6px.
 * Assez pour trier l'œil, trop petit pour créer du bordel.
 */
export function GamePill({
  game,
  tournament,
  stage,
}: {
  game: GameKey;
  tournament: string;
  stage?: string | null;
}) {
  const showStage = stage && stage.toLowerCase() !== tournament.toLowerCase();
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: games[game].dot }]} />
      <Text style={styles.tournament} numberOfLines={1}>{tournament}</Text>
      {showStage && (
        <Text style={styles.stage} numberOfLines={1}> · {stage}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: space(2) },
  tournament: {
    ...font.tag,
    color: colors.textMuted,
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  stage: {
    ...font.tag,
    color: colors.gold,
    textTransform: 'uppercase',
  },
});
