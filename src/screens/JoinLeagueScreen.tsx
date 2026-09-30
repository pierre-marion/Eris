import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { colors, font, games, radius, space, type GameKey } from '../theme';
import { joinLeague, previewLeague, type LeaguePreview } from '../lib/leagues';

const CODE_RE = /^[A-HJKMNP-Z2-9]{6,8}$/;
const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

export function JoinLeagueScreen({
  onBack,
  onJoined,
  onCreate,
}: {
  onBack: () => void;
  onJoined: (preview: LeaguePreview) => void;
  onCreate: () => void;
}) {
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<LeaguePreview | null>(null);
  const [status, setStatus] = useState<'idle' | 'searching' | 'found' | 'notfound'>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Détecte un code dans le presse-papier à l'ouverture.
  useEffect(() => {
    Clipboard.getStringAsync()
      .then((txt) => {
        const c = clean(txt);
        if (CODE_RE.test(c)) setCode(c);
      })
      .catch(() => {});
  }, []);

  // Lookup live (debounce) dès que le code est plausible.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    setPreview(null);
    setError(null);
    if (code.length < 6) return setStatus('idle');
    setStatus('searching');
    timer.current = setTimeout(async () => {
      try {
        const p = await previewLeague(code);
        if (p) {
          setPreview(p);
          setStatus('found');
        } else {
          setStatus('notfound');
        }
      } catch (e) {
        console.warn('previewLeague:', e);
        setStatus('notfound');
        setError(e instanceof Error ? e.message : 'Recherche impossible.');
      }
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [code]);

  const paste = async () => {
    const txt = await Clipboard.getStringAsync().catch(() => '');
    setCode(clean(txt));
  };

  const join = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);
    try {
      await joinLeague(code);
      onJoined(preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de rejoindre.');
    } finally {
      setBusy(false);
    }
  };

  const gameLabel = preview?.game ? games[preview.game as GameKey]?.label ?? preview.game : null;

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.head}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={colors.gold} />
        </Pressable>
        <Text style={styles.headTitle}>Entrer dans une ligue</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Code d'invitation</Text>
        <View style={styles.row}>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={(t) => setCode(clean(t))}
            placeholder="M8FANS00"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
          />
          <Pressable style={styles.paste} onPress={paste}>
            <Ionicons name="clipboard-outline" size={18} color={colors.gold} />
            <Text style={styles.pasteTxt}>Coller</Text>
          </Pressable>
        </View>

        {/* Feedback live */}
        {status === 'searching' && <Text style={styles.searching}>Recherche…</Text>}
        {status === 'notfound' && <Text style={styles.notfound}>Code introuvable</Text>}
        {status === 'found' && (
          <Text style={styles.found}>
            <Ionicons name="checkmark-circle" size={13} color={colors.success} /> ligue trouvé
          </Text>
        )}

        {/* Aperçu de la ligue */}
        {preview && (
          <View style={styles.preview}>
            <View style={styles.previewIcon}>
              <Ionicons name="people" size={22} color={colors.gold} />
            </View>
            <Text style={styles.previewName}>{preview.name}</Text>
            {preview.ownerUsername && (
              <Text style={styles.previewOwner}>créée par {preview.ownerUsername}</Text>
            )}
            <View style={styles.metaRow}>
              <Meta icon="people-outline" label={`${preview.memberCount} joueur${preview.memberCount > 1 ? 's' : ''}`} />
              {gameLabel && <Meta icon="game-controller-outline" label={gameLabel} />}
              <Meta icon="trophy-outline" label={preview.tournament ?? 'Saison entière'} />
            </View>
          </View>
        )}

        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.join, (!preview || busy) && styles.joinDisabled]}
          onPress={join}
          disabled={!preview || busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Text style={styles.joinTxt}>
              {preview ? `Rejoindre ${preview.name}` : 'Rejoindre'}
            </Text>
          )}
        </Pressable>

        <Pressable onPress={onCreate} style={styles.createLink}>
          <Text style={styles.createLinkTxt}>Pas de Code ? Ouvre ton propre ligue</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Meta({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={styles.meta}>
      <Ionicons name={icon} size={14} color={colors.textMuted} />
      <Text style={styles.metaTxt} numberOfLines={1}>{label}</Text>
    </View>
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
  label: { ...font.tag, color: colors.textFaint, textTransform: 'uppercase', marginBottom: space(2) },
  row: { flexDirection: 'row', alignItems: 'center' },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space(4),
    paddingVertical: space(4),
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 4,
    marginRight: space(2),
  },
  paste: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space(3),
    paddingVertical: space(3),
    borderWidth: 1,
    borderColor: colors.goldFaint,
    borderRadius: radius.md,
  },
  pasteTxt: { ...font.tag, color: colors.gold, marginTop: 2 },

  searching: { ...font.small, color: colors.textMuted, marginTop: space(3) },
  notfound: { ...font.small, color: colors.danger, marginTop: space(3), fontWeight: '700' },
  found: { ...font.small, color: colors.success, marginTop: space(3), fontWeight: '700' },

  preview: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.goldFaint,
    borderRadius: radius.lg,
    padding: space(4),
    marginTop: space(4),
    alignItems: 'center',
  },
  previewIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: '#2A0E1C',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space(3),
  },
  previewName: { ...font.h1, color: colors.text },
  previewOwner: { ...font.small, color: colors.textMuted, marginTop: 2 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: space(3) },
  meta: { flexDirection: 'row', alignItems: 'center', marginHorizontal: space(2), marginVertical: space(1) },
  metaTxt: { ...font.small, color: colors.textMuted, marginLeft: space(1) },

  error: { ...font.small, color: colors.danger, marginTop: space(3), textAlign: 'center' },

  join: {
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: space(4),
    alignItems: 'center',
    marginTop: space(5),
  },
  joinDisabled: { opacity: 0.4 },
  joinTxt: { ...font.h2, color: colors.bg, fontWeight: '800' },

  createLink: { alignItems: 'center', marginTop: space(4) },
  createLinkTxt: { ...font.small, color: colors.textMuted, fontWeight: '600' },
});
