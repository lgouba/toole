import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { api } from '@/services/api.client';

/**
 * Page de diagnostic des notifications push.
 * Affiche tout ce qu'on a besoin pour comprendre pourquoi un livreur/client
 * ne recoit pas les notifs : permission, projectId, token Expo, statut serveur.
 */
export default function DebugPushScreen() {
  const router = useRouter();
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const isExpoGo = Constants.executionEnvironment === 'storeClient';
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId;

  const append = (line: string) => {
    console.log('[debug-push]', line);
    setLog((l) => [...l, line]);
  };

  useEffect(() => {
    setLog([]);
    append(`Platform: ${Platform.OS} ${Platform.Version}`);
    append(`Device.isDevice: ${Device.isDevice}`);
    append(`Brand/Model: ${Device.brand} / ${Device.modelName}`);
    append(`Constants.executionEnvironment: ${Constants.executionEnvironment ?? 'undefined'}`);
    append(`isExpoGo: ${isExpoGo}`);
    append(`projectId: ${projectId ?? 'MANQUANT ⚠️'}`);
  }, []);

  const runDiagnostic = async () => {
    if (running) return;
    setRunning(true);
    setLog([]);

    append(`──────────────────`);
    append(`▶ Démarrage du diagnostic`);
    append(`──────────────────`);

    // 1. Device check
    if (!Device.isDevice) {
      append(`❌ Pas un vrai device (émulateur) — push impossible.`);
      setRunning(false);
      return;
    }
    append(`✓ Device détecté`);

    // 2. Expo Go check
    if (isExpoGo) {
      append(`❌ App tourne en mode Expo Go — push remote non supporté en SDK 53+.`);
      append(`   Il faut installer l'APK custom.`);
      setRunning(false);
      return;
    }
    append(`✓ Pas en mode Expo Go (APK custom)`);

    // 3. Project ID
    if (!projectId) {
      append(`❌ projectId Expo manquant. Vérifier app.json > extra.eas.projectId`);
      setRunning(false);
      return;
    }
    append(`✓ projectId présent : ${projectId}`);

    // 4. Import dynamique expo-notifications
    let Notifications: typeof import('expo-notifications');
    try {
      Notifications = await import('expo-notifications');
      append(`✓ Module expo-notifications chargé`);
    } catch (err: any) {
      append(`❌ Impossible de charger expo-notifications : ${err?.message}`);
      setRunning(false);
      return;
    }

    // 5. Permission
    try {
      const existing = await Notifications.getPermissionsAsync();
      append(`Permission actuelle : ${existing.status} (canAsk: ${existing.canAskAgain})`);
      let final = existing.status;
      if (existing.status !== 'granted') {
        if (!existing.canAskAgain) {
          append(`❌ Permission refusée définitivement.`);
          append(`   → Paramètres Android → Apps → Tollé → Notifications`);
          setRunning(false);
          return;
        }
        append(`▶ Demande de permission...`);
        const req = await Notifications.requestPermissionsAsync();
        final = req.status;
        append(`Réponse : ${req.status}`);
      }
      if (final !== 'granted') {
        append(`❌ Permission non accordée — push impossible.`);
        setRunning(false);
        return;
      }
      append(`✓ Permission accordée`);
    } catch (err: any) {
      append(`❌ Erreur permission : ${err?.message}`);
      setRunning(false);
      return;
    }

    // 6. Channel Android
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Par defaut',
          importance: Notifications.AndroidImportance.MAX,
        });
        append(`✓ Channel Android configuré`);
      } catch (err: any) {
        append(`⚠ Channel Android : ${err?.message}`);
      }
    }

    // 7. Obtenir le token Expo
    let token: string;
    try {
      append(`▶ Demande du token Expo...`);
      const res = await Notifications.getExpoPushTokenAsync({ projectId });
      token = res.data;
      append(`✓ Token obtenu : ${token.slice(0, 40)}...`);
    } catch (err: any) {
      append(`❌ Erreur getExpoPushTokenAsync : ${err?.message}`);
      append(`   Code : ${err?.code ?? '?'}`);
      setRunning(false);
      return;
    }

    // 8. Envoi au backend
    try {
      append(`▶ Enregistrement auprès du backend...`);
      const res = await api.post('/users/push-token', {
        token,
        platform: Platform.OS,
      });
      append(`✓ Backend a confirmé : HTTP ${res.status}`);
      append(`✓ Token enregistré côté serveur ✓`);
    } catch (err: any) {
      append(
        `❌ Backend a rejeté : ${err?.response?.status} ${
          err?.response?.data?.error?.message ?? err?.message
        }`,
      );
      setRunning(false);
      return;
    }

    append(`──────────────────`);
    append(`✓ DIAGNOSTIC RÉUSSI`);
    append(`Tu devrais maintenant recevoir les notifications.`);
    append(`──────────────────`);
    setRunning(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Diagnostic notifications</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.intro}>
          Cet écran permet de vérifier pourquoi vous ne recevez pas les
          notifications. Lancez le diagnostic, puis envoyez-nous le résultat
          si le problème persiste.
        </Text>

        <TouchableOpacity
          style={[styles.runBtn, running && { opacity: 0.6 }]}
          onPress={runDiagnostic}
          disabled={running}
        >
          <Ionicons name="play" size={20} color={colors.white} />
          <Text style={styles.runBtnText}>
            {running ? 'Diagnostic en cours...' : 'Lancer le diagnostic'}
          </Text>
        </TouchableOpacity>

        <View style={styles.logBox}>
          {log.length === 0 ? (
            <Text style={styles.logEmpty}>Le résultat s'affichera ici.</Text>
          ) : (
            log.map((line, i) => (
              <Text
                key={i}
                style={[
                  styles.logLine,
                  line.startsWith('❌') && { color: colors.error },
                  line.startsWith('✓') && { color: colors.primary },
                  line.startsWith('⚠') && { color: colors.warning },
                  line.startsWith('▶') && { color: colors.textPrimary, fontWeight: '700' },
                  line.startsWith('─') && { color: colors.textTertiary },
                ]}
              >
                {line}
              </Text>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  title: { ...typography.bodyMedium, color: colors.textPrimary, fontWeight: '700' },
  scroll: { padding: spacing.lg, gap: spacing.md },
  intro: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },
  runBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
  },
  runBtnText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '700',
  },
  logBox: {
    backgroundColor: '#0f172a',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 200,
    gap: 4,
  },
  logEmpty: {
    ...typography.bodySmall,
    color: '#64748b',
    fontStyle: 'italic',
  },
  logLine: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    color: '#e2e8f0',
    lineHeight: 18,
  },
});
