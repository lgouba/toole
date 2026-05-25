import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useSettingsStore } from '@/stores/settings.store';
import { colors, typography, spacing, borderRadius } from '@/theme';

// URLs des stores — a renseigner quand l'app sera publiee.
// En attendant, on pointe vers une page web ou affiche un message.
const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.android.tolle';
const APP_STORE_URL = 'https://apps.apple.com/app/tolle/id000000000';

/**
 * Compare deux versions semver. Retourne true si `installed` < `min`.
 * Ex: compare("1.0.0", "1.0.1") -> true (besoin d'update)
 *     compare("1.2.0", "1.0.0") -> false (a jour)
 */
function isVersionBelow(installed: string, min: string): boolean {
  const [a1 = 0, a2 = 0, a3 = 0] = installed.split('.').map((n) => parseInt(n, 10) || 0);
  const [b1 = 0, b2 = 0, b3 = 0] = min.split('.').map((n) => parseInt(n, 10) || 0);
  if (a1 !== b1) return a1 < b1;
  if (a2 !== b2) return a2 < b2;
  return a3 < b3;
}

/**
 * Bloque l'app si la version installee est trop ancienne par rapport au
 * `minSupportedAppVersion` configure par l'admin dans les Settings.
 *
 * L'admin peut killer une version mobile bugguee en bumping cette valeur :
 * tous les utilisateurs avec une version inferieure tomberont sur l'ecran
 * "Mise a jour requise" et seront redirigeables vers le store.
 *
 * Si version OK ou si settings pas encore charges, rend les children.
 */
export function ForceUpdateGate({ children }: { children: React.ReactNode }) {
  const minVersion = useSettingsStore(
    (s) => s.settings.minSupportedAppVersion ?? '0.0.0',
  );
  const forceUpdateMessage = useSettingsStore(
    (s) => s.settings.forceUpdateMessage ?? null,
  );

  const installedVersion =
    Constants.expoConfig?.version ??
    (Constants.manifest as any)?.version ??
    '1.0.0';

  const needsUpdate = isVersionBelow(installedVersion, minVersion);

  if (!needsUpdate) return <>{children}</>;

  const openStore = () => {
    const url = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="cloud-download" size={56} color={colors.white} />
        </View>

        <Text style={styles.title}>Mise à jour requise</Text>
        <Text style={styles.subtitle}>
          {forceUpdateMessage ??
            'Une nouvelle version de Tôllé est disponible. Pour continuer à utiliser l\'application, veuillez la mettre à jour.'}
        </Text>

        <View style={styles.versionInfo}>
          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>Version installée</Text>
            <Text style={styles.versionValueOld}>{installedVersion}</Text>
          </View>
          <View style={styles.versionRow}>
            <Text style={styles.versionLabel}>Version minimum</Text>
            <Text style={styles.versionValueNew}>{minVersion}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={openStore}
          activeOpacity={0.85}
        >
          <Ionicons name="download" size={22} color={colors.white} />
          <Text style={styles.buttonText}>Mettre à jour maintenant</Text>
        </TouchableOpacity>

        <Text style={styles.helper}>
          Vous serez redirigé vers le {Platform.OS === 'ios' ? 'App Store' : 'Play Store'}.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.primary,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 22,
  },
  versionInfo: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginVertical: spacing.md,
    gap: spacing.xs,
  },
  versionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  versionLabel: {
    ...typography.captionMedium,
    color: colors.textSecondary,
  },
  versionValueOld: {
    ...typography.bodyMedium,
    color: colors.error,
    fontWeight: '700',
  },
  versionValueNew: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '700',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
    width: '100%',
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  buttonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '800',
    fontSize: 16,
  },
  helper: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
