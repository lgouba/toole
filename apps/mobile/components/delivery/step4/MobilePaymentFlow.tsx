import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { recap as R, step4 as S } from '@/theme/recapTokens';
import { OtpInput } from '@/components/ui';
import { formatCFA } from '@/utils/format';
import { paymentProvider, DEMO_OTP_HINT, MobileMethod, PaymentResult } from '@/utils/payment';

interface Props {
  method: MobileMethod;
  amountXOF: number;
  paid: boolean;
  txId?: string;
  onPaid: (r: PaymentResult) => void;
}

export function MobilePaymentFlow({ method, amountXOF, paid, txId, onPaid }: Props) {
  const color = method === 'orange_money' ? S.orange : S.moov;
  const opName = method === 'orange_money' ? 'Orange Money' : 'Moov Money';
  const ussd = paymentProvider.ussdCode(method, amountXOF);

  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Réinitialise quand on change d'opérateur.
  useEffect(() => {
    setOtp('');
    setError(null);
  }, [method]);

  const pop = useSharedValue(paid ? 1 : 0);
  useEffect(() => {
    if (paid) pop.value = withSpring(1, { damping: 11, stiffness: 180 });
  }, [paid, pop]);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const copy = async () => {
    await Clipboard.setStringAsync(ussd);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const validate = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await paymentProvider.confirm(method, otp, amountXOF);
      onPaid(r);
    } catch (e: any) {
      setError(e?.message ?? 'Paiement non confirmé.');
    } finally {
      setBusy(false);
    }
  };

  if (paid) {
    return (
      <View style={[styles.successCard]}>
        <Animated.View style={[styles.successCheck, popStyle]}>
          <MaterialIcons name="check" size={26} color="#FFFFFF" />
        </Animated.View>
        <Text style={styles.successTitle}>Paiement validé</Text>
        <Text style={styles.successSub}>
          La confirmation au récapitulatif sera directe.
          {txId ? `\nRéf. ${txId}` : ''}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {/* En-tête opérateur */}
      <View style={[styles.header, { backgroundColor: color }]}>
        <MaterialIcons name="lock" size={16} color="#FFFFFF" />
        <Text style={styles.headerText}>Paiement {opName}</Text>
        <View style={{ flex: 1 }} />
        <Text style={styles.headerAmount}>{formatCFA(amountXOF)}</Text>
      </View>

      <View style={styles.body}>
        {/* Étape 1 — USSD */}
        <View style={styles.stepRow}>
          <View style={styles.badge}><Text style={styles.badgeText}>1</Text></View>
          <Text style={styles.stepTitle}>Composez ce code sur votre téléphone</Text>
        </View>
        <View style={styles.ussdBox}>
          <Text style={styles.ussdText}>{ussd}</Text>
          <TouchableOpacity style={styles.copyBtn} onPress={copy} hitSlop={8}>
            <MaterialIcons name={copied ? 'check' : 'content-copy'} size={18} color={S.green} />
          </TouchableOpacity>
        </View>
        <Text style={styles.note}>Suivez ensuite les instructions de votre opérateur.</Text>

        {/* Étape 2 — OTP */}
        <View style={[styles.stepRow, { marginTop: R.space.lg }]}>
          <View style={styles.badge}><Text style={styles.badgeText}>2</Text></View>
          <Text style={styles.stepTitle}>Entrez le code reçu par SMS</Text>
        </View>
        <OtpInput length={4} value={otp} onChange={setOtp} />
        <Text style={styles.note}>Mode démo : {DEMO_OTP_HINT}</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.validate, otp.length < 4 && styles.validateOff]}
          onPress={validate}
          disabled={otp.length < 4 || busy}
          activeOpacity={0.9}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.validateText}>Valider le paiement</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: S.surface,
    borderRadius: S.radius.card,
    borderWidth: 1,
    borderColor: S.border,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: R.space.sm,
    paddingHorizontal: R.space.gut,
    paddingVertical: R.space.md,
  },
  headerText: { fontFamily: R.font.bodyBold, fontSize: 14, color: '#FFFFFF' },
  headerAmount: { fontFamily: R.font.mono, fontSize: 14, color: '#FFFFFF' },
  body: { padding: R.space.gut, gap: R.space.sm },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: R.space.sm },
  badge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: S.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: R.font.bodyBold, fontSize: 12, color: '#FFFFFF' },
  stepTitle: { fontFamily: R.font.bodyBold, fontSize: 13.5, color: S.textPrim, flex: 1 },
  ussdBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: S.ussdBg,
    borderWidth: 1,
    borderColor: S.ussdBorder,
    borderRadius: 12,
    paddingHorizontal: R.space.lg,
    paddingVertical: R.space.md,
    marginTop: 2,
  },
  ussdText: { flex: 1, fontFamily: R.font.mono, fontSize: 17, color: S.ussdFg, letterSpacing: 0.5 },
  copyBtn: { padding: 4 },
  note: { fontFamily: R.font.body, fontSize: 11.5, color: S.textMuted, marginTop: 2 },
  error: { fontFamily: R.font.body, fontSize: 12.5, color: '#B91C1C', marginTop: 2 },
  validate: {
    height: 50,
    borderRadius: 12,
    backgroundColor: S.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: R.space.sm,
  },
  validateOff: { backgroundColor: '#9CC9AE' },
  validateText: { fontFamily: R.font.bodyBold, fontSize: 15, color: '#FFFFFF' },
  successCard: {
    alignItems: 'center',
    gap: 6,
    backgroundColor: S.successBg,
    borderRadius: S.radius.card,
    borderWidth: 1.5,
    borderColor: S.successBorder,
    paddingVertical: R.space.xxl,
    paddingHorizontal: R.space.gut,
  },
  successCheck: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: S.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  successTitle: { fontFamily: R.font.display, fontSize: 17, color: S.green },
  successSub: { fontFamily: R.font.body, fontSize: 12.5, color: S.textSec, textAlign: 'center' },
});
