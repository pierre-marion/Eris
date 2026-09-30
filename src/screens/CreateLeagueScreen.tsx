import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors, font, games, radius, space, type GameKey } from '../theme';
import { eventLabel, type EventScope } from '../scope';
import { createLeague, deriveCodePreview, type League } from '../lib/leagues';
import type { Competition } from '../lib/competitions';

type Preset = 'event' | 'season';

export function CreateLeagueScreen({
  game,
  event,
  competitions,
  onBack,
  onCreated,
}: {
  game: GameKey;
  event: EventScope;
  competitions: Competition[];
  onBack: () => void;
  onCreated: (league: League) => void;
}) {
  const [name, setName] = useState('');
  const [preset, setPreset] = useState<Preset>('event');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const gameLabel = games[game].label;

  // L'event de la fenêtre "Cet event" : header si précis, sinon en cours / à venir.
  const eventOption = useMemo<{ serieId: string; label: string } | null>(() => {
    if (event.type === 'event') return { serieId: event.serieId, label: event.label };
    const live = competitions.find((c) => c.status === 'live');
    const next = competitions.find((c) => c.status === 'upcoming');
    const c = live ?? next;
    return c ? { serieId: c.serieId, label: c.tournament } : null;
  }, [event, competitions]);

  const effectivePreset: Preset = eventOption ? preset : 'season';
  const codePreview = deriveCodePreview(name);

  const copy = async () => {
    await Clipboard.setStringAsync(codePreview).catch(() => {});
    setCopied(true);
  };

  const submit = async () => {
    if (!name.trim()) return setError('Donne un nom à ta ligue.');
    setBusy(true);
    setError(null);
    try {
      const useEvent = effectivePreset === 'event' && eventOption;
      const league = await createLeague(
        name.trim(),
        game,
        useEvent ? eventOption!.serieId : null,
        useEvent ? eventOption!.label : `${gameLabel} · saison`,
      );
      await Share.share({
        message: `Rejoins ma ligue « ${league.name} » sur ÉRIS — Code ${league.code} 🎯`,
      }).catch(() => {});
      onCreated(league);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Création impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.head}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.gold} />
        </Pressable>
        <Text style={styles.headTitle}>Ouvrir une ligue</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Nom */}
        <Text style={styles.label}>Nom de la ligue</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={(t) => {
            setName(t);
            setCopied(false);
          }}
          placeholder="Les Naagsko Boys"
          placeholderTextColor={colors.textFaint}
        />

        {/* Jeu & event hérités du scope */}
        <Text style={styles.label}>Jeu & événement</Text>
        <View style={styles.inherited}>
          <View style={[styles.dot, { backgroundColor: games[game].dot }]} />
          <Text style={styles.inheritedTxt}>
            {gameLabel} › {eventLabel(event, gameLabel)}
          </Text>
          <Text style={styles.inheritedNote}>depuis le sélecteur</Text>
        </View>
        <Text style={styles.note}>
          Pour une ligue sur un autre jeu, change le scope dans le header avant.
        </Text>

        {/* Fenêtre — presets */}
        <Text style={styles.label}>Fenêtre</Text>
        <PresetRow
          title="Cet event"
          subtitle={eventOption ? eventOption.label : 'aucun event en cours'}
          active={effectivePreset === 'event'}
          disabled={!eventOption}
          onPress={() => setPreset('event')}
        />
        <PresetRow
          title={`Toute la saison ${gameLabel}`}
          subtitle="le marathon · cumul de tous les events"
          active={effectivePreset === 'season'}
          onPress={() => setPreset('season')}
        />

        {/* Code dérivé */}
        <Text style={styles.label}>Code d'invitation</Text>
        <View style={styles.codeRow}>
          <Text style={styles.code}>{codePreview}</Text>
          <Pressable style={styles.copy} onPress={copy}>
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={colors.gold} />
            <Text style={styles.copyTxt}>{copied ? 'Copié' : 'Copier'}</Text>
          </Pressable>
        </View>
        <Text style={styles.note}>Dérivé du nom. Le Code final peut varier en cas de collision.</Text>

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable style={[styles.create, busy && styles.createDisabled]} onPress={submit} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Text style={styles.createTxt}>Créer et inviter mes potes</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PresetRow({
  title,
  subtitle,
  active,
  disabled,
  onPress,
}: {
  title: string;
  subtitle: string;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[styles.preset, active && styles.presetActive, disabled && { opacity: 0.4 }]}
    >
      <Ionicons
        name={active ? 'radio-button-on' : 'radio-button-off'}
        size={20}
        color={active ? colors.gold : colors.textFaint}
      />
      <View style={{ flex: 1, marginLeft: space(3) }}>
        <Text style={[styles.presetTitle, active && { color: colors.gold }]}>{title}</Text>
        <Text style={styles.presetSub} numberOfLines={1}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space(4),
    paddingVertical: space(3),
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSoft,
  },
  headTitle: { ...font.h2, color: colors.text, marginLeft: space(2) },

  content: { padding: space(4) },
  label: { ...font.tag, color: colors.textFaint, textTransform: 'uppercase', marginBottom: space(2), marginTop: space(4) },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space(4),
    paddingVertical: space(3.5),
    color: colors.text,
    ...font.body,
  },

  inherited: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space(4),
    paddingVertical: space(3),
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: space(2) },
  inheritedTxt: { ...font.body, color: colors.text, fontWeight: '700', flex: 1 },
  inheritedNote: { ...font.tag, color: colors.textFaint },
  note: { ...font.small, color: colors.textFaint, marginTop: space(2) },

  preset: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: space(3.5),
    marginBottom: space(2),
  },
  presetActive: { borderColor: colors.gold, backgroundColor: '#2A0E1C' },
  presetTitle: { ...font.body, color: colors.text, fontWeight: '700' },
  presetSub: { ...font.small, color: colors.textMuted, marginTop: 2 },

  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.goldFaint,
    borderRadius: radius.md,
    paddingHorizontal: space(4),
    paddingVertical: space(3),
  },
  code: { color: colors.gold, fontSize: 22, fontWeight: '800', letterSpacing: 3 },
  copy: { flexDirection: 'row', alignItems: 'center' },
  copyTxt: { ...font.small, color: colors.gold, fontWeight: '700', marginLeft: space(1) },

  error: { ...font.small, color: colors.danger, marginTop: space(3), textAlign: 'center' },

  create: {
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: space(4),
    alignItems: 'center',
    marginTop: space(6),
  },
  createDisabled: { opacity: 0.6 },
  createTxt: { ...font.h2, color: colors.bg, fontWeight: '800' },
});
