import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withDelay,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Button, Card, Rating, Avatar } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useDeliveryStore } from '@/stores/delivery.store';
import { formatCFA } from '@/utils/format';
import { rateDelivery } from '@/services/delivery.service';
import { resolveUploadUrl } from '@/services/upload.service';

export default function DeliveryCompleteScreen() {
  const router = useRouter();
  const { activeDelivery, activeDriver, clear } = useDeliveryStore();
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Anim: success check bounce
  const checkScale = useSharedValue(0);
  const checkOpacity = useSharedValue(0);

  useEffect(() => {
    checkOpacity.value = withTiming(1, { duration: 200 });
    checkScale.value = withSequence(
      withSpring(1.2, { damping: 5, stiffness: 130 }),
      withSpring(1, { damping: 10, stiffness: 140 }),
    );
    // Haptic succes a l'ouverture
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    }
  }, []);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkOpacity.value,
  }));

  const handleDone = () => {
    clear();
    router.replace('/(client)');
  };

  const handleSubmit = async () => {
    if (score === 0 || !activeDelivery) return;
    setSubmitting(true);
    try {
      await rateDelivery(activeDelivery.id, score, comment.trim() || undefined);
      setSubmitted(true);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      }
      // Auto-retour apres 1.8s
      setTimeout(() => handleDone(), 1800);
    } catch (err: any) {
      Alert.alert(
        'Erreur',
        err?.response?.data?.error?.message ??
          'Impossible d\'envoyer la note. Reessayez.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    Alert.alert(
      'Passer sans noter ?',
      'Votre avis aide les autres utilisateurs a choisir un livreur de confiance.',
      [
        { text: 'Continuer', style: 'cancel' },
        { text: 'Passer', style: 'destructive', onPress: handleDone },
      ],
    );
  };

  const avatarUri = activeDriver
    ? resolveUploadUrl(activeDriver.avatarUrl ?? null)
    : null;

  // --- Vue confirmation apres envoi ---
  if (submitted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.thanksWrap}>
          {score >= 4 ? <Confetti /> : null}
          <View style={styles.thanksIconBg}>
            <Ionicons name="heart" size={60} color={colors.primary} />
          </View>
          <Text style={styles.thanksTitle}>Merci pour votre avis !</Text>
          <Text style={styles.thanksText}>
            {score === 5
              ? 'Top ! Ca aide vraiment la communaute.'
              : score >= 4
                ? 'Super, on transmet au livreur.'
                : score === 3
                  ? 'Noted. Vos retours nous aident a progresser.'
                  : 'Desole pour cette experience. On va regarder ca.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={[styles.successIconWrap, checkStyle]}>
          <View style={styles.successIconBg}>
            <Ionicons name="checkmark" size={60} color={colors.white} />
          </View>
        </Animated.View>

        <Text style={styles.title}>Livraison confirmée !</Text>
        <Text style={styles.subtitle}>
          Votre colis a bien été remis au destinataire
        </Text>

        {activeDelivery ? (
          <Card style={styles.summary}>
            <View style={styles.row}>
              <Text style={styles.label}>Reference</Text>
              <Text style={styles.value}>{activeDelivery.reference}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Destinataire</Text>
              <Text style={styles.value}>{activeDelivery.recipientName}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Montant</Text>
              <Text style={styles.valueGreen}>
                {formatCFA(activeDelivery.price)}
              </Text>
            </View>
          </Card>
        ) : null}

        {activeDriver ? (
          <View style={styles.ratingSection}>
            <View style={styles.driverRow}>
              <Avatar
                name={activeDriver.fullName}
                uri={avatarUri ?? undefined}
                size="lg"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.driverName}>{activeDriver.fullName}</Text>
                <Text style={styles.driverHint}>Comment s'est passée la course ?</Text>
              </View>
            </View>

            <Rating value={score} onChange={setScore} size={44} />

            {score > 0 ? (
              <View style={styles.commentWrap}>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Un commentaire (optionnel)..."
                  placeholderTextColor={colors.textTertiary}
                  value={comment}
                  onChangeText={setComment}
                  multiline
                  maxLength={250}
                  numberOfLines={3}
                />
                <Text style={styles.commentCount}>{comment.length}/250</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {score > 0 ? (
          <Button
            title="Envoyer mon avis"
            onPress={handleSubmit}
            loading={submitting}
          />
        ) : (
          <Button title="Terminer" onPress={handleSkip} variant="ghost" />
        )}
      </View>
    </SafeAreaView>
  );
}

// --------- Confetti animation ---------

const CONFETTI_COUNT = 24;
const CONFETTI_COLORS = [
  '#ef4444',
  '#f59e0b',
  '#eab308',
  '#22c55e',
  '#3b82f6',
  '#a855f7',
  '#ec4899',
];

function Confetti() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      {Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
        <ConfettiPiece key={i} index={i} />
      ))}
    </View>
  );
}

function ConfettiPiece({ index }: { index: number }) {
  const translateY = useSharedValue(-50);
  const translateX = useSharedValue(0);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);

  // Random deterministic per index
  const startX = (index / CONFETTI_COUNT) * 100;
  const drift = (Math.sin(index * 1.7) * 60);
  const delay = (index % 6) * 120;
  const duration = 2800 + (index % 4) * 400;
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withTiming(700, { duration, easing: Easing.in(Easing.quad) }),
    );
    translateX.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(drift, { duration: 800 }),
          withTiming(-drift, { duration: 800 }),
        ),
        -1,
        true,
      ),
    );
    rotate.value = withDelay(
      delay,
      withRepeat(withTiming(360, { duration: 1400 }), -1, false),
    );
    opacity.value = withDelay(
      delay + duration - 500,
      withTiming(0, { duration: 500 }),
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.confettiPiece,
        { left: `${startX}%`, backgroundColor: color },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  successIconWrap: {
    marginBottom: spacing.lg,
  },
  successIconBg: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 8,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  summary: {
    width: '100%',
    marginBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  label: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  value: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  valueGreen: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '700',
  },
  ratingSection: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
  },
  driverName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  driverHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  commentWrap: {
    width: '100%',
  },
  commentInput: {
    width: '100%',
    minHeight: 70,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    ...typography.bodySmall,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  commentCount: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'right',
    marginTop: 4,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  // --- Thanks screen ---
  thanksWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  thanksIconBg: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  thanksTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  thanksText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.lg,
  },
  // --- Confetti ---
  confettiPiece: {
    position: 'absolute',
    top: 0,
    width: 8,
    height: 14,
    borderRadius: 2,
  },
});
