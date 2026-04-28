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
  if (!Device.isDevice) {
    console.log('[push] skipped: not a real device');
    return null;
  }
  if (isExpoGo) {
    console.log('[push] skipped: running in Expo Go');
    return null;
  }

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
    console.log('[push] existing permission status:', existingStatus);
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      console.log('[push] requested permission status:', status);
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('[push] permission denied -> no token will be registered');
      return null;
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;
    console.log('[push] requesting Expo push token, projectId =', projectId);
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    cachedToken = tokenResponse.data;
    console.log('[push] obtained token:', cachedToken);
    return cachedToken;
  } catch (err) {
    console.warn('[push] error obtaining token:', err);
    return null;
  }
}

export async function syncPushTokenToBackend(): Promise<void> {
  console.log('[push] syncPushTokenToBackend called');
  const token = await registerForPushNotifications();
  if (!token) {
    console.warn('[push] no token to sync');
    return;
  }
  try {
    console.log('[push] POST /users/push-token with', token.slice(0, 30) + '...');
    const res = await api.post('/users/push-token', {
      token,
      platform: Platform.OS,
    });
    console.log('[push] backend confirmed token registration:', res.status);
  } catch (err: any) {
    console.warn(
      '[push] backend rejected token:',
      err?.response?.status,
      err?.response?.data ?? err?.message,
    );
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
