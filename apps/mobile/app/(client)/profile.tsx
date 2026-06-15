import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { recap as R, profile as P } from '@/theme/recapTokens';
import { useAuthStore } from '@/stores/auth.store';
import { getDeliveries } from '@/services/delivery.service';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { MenuSection } from '@/components/profile/MenuSection';

const ACTIVE = ['pending', 'accepted', 'picking_up', 'picked_up', 'delivering'];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuthStore();
  const [stats, setStats] = useState<{ total: number; active: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      refreshUser().catch(() => {});
      let cancelled = false;
      getDeliveries('', 'client')
        .then((list) => {
          if (cancelled) return;
          setStats({
            total: list.length,
            active: list.filter((d) => ACTIVE.includes(d.status)).length,
          });
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }, [refreshUser]),
  );

  if (!user) return null;

  // Certaines routes (groupes expo-router) ne sont pas dans le type généré → cast.
  const go = (path: string) => router.push(path as any);

  const memberYear = user.createdAt ? new Date(user.createdAt).getFullYear() : undefined;
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const confirmLogout = () => {
    Alert.alert('Se déconnecter ?', 'Tu devras te reconnecter pour envoyer un colis.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: () => logout().catch(() => {}) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ProfileHeader
          fullName={user.fullName}
          phone={user.phone}
          memberSinceYear={memberYear}
          stats={stats}
          onEdit={() => go('/profile-edit')}
        />

        <MenuSection
          title="COMPTE"
          items={[
            { icon: 'person', tint: 'green', label: 'Modifier le profil', onPress: () => go('/profile-edit') },
            { icon: 'location-on', tint: 'blue', label: 'Mes adresses', onPress: () => go('/(client)/favorites') },
          ]}
        />

        <MenuSection
          title="ACTIVITÉ"
          items={[
            { icon: 'inventory-2', tint: 'green', label: 'Mes envois', onPress: () => go('/(client)/shipments') },
          ]}
        />

        <MenuSection
          title="APPLICATION"
          items={[
            { icon: 'settings', tint: 'violet', label: 'Paramètres', onPress: () => go('/settings') },
            { icon: 'info', tint: 'neutral', label: 'À propos & support', onPress: () => go('/about') },
          ]}
        />

        <TouchableOpacity style={styles.logout} onPress={confirmLogout} activeOpacity={0.8}>
          <MaterialIcons name="logout" size={20} color={P.danger} />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Toolé · version {version}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.canvas },
  content: { paddingHorizontal: R.space.gut, paddingBottom: R.space.xxl },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: R.space.sm,
    height: 50,
    borderRadius: P.radius.card,
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.dangerBorder,
    marginTop: R.space.xs,
  },
  logoutText: { fontFamily: R.font.bodyBold, fontSize: 15, color: P.danger },
  version: {
    textAlign: 'center',
    fontFamily: R.font.mono,
    fontSize: 11,
    color: P.textMuted,
    marginTop: R.space.gut,
  },
});
