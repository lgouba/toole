import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Card } from '@/components/ui';
import { colors, typography, spacing } from '@/theme';
import { useAuthStore } from '@/stores/auth.store';
import { formatPhone } from '@/utils/format';

const menuItems = [
  { icon: 'person-outline', label: 'Modifier le profil', action: 'edit' },
  { icon: 'document-outline', label: 'Mes documents', action: 'documents' },
  { icon: 'time-outline', label: 'Historique', action: 'history' },
  { icon: 'settings-outline', label: 'Parametres', action: 'settings' },
  { icon: 'information-circle-outline', label: 'A propos', action: 'about' },
];

export default function DriverProfileScreen() {
  const { user, logout } = useAuthStore();

  if (!user) return null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Avatar name={user.fullName} size="xl" />
          <Text style={styles.name}>{user.fullName}</Text>
          <Text style={styles.phone}>{formatPhone(user.phone)}</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={16} color={colors.warning} />
            <Text style={styles.rating}>{user.ratingAvg.toFixed(1)}</Text>
            <Text style={styles.ratingCount}>({user.ratingCount} avis)</Text>
          </View>
        </View>

        <Card style={styles.menu}>
          {menuItems.map((item, i) => (
            <TouchableOpacity
              key={item.action}
              style={[styles.menuItem, i < menuItems.length - 1 && styles.menuItemBorder]}
              activeOpacity={0.6}
            >
              <Ionicons name={item.icon as any} size={22} color={colors.textSecondary} />
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </Card>

        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
          <Text style={styles.logoutText}>Se deconnecter</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.md,
  },
  name: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  phone: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  rating: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  ratingCount: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  menu: {
    marginBottom: spacing.xl,
    padding: 0,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuLabel: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  logoutText: {
    ...typography.bodyMedium,
    color: colors.error,
  },
});
