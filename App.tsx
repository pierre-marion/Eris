import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, SafeAreaView, StyleSheet, View } from 'react-native';
import { useFonts, Anton_400Regular } from '@expo-google-fonts/anton';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import { colors } from './src/theme';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { isSupabaseConfigured } from './src/lib/supabase';
import { Home } from './src/screens/Home';
import { SplashScreen } from './src/screens/SplashScreen';
import { AuthScreen } from './src/screens/AuthScreen';

/** Visiteur déconnecté : Splash → Inscription / Connexion. */
function AuthFlow() {
  const [view, setView] = useState<'splash' | 'in' | 'up'>('splash');

  if (view === 'splash') {
    return <SplashScreen onSignUp={() => setView('up')} onSignIn={() => setView('in')} />;
  }
  return <AuthScreen initialMode={view} onBack={() => setView('splash')} />;
}

function Root() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  // Sans config Supabase, on saute l'auth (mode sans compte) -> app directe.
  if (!isSupabaseConfigured) return <Home />;

  return session ? <Home /> : <AuthFlow />;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Anton_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      {fontsLoaded ? (
        <AuthProvider>
          <Root />
        </AuthProvider>
      ) : (
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
