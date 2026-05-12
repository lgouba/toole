import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Card } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useAuthStore } from '@/stores/auth.store';
import { formatPhone } from '@/utils/format';
import { resolveUploadUrl } from '@/services/upload.service';

const menuItems = [
  { icon: 'person-outline', label: 'Modifier le profil', route: '/profile-edit' },
  { icon: 'cube-outline', label: 'Mes envois', route: '/(client)/shipments' },
  { icon: 'settings-outline', label: 'Paramètres', route: '/settings' },
  { icon: 'information-circle-outline', label: 'À propos', route: null },
] as const;

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  if (!user) return null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Avatar
            name={user.fullName}
            uri={resolveUploadUrl(user.avatarUrl) ?? undefined}
            size="xl"
          />
          <Text style={styles.name}>{user.fullName}</Text>
          <Text style={styles.phone}>{formatPhone(user.phone)}</Text>
        </View>

        <Card style={styles.menu}>
          {menuItems.map((item, i) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuItem, i < menuItems.length - 1 && styles.menuItemBorder]}
              activeOpacity={0.6}
              onPress={() => {
                if (item.route) router.push(item.route as any);
              }}
            >
              <Ionicons name={item.icon as any} size={22} color={colors.textSecondary} />
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </Card>

        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Ionicons name="log-out-outline" size={22} color={colors.error} />
          <Text style={styles.logoutText}>Se déconnecter</Text>
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
