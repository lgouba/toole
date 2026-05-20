import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '@/theme';

interface Props {
  visible: boolean;
  method: 'orange_money' | 'moov_money';
  amount: number;
  onCancel: () => void;
  onSuccess: () => void;
}

/**
 * Modal qui simule le paiement Mobile Money :
 * - Affiche l'instruction USSD a composer sur le telephone.
 * - Demande un code OTP de confirmation.
 *
 * Tant que l'integration PSP reelle n'est pas branchee, l'OTP **0000** est
 * accepte en mode demo (configurable via env si besoin). Tout autre code est
 * rejete. Une fois validé, on appelle `onSuccess` qui declenche la creation
 * effective de la livraison.
 */
export function PaymentOtpModal({
  visible,
  method,
  amount,
  onCancel,
  onSuccess,
}: Props) {
  const [otp, setOtp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOrange = method === 'orange_money';
  const ussd = isOrange
    ? `*144*4*6*${amount}#` // exemple Orange Money BF (a adapter selon le code marchand reel)
    : `*155*1*${amount}#`; // exemple Moov Money BF
  const label = isOrange ? 'Orange Money' : 'Moov Money';
  const color = isOrange ? '#FF6600' : '#0066CC';

  async function submit() {
    setError(null);
    setSubmitting(true);
    // Simulation : on accepte 0000 comme OTP demo, tout le reste echoue.
    await new Promise((r) => setTimeout(r, 800));
    setSubmitting(false);
    if (otp.trim() === '0000') {
      setOtp('');
      onSuccess();
      return;
    }
    setError('Code incorrect. En mode demo, utilisez 0000.');
  }

  function cancel() {
    setOtp('');
    setError(null);
    onCancel();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={cancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.backdrop}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.card}>
          <View style={[styles.header, { backgroundColor: color }]}>
            <Ionicons name="lock-closed" size={20} color={colors.white} />
            <Text style={styles.headerText}>Paiement {label}</Text>
          </View>

          <View style={styles.body}>
            <Text style={styles.amount}>
              {amount.toLocaleString('fr-FR')} FCFA
            </Text>

            <View style={styles.step}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>1</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>
                  Composez sur votre téléphone
                </Text>
                <View style={styles.ussdBox}>
                  <Text style={styles.ussdText}>{ussd}</Text>
                </View>
                <Text style={styles.stepHint}>
                  Suivez les instructions de votre opérateur pour confirmer le
                  paiement.
                </Text>
              </View>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>2</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>
                  Entrez le code reçu par SMS
                </Text>
                <TextInput
                  style={styles.otpInput}
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="0000"
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />
                <Text style={styles.demoHint}>
                  Mode démo : utilisez <Text style={{ fontWeight: '700' }}>0000</Text>
                </Text>
              </View>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={cancel}
                disabled={submitting}
              >
                <Text style={styles.btnCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnConfirm, { backgroundColor: color }]}
                onPress={submit}
                disabled={submitting || otp.length < 4}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.btnConfirmText}>Valider</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </ScrollView>
      </View>
      </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  headerText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '700',
  },
  body: {
    padding: spacing.md,
    gap: spacing.md,
  },
  amount: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '800',
    textAlign: 'center',
  },
  step: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 14,
  },
  stepTitle: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  ussdBox: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginTop: spacing.xs,
    alignItems: 'center',
  },
  ussdText: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 1,
    fontFamily: 'monospace',
  },
  stepHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 4,
  },
  otpInput: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
    fontSize: 20,
    textAlign: 'center',
    fontWeight: '700',
    letterSpacing: 4,
    color: colors.textPrimary,
  },
  demoHint: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  error: {
    ...typography.bodySmall,
    color: colors.error,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  btnCancel: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  btnCancelText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  btnConfirm: {
    flex: 2,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  btnConfirmText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '700',
  },
});
