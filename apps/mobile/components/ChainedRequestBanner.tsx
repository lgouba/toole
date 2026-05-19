import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDriverStore } from '@/stores/driver.store';
import { colors, typography, spacing, borderRadius } from '@/theme';

/**
 * Banniere non-bloquante affichee quand une course "chainee" (style Uber)
 * arrive alors que le livreur est encore sur une course active.
 * - "Voir" = promouvoir en modal pleine (NewRequestModal s'affiche)
 * - "Refuser" = dismiss (la course retournera dans le pool serveur)
 *
 * La banniere disparait automatiquement quand activeDelivery devient null
 * (la course chainee est promue en currentRequest via la modal pleine).
 */
export function ChainedRequestBanner() {
  const insets = useSafeAreaInsets();
  const queued = useDriverStore((s) => s.queuedNextRequest);
  const activeDelivery = useDriverStore((s) => s.activeDelivery);
  const promote = useDriverStore((s) => s.promoteQueuedRequest);
  const dismiss = useDriverStore((s) => s.dismissQueuedRequest);

  const translateY = useRef(new Animated.Value(-200)).current;

  // Ne montrer que si une course est active ET qu'on a une queued.
  const visible = Boolean(queued && activeDelivery);

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : -200,
      useNativeDriver: true,
      friction: 8,
      tension: 60,
    }).start();
  }, [visible, translateY]);

  if (!queued) return null;

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.container,
        { paddingTop: insets.top + spacing.xs, transform: [{ translateY }] },
      ]}
    >
      <View style={styles.card}>
        <View style={styles.iconBubble}>
          <Ionicons name="flash" size={20} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Prochaine course disponible</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {queued.pickupAddress}
          </Text>
        </View>
        <TouchableOpacity
          onPress={dismiss}
          style={styles.btnDismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={promote} style={styles.btnView}>
          <Text style={styles.btnViewText}>Voir</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    paddingRight: spacing.xs,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 8 },
    }),
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconBubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.captionMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  btnDismiss: {
    padding: spacing.xs,
  },
  btnView: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.md,
  },
  btnViewText: {
    ...typography.captionMedium,
    color: colors.white,
    fontWeight: '700',
  },
});
