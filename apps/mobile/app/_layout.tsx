import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { useAuthStore } from '@/stores/auth.store';
import { SocketProvider } from '@/providers/SocketProvider';
import { colors } from '@/theme';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isOnboarded, user, refreshUser } = useAuthStore();

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Au demarrage et a chaque transition auth->logged, rafraichir le user depuis le backend
  // pour eviter d'utiliser un userType obsolete du cache AsyncStorage.
  useEffect(() => {
    if (isAuthenticated && fontsLoaded) {
      refreshUser();
    }
  }, [fontsLoaded, isAuthenticated, refreshUser]);

  // Auth guard + role guard: remet l'utilisateur dans le bon groupe selon son role
  useEffect(() => {
    if (!fontsLoaded) return;

    const topSegment = segments[0] as string | undefined;
    const inAuth = topSegment === '(auth)';
    const inClient = topSegment === '(client)';
    const inDriver = topSegment === '(driver)';

    if (!isOnboarded) {
      if (!inAuth) router.replace('/(auth)/onboarding');
      return;
    }

    if (!isAuthenticated) {
      if (!inAuth) router.replace('/(auth)/login');
      return;
    }

    // Authentifie : verifier que l'utilisateur est dans le bon groupe
    const expected = user?.userType === 'driver' ? '(driver)' : '(client)';
    const wrongGroup =
      inAuth ||
      (expected === '(driver)' && inClient) ||
      (expected === '(client)' && inDriver);

    if (wrongGroup) {
      router.replace(expected === '(driver)' ? '/(driver)' : '/(client)');
    }
  }, [fontsLoaded, isAuthenticated, isOnboarded, user?.userType, segments.join('/')]);

  if (!fontsLoaded) return null;

  // Si authentifie mais user pas encore charge, afficher un loader (evite flash sur mauvais ecran)
  if (isAuthenticated && !user) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SocketProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(client)" />
        <Stack.Screen name="(driver)" />
        <Stack.Screen name="delivery/[id]" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </SocketProvider>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
