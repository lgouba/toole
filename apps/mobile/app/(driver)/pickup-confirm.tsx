import React, { useEffect, useState } from 'react';
import { View, Text, Image, Pressable, Alert, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect } from 'react-native-svg';
import { OtpInput } from '@/components/ui';
import { useDriverStore } from '@/stores/driver.store';
import { uploadImage } from '@/services/upload.service';
import { alertConfirmSuccess } from '@/utils/alerts';
import { openPhone } from '@/utils/linking';
import { AU, AF, glassShadow } from '@/theme/aurora';
import { AuroraGlow, GradientButton } from '@/components/aurora/AuroraBits';

export default function PickupConfirmScreen() {
  const router = useRouter();
  const { width: W } = useWindowDimensions();
  const { confirmPickup, activeDelivery } = useDriverStore();
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pickupCode, setPickupCode] = useState('');

  // ---------- LOGIQUE INCHANGÉE ----------
  useEffect(() => {
    setPhoto(null);
    setPickupCode('');
    setUploading(false);
  }, [activeDelivery?.id]);

  const photoDone = !!photo;
  const codeDone = pickupCode.length === 4;
  const senderName = activeDelivery?.senderContactName ?? activeDelivery?.senderName ?? 'Expéditeur';
  const pickupPhone = activeDelivery?.senderContactPhone || activeDelivery?.senderPhone || activeDelivery?.recipientPhone;

  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission caméra refusée', "Autorisez l'accès à l'appareil photo dans les paramètres de votre téléphone pour prendre la photo du colis.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (!result.canceled && result.assets[0]) {
        setPhoto(result.assets[0].uri);
      }
    } catch (err: any) {
      console.warn('[pickup-confirm] camera error', err);
      Alert.alert('Erreur caméra', err?.message ?? "Impossible d'ouvrir l'appareil photo.");
    }
  };

  const handleConfirm = async () => {
    if (!photo) {
      Alert.alert('Photo manquante', 'Prenez une photo du colis.');
      return;
    }
    if (!codeDone) {
      Alert.alert('Code manquant', "Demandez à l'expéditeur son code de récupération à 4 chiffres.");
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadImage(photo, 'packages');
      if (!uploaded) {
        Alert.alert('Erreur', "Impossible d'envoyer la photo. Réessayez.");
        return;
      }
      await confirmPickup(uploaded.url, pickupCode);
      alertConfirmSuccess();
      router.replace('/(driver)/delivery-navigation');
    } catch (err: any) {
      console.warn('[pickup-confirm] error:', err);
      const apiCode = err?.response?.data?.error?.code;
      const msg = err?.response?.data?.error?.message ?? err?.message ?? 'Échec de la confirmation. Réessayez.';
      if (apiCode === 'INVALID_PICKUP_CODE') {
        Alert.alert('Code incorrect', "Le code saisi ne correspond pas. Demandez à l'expéditeur de vous redonner le bon code.");
        setPickupCode('');
      } else {
        Alert.alert('Erreur', msg);
      }
    } finally {
      setUploading(false);
    }
  };

  // ---------- DESIGN AURORA ----------
  const actif = photoDone && codeDone && !uploading;

  return (
    <View style={{ flex: 1, backgroundColor: AU.ground }}>
      <AuroraGlow width={W} height={220} opacity={0.7} style={{ position: 'absolute', top: 0, left: 0 }} />
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}>
            <Ionicons name="chevron-back" size={20} color={AU.ink} />
          </Pressable>
          <Text style={styles.stepText}>ÉTAPE 2 / 4</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.panel}>
          <AuroraGlow width={W - 24} height={520} opacity={1} style={{ position: 'absolute', top: -30, left: 0 }} />
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.eyebrow}>EXPÉDITEUR</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.name}>{senderName}</Text>

            <View style={styles.contactRow}>
              <ContactBtn icon="call-outline" label="Appeler" a11y="Appeler l'expéditeur" disabled={!pickupPhone} onPress={() => pickupPhone && openPhone(pickupPhone)} />
              <ContactBtn icon="chatbubble-outline" label="Message" a11y="Envoyer un message" onPress={() => activeDelivery && router.push(`/chat/${activeDelivery.id}?name=${encodeURIComponent(activeDelivery.senderName ?? 'Client')}&reference=${encodeURIComponent(activeDelivery.reference)}` as any)} />
            </View>

            {photo ? (
              <View style={{ height: 130, borderRadius: 18, overflow: 'hidden', marginTop: 16 }}>
                <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                <Pressable onPress={takePhoto} style={styles.retake}>
                  <Ionicons name="camera" size={15} color="#fff" />
                  <Text style={styles.retakeText}>Reprendre</Text>
                </Pressable>
              </View>
            ) : (
              <DashedPhoto W={W - 64} onPress={takePhoto} label="Prendre la photo" caption="PREUVE DE PRISE EN CHARGE" />
            )}

            <Text style={styles.codeTitle}>Code de l'expéditeur</Text>
            <Text style={styles.codeHint}>{`Demandez à ${senderName} son code à 4 chiffres.`}</Text>
            <View style={{ marginTop: 12 }}>
              <OtpInput length={4} value={pickupCode} onChange={setPickupCode} variant="driver" />
            </View>

            <View style={{ flex: 1, minHeight: 12 }} />
            <GradientButton label={uploading ? 'Confirmation…' : 'Confirmer la récupération'} icon={actif ? 'checkmark' : undefined} disabled={!actif} onPress={handleConfirm} height={54} style={{ marginTop: 8 }} />
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
  const h = 130;
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

  retake: { position: 'absolute', right: 8, bottom: 8, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  retakeText: { fontFamily: AF.semi, fontSize: 11, color: '#fff' },

  codeTitle: { fontFamily: AF.disp, fontSize: 20, letterSpacing: -0.4, color: AU.ink, marginTop: 20 },
  codeHint: { fontFamily: AF.med, fontSize: 13.5, color: AU.muted, marginTop: 4 },
});
