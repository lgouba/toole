import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { DriverHood } from '@/components/driver/flow/DriverHood';
import { C, F } from '@/components/driver/flow/tokens';
import { OtpInput } from '@/components/ui';
import { useDriverStore } from '@/stores/driver.store';
import { haptic } from '@/utils/haptics';
import { alertConfirmSuccess } from '@/utils/alerts';
import { openPhone } from '@/utils/linking';
import { formatCFA } from '@/utils/format';

export default function CodeValidationScreen() {
  const router = useRouter();
  const { validateCode, activeDelivery } = useDriverStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setCode('');
    setError('');
    setAttempts(0);
    setSubmitting(false);
  }, [activeDelivery?.id]);

  const recipientName = activeDelivery?.recipientName ?? 'Destinataire';
  const recipientPhone = activeDelivery?.recipientPhone;
  const codeDone = code.length === 4;
  const blocked = attempts >= 3;

  const prepaid =
    activeDelivery?.paymentMethod === 'orange_money' ||
    activeDelivery?.paymentMethod === 'moov_money';

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
        setError(
          newAttempts >= 3
            ? 'Trop de tentatives. Contactez le support.'
            : `Code incorrect (${3 - newAttempts} tentative(s) restante(s))`,
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Validation automatique dès que les 4 chiffres sont saisis.
  useEffect(() => {
    if (codeDone && !submitting && !blocked) handleSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <View style={styles.container}>
      <DriverHood height={252} step={4} onBack={() => router.back()}>
        <View style={styles.who}>
          <View style={styles.avatar}>
            <Ionicons name="person-outline" size={26} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.role}>DESTINATAIRE</Text>
            <Text style={styles.name} numberOfLines={1}>
              {recipientName}
            </Text>
          </View>
          {recipientPhone ? (
            <TouchableOpacity
              style={styles.callBig}
              onPress={() => openPhone(recipientPhone)}
              accessibilityLabel="Appeler le destinataire"
            >
              <Ionicons name="call" size={20} color={C.gDark} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Bloc paiement adaptatif */}
        <View style={styles.payChip}>
          {prepaid ? (
            <>
              <View style={{ flex: 1 }}>
                <Text style={styles.payLbl}>Déjà payé</Text>
                <Text style={styles.paySub}>Rien à encaisser</Text>
              </View>
              <Ionicons name="checkmark-circle" size={26} color={C.lime} />
            </>
          ) : (
            <>
              <View style={{ flex: 1 }}>
                <Text style={styles.payLbl}>À ENCAISSER</Text>
                <Text style={styles.paySub}>Paiement à la livraison</Text>
              </View>
              <Text style={styles.payAmt}>{formatCFA(activeDelivery?.price ?? 0)}</Text>
            </>
          )}
        </View>
      </DriverHood>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h}>Code du destinataire</Text>
        <Text style={styles.hint}>{`Demandez à ${recipientName} son code à 4 chiffres.`}</Text>
        <View style={styles.codeWrap}>
          <OtpInput
            length={4}
            value={code}
            onChange={(v) => {
              setError('');
              setCode(v);
            }}
            variant="driver"
          />
        </View>
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.cta, (!codeDone || blocked || submitting) && styles.ctaOff]}
          activeOpacity={0.9}
          disabled={!codeDone || blocked || submitting}
          onPress={handleSubmit}
        >
          <Text style={styles.ctaText}>
            {blocked ? 'Bloqué' : submitting ? 'Validation…' : 'Confirmer la livraison'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.paper },

  who: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6 },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  role: { color: C.lime, fontFamily: F.uiBold, fontSize: 11, letterSpacing: 0.6 },
  name: { color: '#fff', fontFamily: F.uiBold, fontSize: 24, marginTop: 2 },
  callBig: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },

  payChip: {
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  payLbl: { color: C.amberSoft, fontFamily: F.uiBold, fontSize: 11, letterSpacing: 0.5 },
  paySub: { color: 'rgba(255,255,255,0.8)', fontFamily: F.ui, fontSize: 11, marginTop: 2 },
  payAmt: { color: '#fff', fontFamily: F.display, fontSize: 22 },

  content: { padding: 20, paddingBottom: 28 },
  h: { fontFamily: F.display, fontSize: 20, color: C.ink },
  hint: { fontFamily: F.ui, fontSize: 13, color: C.muted, marginTop: 6, marginBottom: 16 },
  codeWrap: { alignItems: 'center', paddingVertical: 4 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { color: '#DC2626', fontFamily: F.uiMed, fontSize: 13, flex: 1 },

  footer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: C.hair,
    backgroundColor: C.paper,
  },
  cta: {
    backgroundColor: C.gDark,
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaOff: { opacity: 0.4 },
  ctaText: { color: '#fff', fontFamily: F.uiBold, fontSize: 16 },
});
