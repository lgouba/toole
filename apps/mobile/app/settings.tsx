import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/services/api.client';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [deleting, setDeleting] = useState(false);

  if (!user) return null;

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
                Recevoir les alertes de course et mises à jour
              </Text>
            </View>
            <Switch
              value={notifEnabled}
              onValueChange={setNotifEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.white}
            />
          </View>
          <View style={styles.separator} />
          <View style={styles.row}>
            <Text style={styles.rowTitle}>Langue</Text>
            <Text style={styles.rowValue}>Français</Text>
          </View>
        </Card>

        <Text style={styles.sectionLabel}>Informations</Text>
        <Card style={styles.section}>
          <TouchableOpacity style={styles.row} activeOpacity={0.6}>
            <Ionicons name="document-text-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.rowTitle, { marginLeft: spacing.sm }]}>
              Conditions d'utilisation
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
          <View style={styles.separator} />
          <TouchableOpacity style={styles.row} activeOpacity={0.6}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.rowTitle, { marginLeft: spacing.sm }]}>
              Politique de confidentialité
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
          <View style={styles.separator} />
          <TouchableOpacity style={styles.row} activeOpacity={0.6}>
            <Ionicons name="help-circle-outline" size={20} color={colors.textSecondary} />
            <Text style={[styles.rowTitle, { marginLeft: spacing.sm }]}>Aide / Contact</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        </Card>

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
          <Text style={styles.version}>Tolle v1.0.0</Text>
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
  rowTitle: {
    ...typography.body,
    color: colors.textPrimary,
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
