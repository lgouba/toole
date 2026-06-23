import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { DriverHood } from '@/components/driver/flow/DriverHood';
import { C, F } from '@/components/driver/flow/tokens';
import { OtpInput } from '@/components/ui';
import { useDriverStore } from '@/stores/driver.store';
import { uploadImage } from '@/services/upload.service';
import { alertConfirmSuccess } from '@/utils/alerts';
import { openPhone } from '@/utils/linking';

export default function PickupConfirmScreen() {
  const router = useRouter();
  const { confirmPickup, activeDelivery } = useDriverStore();
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pickupCode, setPickupCode] = useState('');

  // Reset à chaque nouvelle course (l'écran est gardé monté par le Tabs navigator).
  useEffect(() => {
    setPhoto(null);
    setPickupCode('');
    setUploading(false);
  }, [activeDelivery?.id]);

  const photoDone = !!photo;
  const codeDone = pickupCode.length === 4;
  const senderName =
    activeDelivery?.senderContactName ?? activeDelivery?.senderName ?? 'Expéditeur';
  // Récupération : on appelle la personne qui détient le colis — contact tiers
  // s'il existe, sinon le client (expéditeur) lui-même.
  const pickupPhone =
    activeDelivery?.senderContactPhone ||
    activeDelivery?.senderPhone ||
    activeDelivery?.recipientPhone;

  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permission caméra refusée',
          "Autorisez l'accès à l'appareil photo dans les paramètres de votre téléphone pour prendre la photo du colis.",
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
      });
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
      Alert.alert(
        'Code manquant',
        "Demandez à l'expéditeur son code de récupération à 4 chiffres.",
      );
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
      const msg =
        err?.response?.data?.error?.message ??
        err?.message ??
        'Échec de la confirmation. Réessayez.';
      if (apiCode === 'INVALID_PICKUP_CODE') {
        Alert.alert(
          'Code incorrect',
          "Le code saisi ne correspond pas. Demandez à l'expéditeur de vous redonner le bon code.",
        );
        setPickupCode('');
      } else {
        Alert.alert('Erreur', msg);
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <DriverHood height={196} step={2} onBack={() => router.back()}>
        <View style={styles.who}>
          <View style={styles.avatar}>
            <Ionicons name="person-outline" size={26} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.role}>EXPÉDITEUR</Text>
            <Text style={styles.name} numberOfLines={1}>
              {senderName}
            </Text>
          </View>
          {pickupPhone ? (
            <TouchableOpacity
              style={styles.callBig}
              onPress={() => openPhone(pickupPhone)}
              accessibilityLabel="Appeler l'expéditeur"
            >
              <Ionicons name="call" size={20} color={C.gDark} />
            </TouchableOpacity>
          ) : null}
        </View>
      </DriverHood>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.h}>Photo du colis</Text>
        <Text style={styles.hint}>Preuve de prise en charge.</Text>
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

        <Text style={[styles.h, { fontSize: 18, marginTop: 22 }]}>
          Code de l'expéditeur
        </Text>
        <Text style={styles.hint}>
          {`Demandez à ${senderName} son code à 4 chiffres.`}
        </Text>
        <View style={styles.codeWrap}>
          <OtpInput length={4} value={pickupCode} onChange={setPickupCode} variant="driver" />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.cta, (!photoDone || !codeDone || uploading) && styles.ctaOff]}
          activeOpacity={0.9}
          disabled={!photoDone || !codeDone || uploading}
          onPress={handleConfirm}
        >
          <Text style={styles.ctaText}>
            {uploading ? 'Confirmation…' : 'Confirmer la récupération'}
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

  content: { padding: 20, paddingBottom: 28 },
  h: { fontFamily: F.display, fontSize: 20, color: C.ink },
  hint: { fontFamily: F.ui, fontSize: 13, color: C.muted, marginTop: 6, marginBottom: 14 },

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

  codeWrap: { alignItems: 'center', paddingVertical: 4 },

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
