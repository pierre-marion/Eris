import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import type { Session } from '@supabase/supabase-js';
import { supabase, type Profile } from '../lib/supabase';
import type { GameKey } from '../theme';

WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'discord' | 'google' | 'apple';

const redirectTo = makeRedirectUri({ scheme: 'eris' });

interface AuthValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithOAuth: (provider: OAuthProvider) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  followGame: (game: GameKey) => Promise<void>;
  setGames: (games: GameKey[]) => Promise<void>;
  updateUsername: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}

/** Récupère tokens depuis l'URL de retour OAuth et ouvre la session. */
async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);
  const { access_token, refresh_token, code } = params;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }
  if (!access_token) return;
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Session initiale + écoute des changements.
  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch((e) => console.warn('getSession:', e))
      .finally(() => setLoading(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));

    // Refresh auto du token quand l'app revient au premier plan (reco Supabase RN).
    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });

    return () => {
      sub.subscription.unsubscribe();
      appSub.remove();
    };
  }, []);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, points, games')
      .eq('id', userId)
      .single();
    setProfile(
      data
        ? { ...data, games: (data.games ?? ['valorant', 'cs', 'lol', 'cod']) as GameKey[] }
        : null,
    );
  };

  /** Ajoute un jeu aux jeux suivis (depuis le sélecteur « + suivre »). */
  const followGame = async (game: GameKey) => {
    if (!session?.user || !profile || profile.games.includes(game)) return;
    const games = [...profile.games, game];
    setProfile({ ...profile, games });
    await supabase.from('profiles').update({ games }).eq('id', session.user.id);
  };

  /** Remplace la liste des jeux suivis (réglages). Au moins un jeu. */
  const setGames = async (games: GameKey[]) => {
    if (!session?.user || !profile || games.length === 0) return;
    setProfile({ ...profile, games });
    await supabase.from('profiles').update({ games }).eq('id', session.user.id);
  };

  const updateUsername = async (name: string) => {
    if (!session?.user || !profile) return;
    const username = name.trim();
    if (!username) return;
    setProfile({ ...profile, username });
    await supabase.from('profiles').update({ username }).eq('id', session.user.id);
  };

  // Charge le profil quand la session change.
  useEffect(() => {
    if (session?.user) loadProfile(session.user.id);
    else setProfile(null);
  }, [session?.user?.id]);

  const signUp = async (email: string, password: string, username: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: username.trim() } },
    });
    if (error) throw error;
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signInWithOAuth = async (provider: OAuthProvider) => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (res.type === 'success') await createSessionFromUrl(res.url);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        signUp,
        signIn,
        signInWithOAuth,
        signOut,
        refreshProfile,
        followGame,
        setGames,
        updateUsername,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
