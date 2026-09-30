import { useState } from 'react';
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
import { colors, font, radius, space } from '../theme';
import { useAuth, type OAuthProvider } from '../auth/AuthContext';

const OAUTH: { provider: OAuthProvider; label: string; dot: string }[] = [
  { provider: 'discord', label: 'Discord', dot: '#5865F2' },
  { provider: 'google', label: 'Google', dot: '#EA4335' },
  { provider: 'apple', label: 'Apple', dot: '#E5E5E5' },
];

export function AuthScreen({
  initialMode = 'in',
  onBack,
  invite,
}: {
  initialMode?: 'in' | 'up';
  onBack?: () => void;
  /** Libellé d'invitation si l'user arrive via un lien de ligue (deep-link). */
  invite?: string;
}) {
  const { signIn, signUp, signInWithOAuth } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>(initialMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isUp = mode === 'up';

  const submit = async () => {
    setError(null);
    setNotice(null);
    if (!email.trim() || !password) {
      setError('Renseigne ton email et ton mot de passe.');
      return;
    }
    if (isUp && !username.trim()) {
      setError('Choisis un pseudo.');
      return;
    }
    setBusy(true);
    try {
      if (isUp) {
        await signUp(email.trim(), password, username);
        setNotice('Compte créé ! Vérifie tes emails si une confirmation est demandée.');
      } else {
        await signIn(email.trim(), password);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.');
    } finally {
      setBusy(false);
    }
  };

  const oauth = async (provider: OAuthProvider) => {
    setError(null);
    setBusy(true);
    try {
      await signInWithOAuth(provider);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connexion impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {onBack && (
          <Pressable onPress={onBack} hitSlop={8} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={colors.textMuted} />
          </Pressable>
        )}
        {/* Marque */}
        <View style={styles.brand}>
          <View style={styles.mark} />
          <Text style={styles.brandTxt}>ÉRIS</Text>
        </View>
        <Text style={styles.tagline}>Pronos esport. Chambre tes potes.</Text>

        {/* Bascule Connexion / Inscription */}
        <View style={styles.toggle}>
          <ToggleBtn label="Connexion" active={!isUp} onPress={() => setMode('in')} />
          <ToggleBtn label="Inscription" active={isUp} onPress={() => setMode('up')} />
        </View>

        {/* Bandeau d'invitation contextuel (arrivée via lien de ligue) */}
        {isUp && invite && (
          <View style={styles.invite}>
            <Ionicons name="people" size={16} color={colors.gold} />
            <Text style={styles.inviteTxt}>{invite}</Text>
          </View>
        )}

        {/* OAuth en priorité — Discord plein, le reste en outline */}
        {OAUTH.map((o) => {
          const filled = o.provider === 'discord';
          return (
            <Pressable
              key={o.provider}
              onPress={() => oauth(o.provider)}
              disabled={busy}
              style={[styles.oauth, filled && { backgroundColor: o.dot, borderColor: o.dot }]}
            >
              {!filled && <View style={[styles.oauthDot, { backgroundColor: o.dot }]} />}
              <Text style={[styles.oauthTxt, filled && styles.oauthTxtFilled]}>
                Continuer avec {o.label}
              </Text>
            </Pressable>
          );
        })}

        {/* Séparateur */}
        <View style={styles.sep}>
          <View style={styles.sepLine} />
          <Text style={styles.sepTxt}>ou par email</Text>
          <View style={styles.sepLine} />
        </View>

        {/* Pseudo — le seul vrai choix */}
        {isUp && (
          <Field
            label="Pseudo"
            hint="C'est ce nom qui apparaît au classement — choisis-le reconnaissable."
            value={username}
            onChangeText={setUsername}
            placeholder="ton_pseudo"
            autoCapitalize="none"
          />
        )}
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="toi@email.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Field
          label="Mot de passe"
          value={password}
          onChangeText={setPassword}
          placeholder="••••••••"
          secureTextEntry
        />

        {error && <Text style={styles.error}>{error}</Text>}
        {notice && <Text style={styles.notice}>{notice}</Text>}

        <Pressable
          onPress={submit}
          disabled={busy}
          style={[styles.primary, busy && styles.primaryBusy]}
        >
          {busy ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Text style={styles.primaryTxt}>{isUp ? "S'inscrire" : 'Se connecter'}</Text>
          )}
        </Pressable>

        {isUp && (
          <Text style={styles.legal}>
            En continuant, tu acceptes les CGU. 100% gratuit, sans mise réelle.
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ToggleBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.toggleBtn, active && styles.toggleBtnActive]}>
      <Text style={[styles.toggleTxt, active && styles.toggleTxtActive]}>{label}</Text>
    </Pressable>
  );
}

function Field({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.textFaint}
        {...input}
      />
      {hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space(6), paddingTop: space(10) },
  back: { alignSelf: 'flex-start', marginBottom: space(2) },

  brand: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  mark: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2.5,
    borderColor: colors.gold,
    transform: [{ rotate: '45deg' }],
    marginRight: space(3),
  },
  brandTxt: { ...font.brand, fontSize: 30, color: colors.gold },
  tagline: { ...font.body, color: colors.textMuted, textAlign: 'center', marginTop: space(2), marginBottom: space(8) },

  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    marginBottom: space(6),
  },
  toggleBtn: { flex: 1, paddingVertical: space(2.5), borderRadius: radius.pill, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: colors.cardElevated },
  toggleTxt: { ...font.body, color: colors.textMuted, fontWeight: '700' },
  toggleTxtActive: { color: colors.gold },

  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.goldFaint,
    borderRadius: radius.md,
    padding: space(3),
    marginBottom: space(5),
  },
  inviteTxt: { ...font.small, color: colors.text, marginLeft: space(2), flex: 1 },

  field: { marginBottom: space(4) },
  fieldLabel: { ...font.tag, color: colors.textFaint, textTransform: 'uppercase', marginBottom: space(2) },
  fieldHint: { ...font.small, color: colors.textFaint, marginTop: space(2) },
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

  error: { ...font.small, color: colors.danger, marginBottom: space(3) },
  notice: { ...font.small, color: colors.success, marginBottom: space(3) },

  primary: {
    backgroundColor: colors.gold,
    borderRadius: radius.md,
    paddingVertical: space(4),
    alignItems: 'center',
    marginTop: space(2),
  },
  primaryBusy: { opacity: 0.7 },
  primaryTxt: { ...font.h2, color: colors.bg, fontWeight: '800' },

  sep: { flexDirection: 'row', alignItems: 'center', marginVertical: space(6) },
  sepLine: { flex: 1, height: 1, backgroundColor: colors.border },
  sepTxt: { ...font.small, color: colors.textFaint, marginHorizontal: space(3) },

  oauth: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: space(3.5),
    marginBottom: space(3),
  },
  oauthDot: { width: 10, height: 10, borderRadius: 5, marginRight: space(3) },
  oauthTxt: { ...font.body, color: colors.text, fontWeight: '600' },
  oauthTxtFilled: { color: colors.white },

  legal: { ...font.small, color: colors.textFaint, textAlign: 'center', marginTop: space(4) },
});
