import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, OtpInput } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { formatCFA } from '@/utils/format';
import { useAuthStore } from '@/stores/auth.store';
import {
  sendWithdrawOtp,
  requestWithdraw,
  sendTopupOtp,
  requestTopup,
} from '@/services/wallet.service';

type Mode = 'withdraw' | 'topup';
type Step = 'amount' | 'phone' | 'otp';

const OPERATORS: {
  key: 'orange_money' | 'moov_money';
  label: string;
  color: string;
}[] = [
  { key: 'orange_money', label: 'Orange Money', color: '#FF7900' },
  { key: 'moov_money', label: 'Moov Money', color: '#0E56B5' },
];

export default function WalletFlowScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; amount?: string }>();
  const mode: Mode = params.mode === 'topup' ? 'topup' : 'withdraw';
  const initialAmount = params.amount ? String(params.amount) : '';
  // Pour un règlement de dette, le montant est impose (= dette totale).
  // Le livreur ne peut pas payer partiellement : il a déjà encaisse le cash.
  const amountLocked = mode === 'topup' && !!initialAmount;

  const user = useAuthStore((s) => s.user);

  // Si montant verrouille (cas du reglement de dette), on saute directement
  // a l'etape 2 (phone). Sinon on demarre par la saisie du montant.
  const [step, setStep] = useState<Step>(amountLocked ? 'phone' : 'amount');
  const [amount, setAmount] = useState(initialAmount);
  const [operator, setOperator] = useState<'orange_money' | 'moov_money' | null>(
    null,
  );
  const [phone, setPhone] = useState(
    user?.phone
      ? user.phone.replace(/^226/, '').replace(/\D/g, '').slice(0, 8)
      : '',
  );
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const title = mode === 'withdraw' ? 'Retrait' : 'Règlement de dette';
  const subtitleTop =
    mode === 'withdraw'
      ? 'Retrait des gains vers Mobile Money'
      : 'Paiement de la commission plateforme';

  const formattedPhoneForInput = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    const parts = digits.match(/.{1,2}/g) ?? [];
    return parts.join(' ');
  };

  const phoneDigits = phone.replace(/\D/g, '');
  const phoneValid = phoneDigits.length === 8;
  const amountValid = parseInt(amount || '0', 10) > 0;

  // --- Actions ---

  const goToPhone = () => {
    setError('');
    if (!amountValid) {
      setError('Montant invalide');
      return;
    }
    setStep('phone');
  };

  const sendOtp = async () => {
    setError('');
    if (!phoneValid) {
      setError('Numéro invalide (8 chiffres requis)');
      return;
    }
    if (!operator) {
      setError('Choisissez un opérateur');
      return;
    }
    setLoading(true);
    try {
      const fullPhone = `226${phoneDigits}`;
      if (mode === 'withdraw') {
        await sendWithdrawOtp(fullPhone);
      } else {
        await sendTopupOtp(fullPhone);
      }
      setStep('otp');
    } catch (err: any) {
      Alert.alert(
        'Erreur',
        err?.response?.data?.error?.message ??
          "Impossible d'envoyer le code. Réessayez.",
      );
    } finally {
      setLoading(false);
    }
  };

  const submitOtp = async (code: string) => {
    if (loading) return;
    setError('');
    if (!operator) return;
    setLoading(true);
    try {
      const args = {
        amount: parseInt(amount, 10),
        phone: `226${phoneDigits}`,
        paymentMethod: operator,
        otpCode: code,
      };
      if (mode === 'withdraw') {
        await requestWithdraw(args);
      } else {
        await requestTopup(args);
      }
      Alert.alert(
        mode === 'withdraw' ? 'Demande enregistrée' : 'Paiement enregistré',
        mode === 'withdraw'
          ? 'Votre demande de retrait est en cours de traitement. Vous recevrez votre paiement sous peu.'
          : 'Votre paiement est en attente de validation. Votre dette sera régularisée après confirmation.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ??
        (err?.response?.status === 400
          ? 'Code incorrect ou opération invalide'
          : 'Une erreur est survenue');
      setError(msg);
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setError('');
    if (step === 'otp') return setStep('phone');
    if (step === 'phone' && !amountLocked) return setStep('amount');
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerSub}>{subtitleTop}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.progress}>
        <View
          style={[
            styles.progressFill,
            {
              width: amountLocked
                ? step === 'phone'
                  ? '50%'
                  : '100%'
                : step === 'amount'
                  ? '33%'
                  : step === 'phone'
                    ? '66%'
                    : '100%',
            },
          ]}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Étape 1 : montant */}
          {step === 'amount' && (
            <>
              <Text style={styles.stepTitle}>
                {mode === 'withdraw'
                  ? 'Combien voulez-vous retirer ?'
                  : 'Combien voulez-vous régler ?'}
              </Text>
              <Text style={styles.stepHint}>Entrez le montant en FCFA</Text>

              <View style={styles.amountContainer}>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                  value={amount}
                  onChangeText={(t) => setAmount(t.replace(/\D/g, '').slice(0, 10))}
                  autoFocus
                  textAlign="center"
                />
                <Text style={styles.amountCurrency}>FCFA</Text>
              </View>

              {/* Suggestions de montants rapides */}
              <View style={styles.quickAmountsRow}>
                {[1000, 2000, 5000, 10000].map((v) => (
                  <TouchableOpacity
                    key={v}
                    style={styles.quickAmountChip}
                    onPress={() => setAmount(String(v))}
                  >
                    <Text style={styles.quickAmountText}>
                      {formatCFA(v)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}
            </>
          )}

          {/* Étape 2 : opérateur + numéro */}
          {step === 'phone' && (
            <>
              {amountLocked ? (
                <View style={styles.lockedAmountCard}>
                  <Text style={styles.lockedAmountLabel}>
                    Montant à régler
                  </Text>
                  <Text style={styles.lockedAmountValue}>
                    {formatCFA(parseInt(amount, 10))}
                  </Text>
                  <Text style={styles.lockedAmountHint}>
                    Correspond à la totalité de votre dette commission. Vous ne
                    pouvez pas régler partiellement.
                  </Text>
                </View>
              ) : null}

              <Text style={styles.stepTitle}>Compte Mobile Money</Text>
              <Text style={styles.stepHint}>
                {mode === 'withdraw'
                  ? "Numéro qui recevra l'argent"
                  : "Numéro depuis lequel vous paierez"}
              </Text>

              {/* Opérateurs */}
              <View style={styles.operatorsRow}>
                {OPERATORS.map((op) => (
                  <TouchableOpacity
                    key={op.key}
                    style={[
                      styles.operatorCard,
                      operator === op.key && {
                        borderColor: op.color,
                        backgroundColor: op.color + '15',
                      },
                    ]}
                    onPress={() => setOperator(op.key)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.operatorBadge,
                        { backgroundColor: op.color },
                      ]}
                    >
                      <Text style={styles.operatorBadgeText}>
                        {op.label.charAt(0)}
                      </Text>
                    </View>
                    <Text style={styles.operatorLabel}>{op.label}</Text>
                    {operator === op.key ? (
                      <View style={[styles.checkmark, { backgroundColor: op.color }]}>
                        <Ionicons
                          name="checkmark"
                          size={12}
                          color={colors.white}
                        />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Numéro */}
              <Text style={styles.fieldLabel}>Numéro</Text>
              <View style={styles.phoneRow}>
                <View style={styles.phonePrefix}>
                  <Text style={styles.phonePrefixText}>+226</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="70 12 34 56"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                  value={formattedPhoneForInput(phone)}
                  onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 8))}
                  maxLength={11}
                />
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}
            </>
          )}

          {/* Étape 3 : OTP */}
          {step === 'otp' && (
            <>
              <Text style={styles.stepTitle}>Code de confirmation</Text>
              <Text style={styles.stepHint}>
                Saisissez le code à 4 chiffres envoyé au{'\n'}
                <Text style={{ fontWeight: '700', color: colors.textPrimary }}>
                  +226 {formattedPhoneForInput(phone)}
                </Text>
              </Text>
              <Text style={styles.devHint}>Code test : 1234</Text>

              <View style={{ marginTop: spacing.lg }}>
                <OtpInput
                  length={4}
                  value={otp}
                  onChange={setOtp}
                  onComplete={submitOtp}
                />
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.summaryBox}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Montant</Text>
                  <Text style={styles.summaryValue}>
                    {formatCFA(parseInt(amount, 10))}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Opérateur</Text>
                  <Text style={styles.summaryValue}>
                    {OPERATORS.find((o) => o.key === operator)?.label}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Numéro</Text>
                  <Text style={styles.summaryValue}>
                    +226 {formattedPhoneForInput(phone)}
                  </Text>
                </View>
              </View>
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          {step === 'amount' && (
            <Button
              title="Continuer"
              onPress={goToPhone}
              disabled={!amountValid}
            />
          )}
          {step === 'phone' && (
            <Button
              title="Envoyer le code"
              onPress={sendOtp}
              loading={loading}
              disabled={!phoneValid || !operator}
            />
          )}
          {step === 'otp' && (
            <Button
              title={mode === 'withdraw' ? 'Confirmer le retrait' : 'Confirmer le paiement'}
              onPress={() => submitOtp(otp)}
              loading={loading}
              disabled={otp.length !== 4}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: { padding: 4 },
  headerTitle: { ...typography.bodyMedium, color: colors.textPrimary, fontWeight: '700' },
  headerSub: { ...typography.caption, color: colors.textSecondary },
  progress: {
    height: 3,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.primary },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  stepTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.sm },
  stepHint: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  devHint: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  amountContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  amountInput: {
    fontSize: 64,
    fontWeight: '800',
    color: colors.textPrimary,
    paddingVertical: 4,
    paddingHorizontal: 0,
    // Largeur auto : l'input s'elargit selon la saisie
    minWidth: 80,
    maxWidth: '100%',
    textAlign: 'center',
    // Pas de border pour un effet "display" plutot que input
    borderWidth: 0,
  },
  amountCurrency: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 4,
  },
  quickAmountsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  quickAmountChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickAmountText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  lockedAmountCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: 'center',
  },
  lockedAmountLabel: {
    ...typography.caption,
    color: colors.error,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lockedAmountValue: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.error,
    marginTop: spacing.xs,
  },
  lockedAmountHint: {
    ...typography.caption,
    color: '#8a3a1f',
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  operatorsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  operatorCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    position: 'relative',
  },
  operatorBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  operatorBadgeText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 16,
  },
  operatorLabel: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  checkmark: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  phonePrefix: {
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  phonePrefixText: { ...typography.body, color: colors.textPrimary },
  phoneInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    ...typography.body,
    color: colors.textPrimary,
  },
  summaryBox: {
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    gap: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: { ...typography.bodySmall, color: colors.textSecondary },
  summaryValue: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '600' },
  error: {
    ...typography.bodySmall,
    color: colors.error,
    marginTop: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
});
