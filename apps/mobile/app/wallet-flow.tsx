import React, { useState } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { OtpInput } from '@/components/ui';
import { MethodCard } from '@/components/delivery/step4/MethodCard';
import { recap as R, step4 as S } from '@/theme/recapTokens';
import { formatCFA } from '@/utils/format';
import { useAuthStore } from '@/stores/auth.store';
import {
  sendWithdrawOtp,
  requestWithdraw,
  sendTopupOtp,
  requestTopup,
} from '@/services/wallet.service';

/**
 * Écran retrait / règlement de dette du livreur.
 *
 * Refonte visuelle alignée sur les écrans de paiement client
 * (`components/delivery/step4/*`) : canvas crème, titres Archivo, montant en
 * mono, choix opérateur via <MethodCard variant="orange|moov">, OTP via
 * <OtpInput>, CTA vert plein. La LOGIQUE (machine à 3 états, modes
 * withdraw/topup, params, appels service OTP/retrait/topup) est conservée
 * telle quelle — seul le rendu change.
 */

type Mode = 'withdraw' | 'topup';
type Step = 'amount' | 'phone' | 'otp';

const OPERATORS: {
  key: 'orange_money' | 'moov_money';
  label: string;
  variant: 'orange' | 'moov';
}[] = [
  { key: 'orange_money', label: 'Orange Money', variant: 'orange' },
  { key: 'moov_money', label: 'Moov Money', variant: 'moov' },
];

export default function WalletFlowScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; amount?: string; max?: string }>();
  const mode: Mode = params.mode === 'topup' ? 'topup' : 'withdraw';
  const initialAmount = params.amount ? String(params.amount) : '';
  // Max disponible passe en query string par l'ecran wallet (= walletBalance).
  // Utilise pour valider localement et afficher le plafond.
  const maxAmount = params.max ? parseInt(String(params.max), 10) : 0;
  // Pour un règlement de dette, le montant est impose (= dette totale).
  // Le livreur ne peut pas payer partiellement : il a déjà encaisse le cash.
  const amountLocked = mode === 'topup' && !!initialAmount;

  const user = useAuthStore((s) => s.user);

  // Si montant verrouille (cas du reglement de dette), on saute directement
  // a l'étape 2 (phone). Sinon on démarré par la saisie du montant.
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
    const value = parseInt(amount || '0', 10);
    if (!amountValid) {
      setError('Montant invalide');
      return;
    }
    if (mode === 'withdraw' && maxAmount > 0 && value > maxAmount) {
      setError(`Maximum disponible : ${formatCFA(maxAmount)}`);
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

  // Largeur de la barre de progression selon l'étape.
  const progress = amountLocked
    ? step === 'phone'
      ? '50%'
      : '100%'
    : step === 'amount'
      ? '33%'
      : step === 'phone'
        ? '66%'
        : '100%';

  const operatorLabel = OPERATORS.find((o) => o.key === operator)?.label;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* En-tête : retour + titre + sous-titre */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={24} color={S.textPrim} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerTitle}>{title}</Text>
          <Text style={styles.headerSub}>{subtitleTop}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.progress}>
        <View style={[styles.progressFill, { width: progress }]} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Étape 1 : montant ── */}
          {step === 'amount' && (
            <>
              <Text style={styles.stepTitle}>
                {mode === 'withdraw'
                  ? 'Combien voulez-vous retirer ?'
                  : 'Combien voulez-vous régler ?'}
              </Text>
              <Text style={styles.stepHint}>
                {mode === 'withdraw' && maxAmount > 0
                  ? `Maximum disponible : ${formatCFA(maxAmount)}`
                  : 'Entrez le montant en FCFA'}
              </Text>

              {/* Saisie montant — carte blanche, chiffre en mono */}
              <View style={styles.amountCard}>
                <View style={styles.amountRow}>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="0"
                    placeholderTextColor={S.textMuted}
                    keyboardType="number-pad"
                    value={amount}
                    onChangeText={(t) => setAmount(t.replace(/\D/g, '').slice(0, 10))}
                    autoFocus
                    textAlign="center"
                  />
                  <Text style={styles.amountCurrency}>FCFA</Text>
                </View>
              </View>

              {/* Suggestions de montants rapides. En mode withdraw, on filtre
                  les valeurs > maxAmount et on ajoute un bouton "Tout retirer". */}
              <View style={styles.chipsRow}>
                {(mode === 'withdraw' && maxAmount > 0
                  ? [1000, 2000, 5000, 10000].filter((v) => v <= maxAmount)
                  : [1000, 2000, 5000, 10000]
                ).map((v) => (
                  <TouchableOpacity
                    key={v}
                    style={styles.chip}
                    onPress={() => setAmount(String(v))}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.chipText}>{formatCFA(v)}</Text>
                  </TouchableOpacity>
                ))}
                {mode === 'withdraw' && maxAmount > 0 && (
                  <TouchableOpacity
                    style={[styles.chip, styles.chipAll]}
                    onPress={() => setAmount(String(maxAmount))}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, styles.chipAllText]}>
                      Tout ({formatCFA(maxAmount)})
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}
            </>
          )}

          {/* ── Étape 2 : opérateur + numéro ── */}
          {step === 'phone' && (
            <>
              {amountLocked ? (
                <View style={styles.lockedCard}>
                  <Text style={styles.lockedLabel}>Montant à régler</Text>
                  <Text style={styles.lockedValue}>
                    {formatCFA(parseInt(amount || '0', 10))}
                  </Text>
                  <Text style={styles.lockedHint}>
                    Correspond à la totalité de votre dette commission. Vous ne
                    pouvez pas régler partiellement.
                  </Text>
                </View>
              ) : (
                <View style={styles.amountRecap}>
                  <Text style={styles.amountRecapLabel}>
                    {mode === 'withdraw' ? 'Montant à retirer' : 'Montant'}
                  </Text>
                  <Text style={styles.amountRecapValue}>
                    {formatCFA(parseInt(amount || '0', 10))}
                  </Text>
                </View>
              )}

              <Text style={styles.section}>
                {mode === 'withdraw' ? 'OÙ RECEVOIR L’ARGENT ?' : 'COMMENT PAYER ?'}
              </Text>

              {/* Opérateurs — mêmes cartes que le paiement client */}
              <View style={{ gap: R.space.sm }}>
                {OPERATORS.map((op) => (
                  <MethodCard
                    key={op.key}
                    variant={op.variant}
                    title={op.label}
                    subtitle={
                      mode === 'withdraw'
                        ? 'Vous recevrez l’argent sur ce compte'
                        : 'Paiement mobile sécurisé'
                    }
                    selected={operator === op.key}
                    onPress={() => setOperator(op.key)}
                  />
                ))}
              </View>

              {/* Numéro Mobile Money */}
              <Text style={styles.fieldLabel}>
                {mode === 'withdraw'
                  ? 'Numéro qui recevra l’argent'
                  : 'Numéro depuis lequel vous paierez'}
              </Text>
              <View style={styles.phoneRow}>
                <View style={styles.phonePrefix}>
                  <Text style={styles.phonePrefixText}>+226</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="70 12 34 56"
                  placeholderTextColor={S.textMuted}
                  keyboardType="number-pad"
                  value={formattedPhoneForInput(phone)}
                  onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 8))}
                  maxLength={11}
                />
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}
            </>
          )}

          {/* ── Étape 3 : OTP ── */}
          {step === 'otp' && (
            <>
              <Text style={styles.stepTitle}>Code de confirmation</Text>
              <Text style={styles.stepHint}>
                Saisissez le code à 4 chiffres envoyé au{'\n'}
                <Text style={styles.phoneStrong}>
                  +226 {formattedPhoneForInput(phone)}
                </Text>
              </Text>

              <View style={{ marginTop: R.space.gut, marginBottom: R.space.md }}>
                <OtpInput
                  length={4}
                  value={otp}
                  onChange={setOtp}
                  onComplete={submitOtp}
                />
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              {/* Récapitulatif de l'opération */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Montant</Text>
                  <Text style={styles.summaryValue}>
                    {formatCFA(parseInt(amount || '0', 10))}
                  </Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Opérateur</Text>
                  <Text style={styles.summaryValue}>{operatorLabel}</Text>
                </View>
                <View style={styles.summaryDivider} />
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

        {/* CTA vert plein, posé en bas */}
        <View style={styles.footer}>
          {step === 'amount' && (
            <CtaButton title="Continuer" onPress={goToPhone} disabled={!amountValid} />
          )}
          {step === 'phone' && (
            <CtaButton
              title="Envoyer le code"
              onPress={sendOtp}
              loading={loading}
              disabled={!phoneValid || !operator}
            />
          )}
          {step === 'otp' && (
            <CtaButton
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

/** CTA vert plein, aligné sur le bouton "Valider le paiement" du flux client. */
function CtaButton({
  title,
  onPress,
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const off = disabled || loading;
  return (
    <TouchableOpacity
      style={[styles.cta, off && styles.ctaOff]}
      onPress={onPress}
      disabled={off}
      activeOpacity={0.9}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Text style={styles.ctaText}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: S.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: R.space.gut,
    paddingVertical: R.space.sm,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontFamily: R.font.display, fontSize: 18, color: S.textPrim },
  headerSub: { fontFamily: R.font.body, fontSize: 12, color: S.textMuted, marginTop: 1 },
  progress: {
    height: 4,
    backgroundColor: S.border,
    marginHorizontal: R.space.gut,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: S.green, borderRadius: 2 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: R.space.gut,
    paddingTop: R.space.gut,
    paddingBottom: R.space.gut,
  },

  stepTitle: { fontFamily: R.font.display, fontSize: 20, color: S.textPrim },
  stepHint: {
    fontFamily: R.font.body,
    fontSize: 13,
    color: S.textSec,
    marginTop: 4,
    lineHeight: 18,
  },
  phoneStrong: { fontFamily: R.font.bodyBold, color: S.textPrim },

  // Saisie montant
  amountCard: {
    backgroundColor: S.surface,
    borderRadius: S.radius.card,
    borderWidth: 1,
    borderColor: S.border,
    paddingVertical: R.space.xxl,
    paddingHorizontal: R.space.gut,
    marginTop: R.space.gut,
  },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 8 },
  amountInput: {
    fontFamily: R.font.mono,
    fontSize: 40,
    color: S.textPrim,
    minWidth: 80,
    padding: 0,
  },
  amountCurrency: { fontFamily: R.font.bodyBold, fontSize: 16, color: S.textMuted },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: R.space.sm, marginTop: R.space.lg },
  chip: {
    paddingHorizontal: R.space.lg,
    paddingVertical: R.space.sm,
    borderRadius: S.radius.pill,
    backgroundColor: S.surface,
    borderWidth: 1,
    borderColor: S.border,
  },
  chipText: { fontFamily: R.font.bodyBold, fontSize: 13, color: S.textPrim },
  chipAll: { backgroundColor: S.green, borderColor: S.green },
  chipAllText: { color: '#FFFFFF' },

  // Récap montant (étape phone, mode déverrouillé)
  amountRecap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: S.activeBg,
    borderRadius: S.radius.method,
    borderWidth: 1,
    borderColor: S.border,
    paddingVertical: R.space.md,
    paddingHorizontal: R.space.lg,
    marginBottom: R.space.lg,
  },
  amountRecapLabel: { fontFamily: R.font.body, fontSize: 13, color: S.textSec },
  amountRecapValue: { fontFamily: R.font.mono, fontSize: 17, color: S.green },

  // Montant verrouillé (règlement de dette)
  lockedCard: {
    backgroundColor: S.ussdBg,
    borderRadius: S.radius.card,
    borderWidth: 1,
    borderColor: S.ussdBorder,
    padding: R.space.gut,
    marginBottom: R.space.lg,
  },
  lockedLabel: { fontFamily: R.font.body, fontSize: 12.5, color: S.textSec },
  lockedValue: { fontFamily: R.font.mono, fontSize: 28, color: S.textPrim, marginTop: 2 },
  lockedHint: { fontFamily: R.font.body, fontSize: 12, color: S.textMuted, marginTop: 6, lineHeight: 17 },

  section: {
    fontFamily: R.font.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: S.textMuted,
    marginBottom: R.space.sm,
  },

  fieldLabel: {
    fontFamily: R.font.bodyBold,
    fontSize: 13,
    color: S.textSec,
    marginTop: R.space.lg,
    marginBottom: R.space.sm,
  },
  phoneRow: { flexDirection: 'row', gap: R.space.sm },
  phonePrefix: {
    justifyContent: 'center',
    paddingHorizontal: R.space.lg,
    borderRadius: S.radius.field,
    backgroundColor: S.surface,
    borderWidth: 1.5,
    borderColor: S.border,
  },
  phonePrefixText: { fontFamily: R.font.bodyBold, fontSize: 15, color: S.textPrim },
  phoneInput: {
    flex: 1,
    height: 52,
    borderRadius: S.radius.field,
    backgroundColor: S.surface,
    borderWidth: 1.5,
    borderColor: S.border,
    paddingHorizontal: R.space.lg,
    fontFamily: R.font.bodyBold,
    fontSize: 16,
    color: S.textPrim,
  },

  // Récap OTP
  summaryCard: {
    backgroundColor: S.surface,
    borderRadius: S.radius.card,
    borderWidth: 1,
    borderColor: S.border,
    paddingHorizontal: R.space.gut,
    marginTop: R.space.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: R.space.md,
  },
  summaryDivider: { height: 1, backgroundColor: S.border },
  summaryLabel: { fontFamily: R.font.body, fontSize: 13, color: S.textSec },
  summaryValue: { fontFamily: R.font.bodyBold, fontSize: 14, color: S.textPrim },

  error: {
    fontFamily: R.font.body,
    fontSize: 13,
    color: '#B91C1C',
    marginTop: R.space.md,
    textAlign: 'center',
  },

  footer: {
    paddingHorizontal: R.space.gut,
    paddingTop: R.space.sm,
    paddingBottom: R.space.gut,
    backgroundColor: S.canvas,
    borderTopWidth: 1,
    borderTopColor: S.border,
  },
  cta: {
    height: 54,
    borderRadius: S.radius.method,
    backgroundColor: S.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaOff: { backgroundColor: '#9CC9AE' },
  ctaText: { fontFamily: R.font.bodyBold, fontSize: 16, color: '#FFFFFF' },
});
