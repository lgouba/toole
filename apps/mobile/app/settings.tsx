import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { Card } from '@/components/ui';
import { colors, typography, spacing } from '@/theme';
import { useAuthStore } from '@/stores/auth.store';
import { useNotificationPrefsStore } from '@/stores/notificationPrefs.store';
import {
  syncPushTokenToBackend,
  unregisterPushTokenFromBackend,
} from '@/services/push.service';
import {
  describeLocationPermission,
  type LocationPermissionDescription,
  type PermissionTone,
} from '@/utils/locationPermissionLabel';
import { api } from '@/services/api.client';

const toneColor = (tone: PermissionTone): string =>
  tone === 'ok' ? colors.primary : tone === 'warn' ? '#B26A00' : colors.error;

/** Ligne de sous-préférence (catégorie de notification) sous le master. */
function CategoryRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={[styles.row, styles.rowSub]}>
      <Text style={styles.rowSubTitle}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.white}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const notif = useNotificationPrefsStore();
  const isDriver = user?.userType === 'driver';

  const [deleting, setDeleting] = useState(false);
  const [locPerm, setLocPerm] = useState<LocationPermissionDescription | null>(null);

  // Version réelle de l'app (évite un numéro codé en dur qui se périme).
  const appVersion =
    Constants.expoConfig?.version ??
    (Constants.manifest as any)?.version ??
    '1.0.0';

  // État réel des permissions de localisation (livreur). Rafraîchi au focus et
  // au retour de l'app en premier plan (ex. retour des réglages OS).
  const refreshLocPerm = useCallback(async () => {
    try {
      const fg = await Location.getForegroundPermissionsAsync();
      const bg = await Location.getBackgroundPermissionsAsync();
      setLocPerm(
        describeLocationPermission({
          foregroundGranted: fg.granted,
          backgroundGranted: bg.granted,
        }),
      );
    } catch {
      setLocPerm(null);
    }
  }, []);

  useEffect(() => {
    if (!isDriver) return;
    refreshLocPerm();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refreshLocPerm();
    });
    return () => sub.remove();
  }, [isDriver, refreshLocPerm]);

  if (!user) return null;

  // Master notifications : effet réel immédiat (enregistre/désenregistre le push
  // token côté backend). La préférence reste enregistrée même si l'appel réseau
  // échoue (resync au prochain lancement).
  const onToggleMaster = async (on: boolean) => {
    notif.setMaster(on);
    try {
      if (on) await syncPushTokenToBackend();
      else await unregisterPushTokenFromBackend();
    } catch {
      /* best effort */
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Supprimer mon compte',
      'Cette action est définitive. Toutes vos données seront effacées.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await api.delete('/users/me');
              await logout();
              router.replace('/(auth)/login');
            } catch (err: any) {
              const msg =
                err?.response?.data?.error?.message ??
                'Impossible de supprimer le compte.';
              Alert.alert('Erreur', msg);
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paramètres</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>Préférences</Text>
        <Card style={styles.section}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>Notifications</Text>
              <Text style={styles.rowHint}>
                Activer ou couper toutes les notifications
              </Text>
            </View>
            <Switch
              value={notif.master}
              onValueChange={onToggleMaster}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>

          {notif.master && (
            <>
              <View style={styles.separator} />
              <CategoryRow
                label="Nouvelles courses"
                value={notif.newDeliveries}
                onChange={(v) => notif.setCategory('newDeliveries', v)}
              />
              <View style={styles.separator} />
              <CategoryRow
                label="Suivi de ma livraison"
                value={notif.deliveryUpdates}
                onChange={(v) => notif.setCategory('deliveryUpdates', v)}
              />
              <View style={styles.separator} />
              <CategoryRow
                label="Promotions & actus"
                value={notif.promotions}
                onChange={(v) => notif.setCategory('promotions', v)}
              />
            </>
          )}

          <View style={styles.separator} />
          <View style={styles.row}>
            <Text style={styles.rowTitle}>Langue</Text>
            <Text style={styles.rowValue}>Français</Text>
          </View>
        </Card>

        {isDriver && (
          <>
            <Text style={styles.sectionLabel}>Localisation</Text>
            <Card style={styles.section}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>Localisation en arrière-plan</Text>
                  <Text style={styles.rowHint}>
                    Nécessaire pour rester visible et recevoir des courses, même
                    quand l'application est en arrière-plan.
                  </Text>
                  {locPerm && (
                    <View style={styles.permChip}>
                      <View
                        style={[styles.permDot, { backgroundColor: toneColor(locPerm.tone) }]}
                      />
                      <Text style={[styles.permLabel, { color: toneColor(locPerm.tone) }]}>
                        {locPerm.label}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              {locPerm?.needsAttention && (
                <>
                  <View style={styles.separator} />
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => Linking.openSettings()}
                    activeOpacity={0.6}
                  >
                    <Ionicons name="settings-outline" size={20} color={colors.primary} />
                    <Text
                      style={[styles.rowTitle, { marginLeft: spacing.sm, color: colors.primary }]}
                    >
                      Ouvrir les réglages
                    </Text>
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                </>
              )}
            </Card>
          </>
        )}

        <Text style={styles.sectionLabel}>Compte</Text>
        <Card style={styles.section}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => {
              logout();
              router.replace('/(auth)/login');
            }}
            activeOpacity={0.6}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.textPrimary} />
            <Text style={[styles.rowTitle, { marginLeft: spacing.sm }]}>Se déconnecter</Text>
          </TouchableOpacity>
          <View style={styles.separator} />
          <TouchableOpacity
            style={styles.row}
            onPress={handleDeleteAccount}
            activeOpacity={0.6}
            disabled={deleting}
          >
            <Ionicons name="trash-outline" size={20} color={colors.error} />
            <Text style={[styles.rowTitle, styles.danger, { marginLeft: spacing.sm }]}>
              {deleting ? 'Suppression...' : 'Supprimer mon compte'}
            </Text>
          </TouchableOpacity>
        </Card>

        <View style={styles.footer}>
          <Text style={styles.version}>Toolé v{appVersion}</Text>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.bodyMedium, color: colors.textPrimary },
  content: { padding: spacing.md, gap: spacing.xs },
  sectionLabel: {
    ...typography.captionMedium,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  section: { padding: 0, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  rowSub: {
    paddingVertical: spacing.sm,
    paddingLeft: spacing.lg,
  },
  rowTitle: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  rowSubTitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  rowHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rowValue: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: spacing.md,
  },
  permChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  permDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  permLabel: {
    ...typography.captionMedium,
  },
  danger: { color: colors.error, fontWeight: '600' },
  footer: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xxl,
  },
  version: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
