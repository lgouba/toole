import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  FadeOutUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useConnectionStore } from '@/stores/connection.store';
import { colors, typography, spacing, borderRadius } from '@/theme';

/**
 * Bandeau global affiche en haut de l'app quand le socket temps reel est
 * deconnecte. L'app continue de fonctionner via polling HTTP mais l'utilisateur
 * doit savoir que les notifs in-app et le live tracking sont degradés.
 *
 * Reseau instable : on attend 3s avant d'afficher le banner pour eviter les
 * flashs intempestifs (un micro-coupure peut etre invisible au polling).
 */
const SHOW_DELAY_MS = 3000;

export function ConnectionBanner() {
  const isConnected = useConnectionStore((s) => s.isConnected);
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (isConnected) {
      setShouldShow(false);
      return;
    }
    // On laisse 3s a la socket pour se reconnecter avant d'inquieter l'utilisateur
    const id = setTimeout(() => setShouldShow(true), SHOW_DELAY_MS);
    return () => clearTimeout(id);
  }, [isConnected]);

  // Pulse subtil sur l'icone pour qu'on remarque le banner
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!shouldShow) return;
    pulse.value = withRepeat(
      withTiming(1.2, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [shouldShow]);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  if (!shouldShow) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(250)}
      exiting={FadeOutUp.duration(200)}
      style={styles.wrapper}
      pointerEvents="none"
    >
      <SafeAreaView edges={['top']}>
        <View style={styles.banner}>
          <Animated.View style={pulseStyle}>
            <Ionicons name="cloud-offline" size={16} color={colors.white} />
          </Animated.View>
          <Text style={styles.text}>
            Connexion temps reel perdue — reconnexion en cours...
          </Text>
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: colors.warning,
    borderBottomLeftRadius: borderRadius.md,
    borderBottomRightRadius: borderRadius.md,
    marginHorizontal: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  text: {
    ...typography.captionMedium,
    color: colors.white,
    fontWeight: '700',
    flexShrink: 1,
  },
});
