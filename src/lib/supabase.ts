import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** True si l'app a des identifiants Supabase (sinon on cache l'écran d'auth). */
export const isSupabaseConfigured = url.length > 0 && anonKey.length > 0;

/**
 * Client Supabase pour React Native :
 *  - session persistée dans AsyncStorage (survit au reload / kill de l'app)
 *  - refresh auto du token
 *  - detectSessionInUrl désactivé (pas de navigateur, on gère l'OAuth à la main)
 */
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

import type { GameKey } from '../theme';

export interface Profile {
  id: string;
  username: string | null;
  points: number;
  games: GameKey[];
}
