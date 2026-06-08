import React from 'react';
import { Text, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/auth.store';
import { useDeliveryStore } from '@/stores/delivery.store';
import { useDriverStore } from '@/stores/driver.store';
import { computeTargetPath } from '@/providers/ActiveDeliveryGuard';
import { colors } from '@/theme';

/**
 * Bandeau persistant "Reprendre la course en cours".
 *
 * Objectif : un utilisateur (client OU livreur) qui a une livraison en cours
 * ne doit jamais être bloqué loin de l'écran de sa course. S'il navigue
 * ailleurs (onglet Profil, Portefeuille, etc.), ce bandeau flottant reste
 * visible et le ramène en un tap sur le bon écran selon le statut.
 *
 * Caché quand :
 *  - pas connecté / pas de course active
 *  - on est déjà sur l'écran de la course (ou une de ses sous-étapes :
 *    photo, code, confirmation…) pour ne pas gêner l'interaction
 */

// Sous-écrans du flow de livraison : on n'affiche PAS le bandeau dessus
// (l'utilisateur est déjà dans le parcours de la course).
const DELIVERY_FLOW_SCREENS = [
  'active-delivery',
  'searching',
  'delivery-complete',
  'pickup-navigation',
  'pickup-confirm',
  'delivery-navigation',
  'delivery-confirm',
  'code-validation',
  'new-request',
  'new-delivery',
];

export function ActiveDeliveryBanner() {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role: 'client' | 'driver' = user?.userType === 'driver' ? 'driver' : 'client';

  const clientDelivery = useDeliveryStore((s) => s.activeDelivery);
  const driverDelivery = useDriverStore((s) => s.activeDelivery);
  const active = role === 'driver' ? driverDelivery : clientDelivery;

  if (!isAuthenticated || !user || !active) return null;

  const currentPath = '/' + segments.join('/');
  // En cours d'auth, ou déjà dans le flow de livraison → pas de bandeau.
  if (segments[0] === '(auth)') return null;
  if (DELIVERY_FLOW_SCREENS.some((s) => currentPath.includes(s))) return null;

  const target = computeTargetPath(role, active.status);
  if (!target) return null;

  const label = bannerLabel(role, active.status);

  return (
    <Animated.View
      entering={FadeInUp.duration(250)}
      exiting={FadeOutDown.duration(200)}
      style={[styles.wrap, { bottom: insets.bottom + 72 }]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        style={styles.banner}
        activeOpacity={0.9}
        onPress={() => router.push(target as never)}
        accessibilityRole="button"
        accessibilityLabel="Reprendre la livraison en cours"
      >
        <View style={styles.dotWrap}>
          <View style={styles.dot} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{label}</Text>
          <Text style={styles.sub}>Appuyez pour reprendre</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#fff" />
      </TouchableOpacity>
    </Animated.View>
  );
}

function bannerLabel(role: 'client' | 'driver', status: string): string {
  if (role === 'driver') {
    if (status === 'accepted' || status === 'picking_up') return 'Course en cours · récupération';
    if (status === 'picked_up' || status === 'delivering') return 'Course en cours · livraison';
    return 'Course en cours';
  }
  if (status === 'pending') return 'Recherche d’un livreur…';
  if (status === 'delivered') return 'Notez votre livraison';
  return 'Livraison en cours';
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 14,
    right: 14,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  dotWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#fff' },
  title: { color: '#fff', fontWeight: '800', fontSize: 14.5 },
  sub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 1 },
});
