import { useEffect } from 'react';
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
  const { isAuthenticated, isOnboarded, user } = useAuthStore();

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Auth guard
  useEffect(() => {
    if (!fontsLoaded) return;

    const inAuth = segments[0] === '(auth)';

    if (!isOnboarded) {
      router.replace('/(auth)/onboarding');
    } else if (!isAuthenticated) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuth) {
      // Redirect to correct home based on user type
      if (user?.userType === 'driver') {
        router.replace('/(driver)');
      } else {
        router.replace('/(client)');
      }
    }
  }, [fontsLoaded, isAuthenticated, isOnboarded, user?.userType]);

  if (!fontsLoaded) return null;

  return (
    <SocketProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(client)" />
        <Stack.Screen name="(driver)" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </SocketProvider>
  );
}
