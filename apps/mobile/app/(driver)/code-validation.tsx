import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { DriverHood } from '@/components/driver/flow/DriverHood';
import { C, F } from '@/components/driver/flow/tokens';
import { OtpInput } from '@/components/ui';
import { useDriverStore } from '@/stores/driver.store';
import { uploadImage } from '@/services/upload.service';
import { haptic } from '@/utils/haptics';
import { alertConfirmSuccess } from '@/utils/alerts';
import { openPhone } from '@/utils/linking';
import { formatCFA } from '@/utils/format';

export default function CodeValidationScreen() {
  const router = useRouter();
  const { validateCode, activeDelivery } = useDriverStore();
  const [code, setCode] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setCode('');
    setPhoto(null);
    setError('');
    setAttempts(0);
    setSubmitting(false);
  }, [activeDelivery?.id]);

  const recipientName = activeDelivery?.recipientName ?? 'Destinataire';
  const recipientPhone = activeDelivery?.recipientPhone;
  const codeDone = code.length === 4;
  const photoDone = !!photo;
  const blocked = attempts >= 3;

  const prepaid =
    activeDelivery?.paymentMethod === 'orange_money' ||
    activeDelivery?.paymentMethod === 'moov_money';

  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permission caméra refusée',
          "Autorisez l'accès à l'appareil photo pour prendre la preuve de remise du colis.",
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });
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
      // 1) Upload de la preuve de remise (obligatoire) avant de valider le code.
      const uploaded = await uploadImage(photo!, 'packages');
      if (!uploaded) {
        haptic.error();
        setError("Impossible d'envoyer la photo. Vérifiez votre réseau et réessayez.");
        return;
      }
      // 2) Validation du code + rattachement de la photo à la course.
      const success = await validateCode(code, uploaded.url);
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
        <Text style={styles.h}>Photo de remise</Text>
        <Text style={styles.hint}>Preuve que le colis a bien été remis.</Text>
        {photo ? (
          <View style={styles.photoBox}>
            <Image source={{ uri: photo }} style={styles.photoImg} />
            <TouchableOpacity style={styles.retake} onPress={takePhoto}>
              <Ionicons name="camera" size={16} color="#fff" />
              <Text style={styles.retakeText}>Reprendre</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.photo} onPress={takePhoto} activeOpacity={0.85}>
            <View style={styles.photoCircle}>
              <Ionicons name="camera-outline" size={26} color={C.gDark} />
            </View>
            <Text style={styles.photoText}>Prendre la photo</Text>
          </TouchableOpacity>
        )}

        <Text style={[styles.h, { marginTop: 22 }]}>Code du destinataire</Text>
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
          style={[styles.cta, (!photoDone || !codeDone || blocked || submitting) && styles.ctaOff]}
          activeOpacity={0.9}
          disabled={!photoDone || !codeDone || blocked || submitting}
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
  hint: { fontFamily: F.ui, fontSize: 13, color: C.muted, marginTop: 6, marginBottom: 14 },
  codeWrap: { alignItems: 'center', paddingVertical: 4 },

  photo: {
    borderRadius: 20,
    backgroundColor: '#F1FAF4',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#A6DBB8',
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  photoCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.gDark,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  photoText: { color: C.gDark, fontFamily: F.uiBold, fontSize: 14 },
  photoBox: { height: 170, borderRadius: 20, overflow: 'hidden' },
  photoImg: { flex: 1 },
  retake: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  retakeText: { color: '#fff', fontFamily: F.uiSemi, fontSize: 12 },
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
