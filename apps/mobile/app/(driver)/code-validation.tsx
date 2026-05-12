import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Button, OtpInput } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useDriverStore } from '@/stores/driver.store';
import { haptic } from '@/utils/haptics';
import { alertConfirmSuccess } from '@/utils/alerts';
import { openPhone } from '@/utils/linking';

/**
 * Ecran de saisie du code de livraison.
 *
 * Meme charte visuelle que pickup-confirm : header, encart destinataire,
 * step-card avec OtpInput. Le code est valide cote serveur, et apres succes
 * on redirige vers delivery-confirm pour la photo + confirmation finale.
 */
export default function CodeValidationScreen() {
  const router = useRouter();
  const { validateCode, activeDelivery } = useDriverStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const recipientName = activeDelivery?.recipientName;
  const recipientPhone = activeDelivery?.recipientPhone;
  const codeDone = code.length === 4;
  const blocked = attempts >= 3;

  const handleSubmit = async () => {
    if (!codeDone || submitting || blocked) return;
    setSubmitting(true);
    setError('');
    try {
      const success = await validateCode(code);
      if (success) {
        alertConfirmSuccess();
        router.replace('/(driver)/delivery-confirm');
      } else {
        haptic.error();
        setCode('');
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        if (newAttempts >= 3) {
          setError('Trop de tentatives. Contactez le support.');
        } else {
          setError(
            `Code incorrect (${3 - newAttempts} tentative(s) restante(s))`,
          );
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Validation automatique des que les 4 chiffres sont saisis
  useEffect(() => {
    if (codeDone && !submitting && !blocked) {
      handleSubmit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Livraison du colis</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Encart destinataire */}
        {recipientName && (
          <Animated.View
            entering={FadeInDown.duration(350).delay(50)}
            style={styles.recipientCard}
          >
            <View style={styles.recipientAvatar}>
              <Ionicons name="person" size={24} color={colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.recipientLabel}>Destinataire du colis</Text>
              <Text style={styles.recipientName}>{recipientName}</Text>
            </View>
            {recipientPhone && (
              <TouchableOpacity
                style={styles.callBtn}
                onPress={() => openPhone(recipientPhone)}
              >
                <Ionicons name="call" size={20} color={colors.primary} />
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

        {/* Etape unique - Code de livraison */}
        <Animated.View
          entering={FadeInDown.duration(350).delay(120)}
          style={[
            styles.stepCard,
            codeDone && !error && styles.stepCardDone,
            !codeDone && styles.stepCardCurrent,
          ]}
        >
          <View style={styles.stepHeader}>
            <StepBadge done={codeDone && !error} />
            <Text style={styles.stepTitle}>Code de livraison</Text>
            {codeDone && !error && <CheckPulse />}
          </View>
          <Text style={styles.stepHint}>
            {recipientName
              ? `Demandez a ${recipientName} le code a 4 chiffres recu lors de la creation de la commande.`
              : 'Demandez au destinataire le code a 4 chiffres recu lors de la creation de la commande.'}
          </Text>
          <View style={styles.otpWrap}>
            <OtpInput
              length={4}
              value={code}
              onChange={(v) => {
                setError('');
                setCode(v);
              }}
            />
          </View>

          {error ? (
            <Animated.View
              entering={FadeIn.duration(200)}
              style={styles.errorBox}
            >
              <Ionicons
                name="alert-circle"
                size={18}
                color={colors.error}
              />
              <Text style={styles.errorText}>{error}</Text>
            </Animated.View>
          ) : null}
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={blocked ? 'Bloque' : 'Valider le code'}
          onPress={handleSubmit}
          disabled={!codeDone || blocked}
          loading={submitting}
        />
      </View>
    </SafeAreaView>
  );
}

function StepBadge({ done }: { done: boolean }) {
  return (
    <View style={[styles.badge, done && styles.badgeDone]}>
      {done ? (
        <Ionicons name="checkmark" size={16} color={colors.white} />
      ) : (
        <Ionicons name="lock-closed" size={14} color={colors.textSecondary} />
      )}
    </View>
  );
}

function CheckPulse() {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.15, {
        duration: 900,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[styles.checkPulse, style]}
    >
      <Ionicons name="checkmark-circle" size={22} color={colors.success} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primaryLight,
  },
  recipientAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipientLabel: {
    ...typography.caption,
    color: colors.primaryDark,
  },
  recipientName: {
    ...typography.bodyMedium,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCard: {
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  stepCardCurrent: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  stepCardDone: {
    borderColor: colors.successLight,
    backgroundColor: '#F4FBF5',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  stepTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
  },
  checkPulse: {},
  stepHint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  otpWrap: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    backgroundColor: '#FEF2F2',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    flex: 1,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
