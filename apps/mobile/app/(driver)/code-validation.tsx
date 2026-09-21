import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Image, Alert, LayoutChangeEvent, useWindowDimensions } from 'react-native';
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
import { BC, BF } from '@/theme/bonCourse';
import { RetourBtn, Perforation, microStyle } from '@/components/driver/bonCourse/BonCourseParts';

export default function CodeValidationScreen() {
  const router = useRouter();
  const { height: H } = useWindowDimensions();
  const { validateCode, activeDelivery } = useDriverStore();
  const [code, setCode] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // ---- LOGIQUE INCHANGÉE ----
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
        if (!cancelled && res && !('code' in res) && !res.canceled && res.assets?.[0]) {
          setPhoto(res.assets[0].uri);
        }
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
  const prepaid =
    activeDelivery?.paymentMethod === 'orange_money' || activeDelivery?.paymentMethod === 'moov_money';

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
    if (!photoDone) {
      setError('Prenez une photo de preuve de remise.');
      return;
    }
    if (!codeDone) {
      setError('Saisissez le code à 4 chiffres du destinataire.');
      return;
    }
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
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);
        setError(newAttempts >= 3 ? 'Trop de tentatives. Contactez le support.' : `Code incorrect (${3 - newAttempts} tentative(s) restante(s))`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ---- DESIGN ----
  const k = Math.min(1.12, Math.max(0.86, H / 844));
  const gut = H >= 900 ? 24 : 20;
  const m = microStyle(k);
  const actif = photoDone && codeDone && !blocked && !submitting;

  return (
    <View style={{ flex: 1, backgroundColor: BC.page }}>
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: BC.papier }}>
        <View style={{ flex: 1, paddingHorizontal: gut, paddingTop: 8 * k }}>
          {/* tête */}
          <View style={{ height: 40 * k, justifyContent: 'center' }}>
            <RetourBtn k={k} g={gut} top={0} onPress={() => router.back()} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 40 * k }}>
              <Text maxFontSizeMultiplier={1.4} style={[m, { color: BC.encre, letterSpacing: 3 * k }]}>TOOLÉ</Text>
              <Text maxFontSizeMultiplier={1.4} style={m}>ÉTAPE 4 / 4</Text>
            </View>
          </View>
          <View style={{ height: 4 * k, borderTopWidth: 2 * k, borderBottomWidth: 1, borderColor: BC.encre, marginTop: 10 * k }} />

          {/* identité destinataire */}
          <View style={{ marginTop: 22 * k }}>
            <Text maxFontSizeMultiplier={1.4} style={m}>DESTINATAIRE</Text>
            <Text maxFontSizeMultiplier={1.4} numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: BF.xbold, fontSize: 32 * k, letterSpacing: -1.1 * k, color: BC.encre, marginTop: 8 * k }}>
              {recipientName}
            </Text>
          </View>

          {/* contact (uniforme avec le 3/4 et l'écran client : appeler / message) */}
          <View style={{ flexDirection: 'row', gap: 10 * k, marginTop: 14 * k }}>
            <ContactBtn
              k={k}
              icon="call-outline"
              label="Appeler"
              a11y={`Appeler ${recipientName}`}
              onPress={() => recipientPhone && openPhone(recipientPhone)}
              disabled={!recipientPhone}
            />
            <ContactBtn
              k={k}
              icon="chatbubble-outline"
              label="Message"
              a11y="Envoyer un message"
              onPress={() =>
                activeDelivery &&
                router.push(
                  `/chat/${activeDelivery.id}?name=${encodeURIComponent(activeDelivery.senderName ?? 'Client')}&reference=${encodeURIComponent(activeDelivery.reference)}` as any,
                )
              }
            />
          </View>

          <View style={{ marginTop: 18 * k }}>
            <Perforation k={k} />
          </View>

          {/* bandeau à encaisser (§6.1) — montant INCHANGÉ (formatCFA(price)) */}
          <View style={{ marginTop: 14 * k, height: 70 * k, borderBottomWidth: 1, borderColor: BC.filetFin, flexDirection: 'row', alignItems: 'center' }}>
            {prepaid ? (
              <>
                <View style={{ flex: 1 }}>
                  <Text maxFontSizeMultiplier={1.4} style={[m, { color: BC.vertProfond }]}>DÉJÀ PAYÉ</Text>
                  <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: BF.med, fontSize: Math.max(12.5, 13 * k), color: BC.gris, marginTop: 3 * k }}>Rien à encaisser</Text>
                </View>
                <Ionicons name="checkmark-circle" size={24 * k} color={BC.vert} />
              </>
            ) : (
              <>
                <View style={{ flex: 1 }}>
                  <Text maxFontSizeMultiplier={1.4} style={[m, { color: BC.vertProfond }]}>À ENCAISSER</Text>
                  <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: BF.med, fontSize: Math.max(12.5, 13 * k), color: BC.gris, marginTop: 3 * k }}>Paiement à la livraison</Text>
                </View>
                <Text
                  maxFontSizeMultiplier={1.4}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  accessibilityLabel={`À encaisser : ${formatCFA(activeDelivery?.price ?? 0)}`}
                  style={{ fontFamily: BF.mono, fontSize: 28 * k, letterSpacing: -0.9 * k, color: BC.vertProfond, maxWidth: '55%' }}
                >
                  {formatCFA(activeDelivery?.price ?? 0)}
                </Text>
              </>
            )}
          </View>

          {/* photo + code (scrollable → reste accessible clavier levé) */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 16 * k, paddingBottom: 8 * k }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {photo ? (
              <View style={{ height: 120 * k, position: 'relative' }}>
                <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                <Pressable onPress={takePhoto} style={{ position: 'absolute', right: 8 * k, bottom: 8 * k, flexDirection: 'row', alignItems: 'center', gap: 5 * k, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 10 * k, paddingVertical: 6 * k }}>
                  <Ionicons name="camera" size={15 * k} color={BC.blanc} />
                  <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: BF.mono, fontSize: 11 * k, color: BC.blanc }}>REPRENDRE</Text>
                </Pressable>
              </View>
            ) : (
              <DashedPhoto k={k} onPress={takePhoto} />
            )}

            <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: BF.bold, fontSize: 21 * k, letterSpacing: -0.5 * k, color: BC.encre, marginTop: 22 * k }}>
              Code du destinataire
            </Text>
            <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: BF.med, fontSize: Math.max(13, 13.5 * k), color: BC.gris, marginTop: 4 * k }}>
              {`Demandez à ${recipientName} son code à 4 chiffres.`}
            </Text>
            <View style={{ marginTop: 14 * k }}>
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 * k, marginTop: 12 * k }}>
                <Ionicons name="alert-circle" size={17 * k} color="#DC2626" />
                <Text maxFontSizeMultiplier={1.4} style={{ flex: 1, fontFamily: BF.med, fontSize: Math.max(12.5, 13 * k), color: '#DC2626' }}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </SafeAreaView>

      {/* bouton Confirmer (page, sous la feuille) */}
      <View style={{ paddingHorizontal: gut, paddingTop: 12 * k, paddingBottom: 8 * k }}>
        <Pressable
          onPress={handleSubmit}
          disabled={!actif}
          android_ripple={{ color: 'rgba(255,255,255,0.18)' }}
          accessibilityRole="button"
          accessibilityLabel="Confirmer la livraison"
          style={({ pressed }) => [
            { height: 56 * k, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9 * k },
            actif ? { backgroundColor: BC.vert } : { borderWidth: 1.5 * k, borderColor: BC.filet },
            pressed && actif && { opacity: 0.9 },
          ]}
        >
          {actif ? <Ionicons name="checkmark" size={19 * k} color={BC.blanc} /> : null}
          <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: BF.mono, fontSize: Math.max(13.5, 14.5 * k), letterSpacing: 1 * k, color: actif ? BC.blanc : BC.gris }}>
            {blocked ? 'BLOQUÉ' : submitting ? 'VALIDATION…' : 'CONFIRMER LA LIVRAISON'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Bouton contact (Appeler / Message) — style « bon de course ». */
function ContactBtn({
  k,
  icon,
  label,
  a11y,
  onPress,
  disabled,
}: {
  k: number;
  icon: any;
  label: string;
  a11y: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
      style={({ pressed }) => [
        { flex: 1, height: 46 * k, borderWidth: 1.5 * k, borderColor: BC.filet, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 * k },
        disabled && { opacity: 0.4 },
        pressed && !disabled && { opacity: 0.7 },
      ]}
    >
      <Ionicons name={icon} size={17 * k} color={BC.encre} />
      <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: BF.semi, fontSize: Math.max(14, 15 * k), color: BC.encre }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Zone photo vide : rectangle pointillé SVG (largeur mesurée). */
function DashedPhoto({ k, onPress }: { k: number; onPress: () => void }) {
  const [w, setW] = useState(0);
  const h = 120 * k;
  const onLayout = (e: LayoutChangeEvent) => {
    const nw = e.nativeEvent.layout.width;
    if (nw && Math.abs(nw - w) > 1) setW(nw);
  };
  return (
    <Pressable onPress={onPress} onLayout={onLayout} accessibilityRole="button" accessibilityLabel="Prendre la photo de preuve de livraison" style={({ pressed }) => [{ height: h, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.85 }]}>
      {w > 0 ? (
        <Svg width={w} height={h} style={{ position: 'absolute', left: 0, top: 0 }}>
          <Rect x={0.75 * k} y={0.75 * k} width={w - 1.5 * k} height={h - 1.5 * k} fill="none" stroke={BC.filet} strokeWidth={1.5 * k} strokeDasharray={`${6 * k} ${5 * k}`} />
        </Svg>
      ) : null}
      <Ionicons name="camera-outline" size={30 * k} color={BC.gris} />
      <Text maxFontSizeMultiplier={1.4} style={{ fontFamily: BF.bold, fontSize: Math.max(15, 16 * k), color: BC.encre, marginTop: 8 * k }}>Prendre la photo</Text>
      <Text maxFontSizeMultiplier={1.4} style={[microStyle(k), { color: BC.attente, marginTop: 4 * k }]}>PREUVE DE LIVRAISON</Text>
    </Pressable>
  );
}
