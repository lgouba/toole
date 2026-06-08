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
import {
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import '@/utils/globalErrorHandler';
import { initSentry, Sentry } from '@/services/sentry';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useLocationStore } from '@/stores/location.store';
import { SocketProvider } from '@/providers/SocketProvider';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { ActiveDeliveryBanner } from '@/components/ActiveDeliveryBanner';
import { ForceUpdateGate } from '@/components/ForceUpdateGate';
import { ActiveDeliveryGuard } from '@/providers/ActiveDeliveryGuard';
import { ThemeGate } from '@/providers/ThemeGate';
import { setAuthExpiredHandler } from '@/services/api.client';
import { useAutoUpdate } from '@/hooks/useAutoUpdate';
import { colors } from '@/theme';

export { ErrorBoundary } from 'expo-router';

// Initialise Sentry des le chargement du module (avant meme le 1er render).
// Comme ca, meme un crash dans le tout premier rendu est capture.
initSentry();

SplashScreen.preventAutoHideAsync();

// Durée minimale d'affichage du splash (ms). Sans ça, le splash disparaît
// dès que les polices sont prêtes (souvent <300ms) et le logo "flashe".
// On garde l'écran de lancement visible au moins ce délai pour une entrée
// plus posée dans l'app.
const SPLASH_MIN_DURATION_MS = 2200;
const appStartedAt = Date.now();

function RootLayout() {
  // Verifie automatiquement les OTA Expo au demarrage + au retour en foreground.
  // Sans ce hook, l'utilisateur doit force-close l'app 2 fois pour qu'un nouvel
  // update soit applique. Avec, c'est transparent (reload auto).
  useAutoUpdate();

  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
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

  // Splash natif (logo Toolé sur vert) gardé visible la durée minimale puis
  // caché. Un SEUL écran de lancement, identique iOS/Android (pas de splash JS).
  useEffect(() => {
    if (!fontsLoaded) return;
    const elapsed = Date.now() - appStartedAt;
    const remaining = Math.max(0, SPLASH_MIN_DURATION_MS - elapsed);
    const t = setTimeout(() => SplashScreen.hideAsync().catch(() => {}), remaining);
    return () => clearTimeout(t);
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
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#fff' } }}>
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
      <ActiveDeliveryBanner />
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

// Wrap avec Sentry.wrap pour qu'il capture les erreurs de rendering React
// (en plus des erreurs JS asynchrones deja capturees par init).
export default Sentry.wrap(RootLayout);
