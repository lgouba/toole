import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import '@/utils/globalErrorHandler';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useLocationStore } from '@/stores/location.store';
import { SocketProvider } from '@/providers/SocketProvider';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { ForceUpdateGate } from '@/components/ForceUpdateGate';
import { ActiveDeliveryGuard } from '@/providers/ActiveDeliveryGuard';
import { ThemeGate } from '@/providers/ThemeGate';
import { setAuthExpiredHandler } from '@/services/api.client';
import { useAutoUpdate } from '@/hooks/useAutoUpdate';
import { colors } from '@/theme';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Verifie automatiquement les OTA Expo au demarrage + au retour en foreground.
  // Sans ce hook, l'utilisateur doit force-close l'app 2 fois pour qu'un nouvel
  // update soit applique. Avec, c'est transparent (reload auto).
  useAutoUpdate();

  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isOnboarded, user, refreshUser, logout, roleTutorialSeen } =
    useAuthStore();

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  // Refresh public settings au démarrage + toutes les 5 min
  const refreshSettings = useSettingsStore((s) => s.refresh);
  useEffect(() => {
    refreshSettings();
    const interval = setInterval(() => {
      refreshSettings();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refreshSettings]);

  // Récupère la position GPS de l'utilisateur dès le démarrage (après login)
  // pour que les écrans de carte / autocomplete soient déjà prêts.
  const refreshLocation = useLocationStore((s) => s.refresh);
  useEffect(() => {
    if (isAuthenticated) {
      refreshLocation().catch(() => {});
    }
  }, [isAuthenticated, refreshLocation]);

  // Quand le refresh token échoue, on force un logout propre.
  // Évite les états zombie où l'utilisateur est "loggué" côté cache
  // mais plus aucun appel ne passe (typique après un wipe DB).
  useEffect(() => {
    setAuthExpiredHandler((reason) => {
      console.warn('[Auth] session expired, logging out', reason);
      // Si le serveur indique que le compte a ete suspendu / desactive,
      // on previent l'utilisateur explicitement avant de le delogger.
      if (reason?.errorCode === 'ACCOUNT_UNAVAILABLE') {
        Alert.alert(
          'Compte indisponible',
          reason.errorMessage ??
            "Votre compte n'est pas accessible. Veuillez contacter le support.",
        );
      }
      logout().catch(() => {});
    });
    return () => setAuthExpiredHandler(null);
  }, [logout]);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Au démarrage et à chaque transition auth->logged, rafraîchir le user depuis le backend
  // pour éviter d'utiliser un userType obsolète du cache AsyncStorage.
  useEffect(() => {
    if (isAuthenticated && fontsLoaded) {
      // Catch explicite pour éviter "unhandled promise rejection"
      refreshUser().catch(() => {});
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

    // Authentifie : vérifier que l'utilisateur est dans le bon groupe
    const expected = user?.userType === 'driver' ? '(driver)' : '(client)';
    const wrongGroup =
      inAuth ||
      (expected === '(driver)' && inClient) ||
      (expected === '(client)' && inDriver);

    if (wrongGroup) {
      router.replace(expected === '(driver)' ? '/(driver)' : '/(client)');
      return;
    }

    // Tutoriel post-login : si jamais vu pour ce role, on l'affiche au premier
    // arrivee sur la home du role. L'utilisateur peut le passer via "Passer".
    // On n'affiche le tuto que pour client + driver (pas merchant/admin).
    if (
      user?.userType === 'client' ||
      user?.userType === 'driver'
    ) {
      const role = user.userType;
      const seen = roleTutorialSeen[role];
      const onTutorial = (segments[1] as string) === 'tutorial';
      if (!seen && !onTutorial) {
        const path =
          role === 'driver' ? '/(driver)/tutorial' : '/(client)/tutorial';
        router.replace(path as any);
      }
    }
  }, [
    fontsLoaded,
    isAuthenticated,
    isOnboarded,
    user?.userType,
    roleTutorialSeen.client,
    roleTutorialSeen.driver,
    segments.join('/'),
  ]);

  if (!fontsLoaded) return null;

  // Si authentifie mais user pas encore charge, afficher un loader (évite flash sur mauvais écran)
  if (isAuthenticated && !user) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ThemeGate>
      <ForceUpdateGate>
      <SocketProvider>
        <ActiveDeliveryGuard />
        <ConnectionBanner />
        <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(client)" />
        <Stack.Screen name="(driver)" />
        <Stack.Screen name="delivery/[id]" />
        <Stack.Screen name="profile-edit" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="about" />
        <Stack.Screen
          name="address-picker"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="wallet-flow" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </SocketProvider>
    </ForceUpdateGate>
    </ThemeGate>
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
