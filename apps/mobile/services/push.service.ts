import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from './api.client';

/**
 * Handler global: montre les notifications meme app au premier plan.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let cachedToken: string | null = null;

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    // Les simulateurs/emulateurs ne peuvent pas recevoir de push Expo
    return null;
  }

  // Android: creer le channel default
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

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;
    const tokenResponse = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    cachedToken = tokenResponse.data;
    return cachedToken;
  } catch (err) {
    console.warn('[Push] getExpoPushTokenAsync failed', err);
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
    // Silencieux: push est un nice-to-have, ne bloque pas le flow
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
