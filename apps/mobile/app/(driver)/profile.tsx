import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { recap as R, profile as P } from '@/theme/recapTokens';
import { useAuthStore } from '@/stores/auth.store';
import { getMyDriverStats, DriverStats } from '@/services/driver.service';
import { documentsStatus } from '@/utils/documentsStatus';
import { DriverProfileHeader } from '@/components/driver/profile/DriverProfileHeader';
import { MenuSection } from '@/components/profile/MenuSection';

export default function DriverProfileScreen() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuthStore();
  const [stats, setStats] = useState<DriverStats | null>(null);

  useFocusEffect(
    useCallback(() => {
      refreshUser().catch(() => {});
      let cancelled = false;
      getMyDriverStats().then((s) => { if (!cancelled && s) setStats(s); }).catch(() => {});
      return () => { cancelled = true; };
    }, [refreshUser]),
  );

  if (!user) return null;

  const go = (path: string) => router.push(path as any);
  const verified = !!user.isVerified;
  const docs = documentsStatus(verified);
  const sinceYear = user.createdAt ? new Date(user.createdAt).getFullYear() : undefined;
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const last2 = (user.phone || '').replace(/\D/g, '').slice(-2);

  const confirmLogout = () => {
    Alert.alert('Se déconnecter ?', 'Tu devras te reconnecter pour reprendre des courses.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Se déconnecter', style: 'destructive', onPress: () => logout().catch(() => {}) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <DriverProfileHeader
          fullName={user.fullName}
          phone={user.phone}
          verified={verified}
          ratingAvg={user.ratingAvg}
          ratingCount={user.ratingCount}
          stats={{
            courses: stats?.totalDeliveries ?? 0,
            acceptance: stats ? stats.acceptanceRate : null,
            sinceYear,
          }}
          onEdit={() => go('/profile-edit')}
        />

        <MenuSection
          title="ACTIVITÉ"
          items={[
            { icon: 'bar-chart', tint: 'green', label: 'Mes statistiques', onPress: () => go('/(driver)/stats') },
          ]}
        />

        <MenuSection
          title="COMPTE"
          items={[
            { icon: 'person', tint: 'green', label: 'Modifier le profil', onPress: () => go('/profile-edit') },
            {
              icon: 'description',
              tint: 'blue',
              label: 'Mes documents',
              onPress: () => go('/(driver)/kyc'),
              chip: { label: docs.label, tone: docs.tone },
            },
            {
              icon: 'account-balance-wallet',
              tint: 'amber',
              label: 'Moyen de retrait',
              sub: last2 ? `Mobile Money · ···${last2}` : 'Mobile Money',
              onPress: () => go('/(driver)/wallet'),
            },
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

        <Text style={styles.version}>Toolé Driver · v{version}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: P.canvas },
  content: { paddingHorizontal: R.space.gut, paddingBottom: R.space.xxl },
  logout: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: R.space.sm,
    height: 50, borderRadius: P.radius.card, backgroundColor: P.surface,
    borderWidth: 1, borderColor: P.dangerBorder, marginTop: R.space.xs,
  },
  logoutText: { fontFamily: R.font.bodyBold, fontSize: 15, color: P.danger },
  version: { textAlign: 'center', fontFamily: R.font.mono, fontSize: 11, color: P.textMuted, marginTop: R.space.gut },
});
