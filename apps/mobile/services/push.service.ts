import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from './api.client';

// Detecte si on tourne dans Expo Go (push remote non supportee depuis SDK 53)
const isExpoGo = Constants.executionEnvironment === 'storeClient';

let cachedToken: string | null = null;
let handlerConfigured = false;

/**
 * Configure le handler pour afficher les notifications en foreground.
 * Utilise un import dynamique pour que expo-notifications ne soit PAS evalue
 * dans Expo Go (ce qui provoquerait une erreur au chargement).
 */
async function ensureHandlerConfigured() {
  if (handlerConfigured || isExpoGo) return;
  try {
    const Notifications = await import('expo-notifications');
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    handlerConfigured = true;
  } catch {
    // Module indisponible: tant pis.
  }
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;
  if (isExpoGo) return null;

  try {
    await ensureHandlerConfigured();
    const Notifications = await import('expo-notifications');

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Par defaut',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1D9E75',
        sound: 'default',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    cachedToken = tokenResponse.data;
    return cachedToken;
  } catch {
    return null;
  }
}

export async function syncPushTokenToBackend(): Promise<void> {
  const token = await registerForPushNotifications();
  if (!token) return;
  try {
    await api.post('/users/push-token', {
      token,
      platform: Platform.OS,
    });
  } catch {
    // Silencieux
  }
}

export async function unregisterPushTokenFromBackend(): Promise<void> {
  if (!cachedToken) return;
  try {
    await api.delete('/users/push-token', { data: { token: cachedToken } });
  } catch {
    // ignore
  }
}
