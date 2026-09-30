import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space } from '../theme';

/** Compteur de points doré — signature de marque (pas une monnaie). */
export function PointsCounter({ points }: { points: number }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.value}>{points.toLocaleString('fr-FR')}</Text>
      <Text style={styles.label}>PTS</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    borderWidth: 1,
    borderColor: colors.goldFaint,
    backgroundColor: colors.card,
    paddingHorizontal: space(3),
    paddingVertical: space(1.5),
    borderRadius: radius.pill,
  },
  value: { color: colors.gold, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  label: { color: colors.goldDim, ...font.tag, marginLeft: space(1) },
});
