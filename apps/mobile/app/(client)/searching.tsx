import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Button } from '@/components/ui';
import { colors, typography, spacing } from '@/theme';
import { useDeliveryStore } from '@/stores/delivery.store';

const SEARCH_TIMEOUT_SECONDS = 180; // 3 minutes

export default function SearchingScreen() {
  const router = useRouter();
  const { activeDelivery, clear } = useDeliveryStore();

  const [remaining, setRemaining] = useState(SEARCH_TIMEOUT_SECONDS);
  const [expired, setExpired] = useState(false);
  const hasNavigatedRef = useRef(false);

  // Animation du pulse
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(2.2, { duration: 1600, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );
    opacity.value = withRepeat(
      withTiming(0, { duration: 1600, easing: Easing.out(Easing.ease) }),
      -1,
      false,
    );
  }, []);

  // Countdown et timeout
  useEffect(() => {
    if (expired) return;
    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [expired]);

  // Quand un livreur accepte (via Socket.IO, le store est mis a jour)
  useEffect(() => {
    if (hasNavigatedRef.current) return;
    if (activeDelivery && activeDelivery.status === 'accepted') {
      hasNavigatedRef.current = true;
      router.replace('/(client)/active-delivery');
    }
  }, [activeDelivery?.status]);

  const handleCancel = () => {
    clear();
    router.replace('/(client)');
  };

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const timerStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  if (expired) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Ionicons name="alert-circle-outline" size={64} color={colors.warning} />
          </View>
          <Text style={styles.title}>Aucun livreur disponible</Text>
          <Text style={styles.subtitle}>
            Aucun livreur n'a accepte votre course. Reessayez plus tard ou ajustez votre demande.
          </Text>
        </View>
        <View style={styles.footer}>
          <Button title="Retour a l'accueil" onPress={handleCancel} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.pulseContainer}>
          <Animated.View style={[styles.pulse, pulseStyle]} />
          <View style={styles.centerDot}>
            <Ionicons name="bicycle" size={36} color={colors.white} />
          </View>
        </View>

        <Text style={styles.title}>Recherche d'un livreur...</Text>
        <Text style={styles.subtitle}>
          Nous alertons les livreurs proches de votre point de recuperation.
        </Text>

        <View style={styles.timerBox}>
          <Text style={styles.timerLabel}>Temps restant</Text>
          <Text style={styles.timerValue}>{timerStr}</Text>
        </View>

        {activeDelivery && (
          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>Reference</Text>
            <Text style={styles.infoValue}>{activeDelivery.reference}</Text>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Button title="Annuler la recherche" variant="outline" onPress={handleCancel} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  pulseContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  pulse: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
  },
  centerDot: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
  },
  timerBox: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  timerLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  timerValue: {
    ...typography.h3,
    color: colors.primary,
    marginTop: 2,
  },
  infoBox: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  infoValue: {
    ...typography.captionMedium,
    color: colors.textSecondary,
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
