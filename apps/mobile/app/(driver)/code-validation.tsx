import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, Alert, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect } from 'react-native-svg';
import { OtpInput } from '@/components/ui';
import { useDriverStore } from '@/stores/driver.store';
import { uploadImage } from '@/services/upload.service';
import { haptic } from '@/utils/haptics';
import { alertConfirmSuccess } from '@/utils/alerts';
import { openPhone } from '@/utils/linking';
import { formatCFA } from '@/utils/format';
import { setDriverFlowStep, clearDriverFlowStep } from '@/utils/driverFlowStep';
import { AU, AF, glassShadow } from '@/theme/aurora';
import { AuroraGlow, AuroraText, GradientButton } from '@/components/aurora/AuroraBits';

export default function CodeValidationScreen() {
  const router = useRouter();
  const { width: W } = useWindowDimensions();
  const { validateCode, activeDelivery } = useDriverStore();
  const [code, setCode] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // ---------- LOGIQUE INCHANGÉE ----------
  useEffect(() => {
    setCode('');
    setPhoto(null);
    setError('');
    setAttempts(0);
    setSubmitting(false);
  }, [activeDelivery?.id]);

  useEffect(() => {
    if (!activeDelivery?.id) return;
    setDriverFlowStep({ deliveryId: activeDelivery.id, step: 'code' });
    return () => {
      clearDriverFlowStep();
    };
  }, [activeDelivery?.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pending = await ImagePicker.getPendingResultAsync();
        const res = Array.isArray(pending) ? pending[0] : pending;
        if (!cancelled && res && !('code' in res) && !res.canceled && res.assets?.[0]) setPhoto(res.assets[0].uri);
      } catch {
        /* rien */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const recipientName = activeDelivery?.recipientName ?? 'Destinataire';
  const recipientPhone = activeDelivery?.recipientPhone;
  const codeDone = code.length === 4;
  const photoDone = !!photo;
  const blocked = attempts >= 3;
  const prepaid = activeDelivery?.paymentMethod === 'orange_money' || activeDelivery?.paymentMethod === 'moov_money';

  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission caméra refusée', "Autorisez l'accès à l'appareil photo pour prendre la preuve de remise du colis.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (!result.canceled && result.assets[0]) {
        setPhoto(result.assets[0].uri);
        setError('');
      }
    } catch (err: any) {
      console.warn('[code-validation] camera error', err);
      Alert.alert('Erreur caméra', err?.message ?? "Impossible d'ouvrir l'appareil photo.");
    }
  };

  const handleSubmit = async () => {
    if (submitting || blocked) return;
    if (!photoDone) return setError('Prenez une photo de preuve de remise.');
    if (!codeDone) return setError('Saisissez le code à 4 chiffres du destinataire.');
    setSubmitting(true);
    setError('');
    try {
      const uploaded = await uploadImage(photo!, 'packages');
      if (!uploaded) {
        haptic.error();
        setError("Impossible d'envoyer la photo. Vérifiez votre réseau et réessayez.");
        return;
      }
      const success = await validateCode(code, uploaded.url);
      if (success) {
        alertConfirmSuccess();
        router.replace('/(driver)/delivery-confirm');
      } else {
        haptic.error();
        setCode('');
        const n = attempts + 1;
        setAttempts(n);
        setError(n >= 3 ? 'Trop de tentatives. Contactez le support.' : `Code incorrect (${3 - n} tentative(s) restante(s))`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- DESIGN AURORA ----------
  const actif = photoDone && codeDone && !blocked && !submitting;
  const amt = formatCFA(activeDelivery?.price ?? 0);

  return (
    <View style={{ flex: 1, backgroundColor: AU.ground }}>
      <AuroraGlow width={W} height={220} opacity={0.7} style={{ position: 'absolute', top: 0, left: 0 }} />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}>
            <Ionicons name="chevron-back" size={20} color={AU.ink} />
          </Pressable>
          <Text style={styles.stepText}>ÉTAPE 4 / 4</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* panneau plein Aurora — remplit tout l'espace, zéro vide gris */}
        <View style={styles.panel}>
          <AuroraGlow width={W - 24} height={520} opacity={1} style={{ position: 'absolute', top: -30, left: 0 }} />
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.eyebrow}>DESTINATAIRE</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.name}>{recipientName}</Text>

            <View style={styles.contactRow}>
              <ContactBtn icon="call-outline" label="Appeler" a11y={`Appeler ${recipientName}`} disabled={!recipientPhone} onPress={() => recipientPhone && openPhone(recipientPhone)} />
              <ContactBtn icon="chatbubble-outline" label="Message" a11y="Envoyer un message" onPress={() => activeDelivery && router.push(`/chat/${activeDelivery.id}?name=${encodeURIComponent(activeDelivery.senderName ?? 'Client')}&reference=${encodeURIComponent(activeDelivery.reference)}` as any)} />
            </View>

            {/* à encaisser */}
            <View style={styles.amountCard}>
              {prepaid ? (
                <>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.amountK}>DÉJÀ PAYÉ</Text>
                    <Text style={styles.amountHint}>Rien à encaisser</Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={26} color={AU.teal} />
                </>
              ) : (
                <>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.amountK}>À ENCAISSER</Text>
                    <Text style={styles.amountHint}>Paiement à la livraison</Text>
                  </View>
                  <AuroraText id="encAmt" width={Math.max(120, amt.length * 15 + 10)} height={34} fontSize={27} fontFamily={AF.disp} align="right" letterSpacing={-0.5}>
                    {amt}
                  </AuroraText>
                </>
              )}
            </View>

            {/* photo */}
            {photo ? (
              <View style={{ height: 120, borderRadius: 18, overflow: 'hidden', marginTop: 16 }}>
                <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                <Pressable onPress={takePhoto} style={styles.retake}>
                  <Ionicons name="camera" size={15} color="#fff" />
                  <Text style={styles.retakeText}>Reprendre</Text>
                </Pressable>
              </View>
            ) : (
              <DashedPhoto W={W - 64} onPress={takePhoto} label="Prendre la photo" caption="PREUVE DE LIVRAISON" />
            )}

            {/* code */}
            <Text style={styles.codeTitle}>Code du destinataire</Text>
            <Text style={styles.codeHint}>{`Demandez à ${recipientName} son code à 4 chiffres.`}</Text>
            <View style={{ marginTop: 12 }}>
              <OtpInput length={4} value={code} onChange={(v) => { setError(''); setCode(v); }} variant="driver" />
            </View>
            {error ? (
              <View style={styles.errorRow}>
                <Ionicons name="alert-circle" size={17} color={AU.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={{ flex: 1, minHeight: 12 }} />
            <GradientButton label={blocked ? 'Bloqué' : submitting ? 'Validation…' : 'Confirmer la livraison'} icon={actif ? 'checkmark' : undefined} disabled={!actif} onPress={handleSubmit} height={54} style={{ marginTop: 8 }} />
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}

function ContactBtn({ icon, label, a11y, onPress, disabled }: { icon: any; label: string; a11y: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      android_ripple={{ color: 'rgba(0,0,0,0.05)' }}
      style={({ pressed }) => [styles.contactBtn, disabled && { opacity: 0.4 }, pressed && !disabled && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={17} color={AU.kola} />
      <Text style={styles.contactLabel}>{label}</Text>
    </Pressable>
  );
}

function DashedPhoto({ W, onPress, label, caption }: { W: number; onPress: () => void; label: string; caption: string }) {
  const h = 120;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [{ height: h, borderRadius: 18, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.5)', marginTop: 16 }, pressed && { opacity: 0.85 }]}>
      <Svg width={W} height={h} style={{ position: 'absolute', left: 0, top: 0 }}>
        <Rect x={1} y={1} width={W - 2} height={h - 2} rx={18} fill="none" stroke={AU.teal} strokeOpacity={0.6} strokeWidth={1.5} strokeDasharray="7 6" />
      </Svg>
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...glassShadow }}>
        <Ionicons name="camera-outline" size={22} color={AU.kola} />
      </View>
      <Text style={{ fontFamily: AF.bold, fontSize: 14, color: AU.ink, marginTop: 8 }}>{label}</Text>
      <Text style={{ fontFamily: AF.mono, fontSize: 9, letterSpacing: 1.6, color: AU.faint, marginTop: 4 }}>{caption}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 44 },
  backBtn: { width: 40, height: 40, borderRadius: 13, backgroundColor: AU.glass, borderWidth: 1, borderColor: AU.glassBorder, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontFamily: AF.mono, fontSize: 10.5, letterSpacing: 2, color: AU.muted },

  panel: {
    flex: 1,
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 10,
    backgroundColor: '#DCEFE1',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    shadowColor: '#0E3A28',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  eyebrow: { fontFamily: AF.mono, fontSize: 10, letterSpacing: 2.2, color: AU.kola },
  name: { fontFamily: AF.disp, fontSize: 30, letterSpacing: -1, color: AU.ink, marginTop: 4 },

  contactRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  contactBtn: { flex: 1, height: 46, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.9)' },
  contactLabel: { fontFamily: AF.semi, fontSize: 15, color: AU.ink },

  amountCard: { marginTop: 16, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 18, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.6)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.85)' },
  amountK: { fontFamily: AF.mono, fontSize: 9, letterSpacing: 1.8, color: AU.kola },
  amountHint: { fontFamily: AF.med, fontSize: 12.5, color: AU.muted, marginTop: 2 },

  retake: { position: 'absolute', right: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  retakeText: { fontFamily: AF.semi, fontSize: 11, color: '#fff' },

  codeTitle: { fontFamily: AF.disp, fontSize: 20, letterSpacing: -0.4, color: AU.ink, marginTop: 20 },
  codeHint: { fontFamily: AF.med, fontSize: 13.5, color: AU.muted, marginTop: 4 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  errorText: { flex: 1, fontFamily: AF.med, fontSize: 13, color: AU.danger },
});
