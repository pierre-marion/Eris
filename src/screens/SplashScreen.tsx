import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, games, radius, space, type GameKey } from '../theme';

const PILLS: GameKey[] = ['valorant', 'cs', 'lol', 'cod'];

/** Splash : concept en 2s + 2 CTA (s'inscrire / se connecter). Visiteur déconnecté. */
export function SplashScreen({
  onSignUp,
  onSignIn,
}: {
  onSignUp: () => void;
  onSignIn: () => void;
}) {
  return (
    <View style={styles.screen}>
      <View style={styles.center}>
        {/* Logo + marque */}
        <View style={styles.mark}>
          <Ionicons name="scan-outline" size={34} color={colors.gold} />
        </View>
        <Text style={styles.brand}>ÉRIS</Text>
        <Text style={styles.kicker}>ESPORT · FR</Text>

        {/* Accroche */}
        <Text style={styles.tagline}>
          Pronostique le VCT, le CS2 et la LFL.{'\n'}Défie tes potes.{'\n'}
          <Text style={styles.taglineGold}>Zéro argent, que de la fierté.</Text>
        </Text>

        {/* Pills jeux (Valo en avant) */}
        <View style={styles.pills}>
          {PILLS.map((g, i) => {
            const lead = i === 0;
            return (
              <View
                key={g}
                style={[
                  styles.pill,
                  lead ? { borderColor: games[g].dot, backgroundColor: `${games[g].dot}22` } : styles.pillOff,
                ]}
              >
                <View style={[styles.dot, { backgroundColor: games[g].dot }]} />
                <Text style={[styles.pillTxt, lead && { color: colors.text }]}>{games[g].label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* CTAs */}
      <View style={styles.actions}>
        <Pressable style={styles.primary} onPress={onSignUp}>
          <Text style={styles.primaryTxt}>S'inscrire</Text>
        </Pressable>
        <Pressable style={styles.secondary} onPress={onSignIn}>
          <Text style={styles.secondaryTxt}>J'ai déjà un compte</Text>
        </Pressable>

        {/* Garde-fou légal */}
        <View style={styles.legal}>
          <Ionicons name="lock-closed" size={11} color={colors.textFaint} />
          <Text style={styles.legalTxt}>100% gratuit · sans mise réelle · loi 1901</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: space(6) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  mark: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.goldFaint,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space(4),
  },
  brand: { ...font.brand, fontSize: 38, color: colors.gold },
  kicker: { ...font.tag, color: colors.textMuted, letterSpacing: 3, marginTop: space(1) },

  tagline: {
    ...font.body,
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    marginTop: space(8),
  },
  taglineGold: { color: colors.gold, fontWeight: '700' },

  pills: { flexDirection: 'row', marginTop: space(8) },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: space(3),
    paddingVertical: space(2),
    marginHorizontal: space(1),
  },
  pillOff: { borderColor: colors.border, opacity: 0.5 },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: space(2) },
  pillTxt: { ...font.small, color: colors.textMuted, fontWeight: '700' },

  actions: { gap: space(3) },
  primary: {
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: space(4),
    alignItems: 'center',
  },
  primaryTxt: { ...font.h2, color: colors.bg, fontWeight: '800' },
  secondary: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: space(4),
    alignItems: 'center',
  },
  secondaryTxt: { ...font.body, color: colors.text, fontWeight: '700' },

  legal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space(3),
  },
  legalTxt: { ...font.small, color: colors.textFaint, marginLeft: space(2) },
});
