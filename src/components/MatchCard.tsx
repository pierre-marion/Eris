import { forwardRef, useMemo, useRef } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, space } from '../theme';
import { LINES, pick } from '../copy';
import type { Match, Prediction, Team } from '../types';
import { derivedWinner, isValidSeries, mapsToWin, potentialPoints } from '../lib/scoring';
import { timeLabel } from '../lib/dates';
import { GamePill } from './GamePill';

interface Props {
  match: Match;
  pred?: Prediction;
  onChange: (patch: Partial<Prediction>) => void;
  onToggleBoost: () => void;
  /** Tap sur la card (hors cases score) → ouvre le détail. */
  onOpen?: () => void;
}

export function MatchCard({ match, pred, onChange, onToggleBoost, onOpen }: Props) {
  // Verrouillé : match non ouvert OU coup d'envoi passé (plus d'édition).
  const started = match.startsAt ? Date.parse(match.startsAt) <= Date.now() : false;
  const locked = match.status !== 'open' || started;
  const max = mapsToWin(match.format);
  const winner = derivedWinner(match, pred);
  const gain = potentialPoints(match, pred);
  const leadA = winner === match.teamA.id;
  const leadB = winner === match.teamB.id;

  const filled = pred?.scoreA != null && pred?.scoreB != null;
  const invalid = filled && !isValidSeries(match.format, pred?.scoreA, pred?.scoreB);

  const lockedMsg = useMemo(() => pick('lock' + match.id, LINES.locked), [match.id]);

  const boxBRef = useRef<TextInput>(null);

  return (
    <Pressable style={[styles.card, match.status === 'live' && styles.cardLive]} onPress={onOpen}>
      {/* En-tête : pastille jeu + tournoi | format · horaire */}
      <View style={styles.header}>
        <GamePill game={match.game} tournament={match.tournament} stage={match.stage} />
        <View style={styles.headerRight}>
          {match.status === 'live' && <Text style={styles.live}>● LIVE</Text>}
          {match.status === 'locked' && (
            <View style={styles.lockedRow}>
              <Ionicons name="lock-closed" size={10} color={colors.textFaint} />
              <Text style={styles.locked}> Verrouillé</Text>
            </View>
          )}
          <Text style={styles.meta}>
            {match.format}
            {timeLabel(match.startsAt) ? ` · ${timeLabel(match.startsAt)}` : ''}
          </Text>
        </View>
      </View>

      {/* Grille centrée — ligne 1 : logo | score – score | logo */}
      <View style={styles.row}>
        <View style={styles.logoCol}>
          <Logo team={match.teamA} />
        </View>
        <View style={styles.scoreCol}>
          <ScoreBox
            value={pred?.scoreA}
            onChange={(n) => onChange({ scoreA: n })}
            max={max}
            disabled={locked}
            lead={leadA}
            onFilled={() => boxBRef.current?.focus()}
          />
        </View>
        <View style={styles.dashCol}>
          <Text style={styles.dash}>–</Text>
        </View>
        <View style={styles.scoreCol}>
          <ScoreBox
            ref={boxBRef}
            value={pred?.scoreB}
            onChange={(n) => onChange({ scoreB: n })}
            max={max}
            disabled={locked}
            lead={leadB}
          />
        </View>
        <View style={styles.logoCol}>
          <Logo team={match.teamB} />
        </View>
      </View>

      {/* Ligne 2 : nom | pts | (vide) | pts | nom — aligné sous la ligne 1 */}
      <View style={styles.rowTight}>
        <View style={styles.logoCol}>
          <Text style={[styles.name, leadA && styles.lead]} numberOfLines={1}>
            {match.teamA.tag}
          </Text>
        </View>
        <View style={styles.scoreCol}>
          <Text style={[styles.pts, leadA && styles.lead]} numberOfLines={1}>
            +{match.oddsA}
          </Text>
        </View>
        <View style={styles.dashCol} />
        <View style={styles.scoreCol}>
          <Text style={[styles.pts, leadB && styles.lead]} numberOfLines={1}>
            +{match.oddsB}
          </Text>
        </View>
        <View style={styles.logoCol}>
          <Text style={[styles.name, leadB && styles.lead]} numberOfLines={1}>
            {match.teamB.tag}
          </Text>
        </View>
      </View>

      {invalid && (
        <Text style={styles.hint}>Score {match.format} impossible — le vainqueur fait {max} map{max > 1 ? 's' : ''}.</Text>
      )}

      {/* Pied : verrou malicieux, sinon Boost ×2 + gain potentiel. */}
      {locked ? (
        <View style={styles.lockedFooter}>
          <Ionicons name="lock-closed" size={12} color={colors.textFaint} />
          <Text style={styles.lockedMsg}>{lockedMsg}</Text>
        </View>
      ) : (
      <View style={styles.footer}>
        <Pressable
          onPress={onToggleBoost}
          disabled={locked || gain === 0}
          style={[
            styles.boost,
            pred?.boosted && styles.boostOn,
            (locked || gain === 0) && styles.boostDisabled,
          ]}
        >
          <Ionicons
            name="flash"
            size={13}
            color={pred?.boosted ? colors.bg : colors.gold}
            style={{ marginRight: 3 }}
          />
          <Text style={[styles.boostTxt, pred?.boosted && styles.boostTxtOn]}>×2</Text>
        </Pressable>

        <View style={styles.gainWrap}>
          <Text style={styles.gainLabel}>{pred?.boosted ? "Boost · gain min." : 'Gain minimum'}</Text>
          <Text style={styles.gainValue}>{gain > 0 ? `+${gain}` : '—'}</Text>
        </View>
      </View>
      )}
    </Pressable>
  );
}

function Logo({ team }: { team: Team }) {
  if (team.logo) {
    return <Image source={{ uri: team.logo }} style={styles.logo} resizeMode="contain" />;
  }
  return (
    <View style={styles.logoFallback}>
      <Text style={styles.logoFallbackTxt}>{team.tag.slice(0, 3)}</Text>
    </View>
  );
}

const ScoreBox = forwardRef<TextInput, {
  value?: number;
  onChange: (n: number | undefined) => void;
  max: number;
  disabled?: boolean;
  lead?: boolean;
  onFilled?: () => void;
}>(function ScoreBox({ value, onChange, max, disabled, lead, onFilled }, ref) {
  const filled = value != null;
  return (
    <TextInput
      ref={ref}
      style={[
        styles.box,
        !filled && !disabled && styles.boxEmpty,
        lead && styles.boxLead,
        disabled && styles.boxDisabled,
      ]}
      value={value == null ? '' : String(value)}
      onChangeText={(t) => {
        const digit = t.replace(/[^0-9]/g, '').slice(-1);
        if (digit === '') return onChange(undefined);
        onChange(Math.min(parseInt(digit, 10), max));
        onFilled?.(); // enchaîne sur l'autre case
      }}
      keyboardType="number-pad"
      maxLength={1}
      editable={!disabled}
      placeholder="–"
      placeholderTextColor={colors.textFaint}
      textAlign="center"
      selectTextOnFocus
    />
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space(4),
    marginBottom: space(3),
  },
  cardLive: { borderColor: colors.gold, borderWidth: 2, backgroundColor: colors.goldFaint },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerRight: { alignItems: 'flex-end' },
  meta: { ...font.small, color: colors.textFaint, marginTop: 2 },
  live: { ...font.tag, color: colors.danger },
  lockedRow: { flexDirection: 'row', alignItems: 'center' },
  locked: { ...font.tag, color: colors.textFaint },

  // Groupe logo+nom centré dans son espace (autant de marge bord↔logo que logo↔score),
  // groupe [score – score] fixe au centre.
  row: { flexDirection: 'row', alignItems: 'center', marginTop: space(5) },
  rowTight: { flexDirection: 'row', alignItems: 'flex-start', marginTop: space(2) },
  logoCol: { flex: 1, alignItems: 'center' },
  scoreCol: { width: 50, alignItems: 'center' },
  dashCol: { width: 40, alignItems: 'center', justifyContent: 'center' },
  dash: { ...font.score, color: colors.textFaint },

  logo: { width: 56, height: 56 },
  logoFallback: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoFallbackTxt: { ...font.h2, color: colors.textMuted },
  name: { ...font.h2, color: colors.text, textAlign: 'center' },
  pts: { ...font.small, color: colors.textFaint, fontWeight: '700' },
  lead: { color: colors.gold },

  box: {
    width: 50,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardElevated,
    color: colors.text,
    ...font.score,
  },
  boxEmpty: { borderStyle: 'dashed', borderColor: colors.textMuted },
  boxLead: { borderColor: colors.gold, color: colors.gold, backgroundColor: '#2A0E1C' },
  boxDisabled: { opacity: 0.55 },

  hint: { ...font.small, color: colors.danger, marginTop: space(3), textAlign: 'center' },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space(4),
    paddingTop: space(3),
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  boost: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    paddingHorizontal: space(2),
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.goldFaint,
    justifyContent: 'center',
  },
  boostOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  boostDisabled: { opacity: 0.4 },
  boostTxt: { ...font.tag, color: colors.goldDim, fontWeight: '800' },
  boostTxtOn: { color: colors.bg },

  lockedFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space(4),
    paddingTop: space(3),
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
  },
  lockedMsg: { ...font.small, color: colors.textFaint, fontStyle: 'italic', marginLeft: space(2) },

  gainWrap: { alignItems: 'flex-end' },
  gainLabel: { ...font.tag, color: colors.textFaint, textTransform: 'uppercase' },
  gainValue: { color: colors.gold, fontSize: 18, fontWeight: '800', marginTop: 1 },
});
