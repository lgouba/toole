import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Button, OtpInput } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useDriverStore } from '@/stores/driver.store';
import { uploadImage } from '@/services/upload.service';
import { alertConfirmSuccess } from '@/utils/alerts';

export default function PickupConfirmScreen() {
  const router = useRouter();
  const { confirmPickup, activeDelivery } = useDriverStore();
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pickupCode, setPickupCode] = useState('');

  const takePhoto = async () => {
    try {
      // Demande explicite de permission camera (Android a besoin d'une demande
      // a chaque usage si pas encore accordee)
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permission camera refusee',
          "Autorisez l'acces a l'appareil photo dans les parametres de votre telephone pour prendre la photo du colis.",
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
      Alert.alert(
        'Erreur camera',
        err?.message ?? "Impossible d'ouvrir l'appareil photo.",
      );
    }
  };

  const handleConfirm = async () => {
    if (!photo) return;
    if (pickupCode.length !== 4) {
      Alert.alert('Code manquant', 'Demandez a l\'expediteur son code de recuperation a 4 chiffres.');
      return;
    }
    setUploading(true);
    try {
      console.log('[pickup-confirm] uploading photo...');
      const uploaded = await uploadImage(photo, 'packages');
      if (!uploaded) {
        Alert.alert('Erreur', 'Impossible d\'envoyer la photo. Reessayez.');
        return;
      }
      console.log('[pickup-confirm] photo uploaded, calling backend...');
      await confirmPickup(uploaded.url, pickupCode);
      console.log('[pickup-confirm] backend OK, navigating');
      alertConfirmSuccess();
      router.replace('/(driver)/delivery-navigation');
    } catch (err: any) {
      console.warn('[pickup-confirm] error:', err);
      const msg =
        err?.response?.data?.error?.message ??
        err?.message ??
        'Echec de la confirmation. Reessayez.';
      Alert.alert('Erreur', msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Photo du colis</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.instruction}>
          Prenez une photo du colis avant de partir
        </Text>

        {activeDelivery?.senderContactName && (
          <View style={styles.senderBox}>
            <Ionicons
              name="person-outline"
              size={18}
              color={colors.primaryDark}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.senderBoxLabel}>Expediteur du colis</Text>
              <Text style={styles.senderBoxValue}>
                {activeDelivery.senderContactName}
              </Text>
            </View>
          </View>
        )}

        {photo ? (
          <View style={styles.photoContainer}>
            <Image source={{ uri: photo }} style={styles.photo} />
            <TouchableOpacity style={styles.retakeButton} onPress={takePhoto}>
              <Ionicons name="camera" size={20} color={colors.white} />
              <Text style={styles.retakeText}>Reprendre</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.cameraPlaceholder} onPress={takePhoto}>
            <Ionicons name="camera-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.cameraText}>Appuyez pour prendre une photo</Text>
          </TouchableOpacity>
        )}

        <View style={styles.codeBlock}>
          <Text style={styles.codeTitle}>Code de recuperation</Text>
          <Text style={styles.codeSubtitle}>
            Demandez a l'expediteur son code a 4 chiffres.
          </Text>
          <View style={styles.otpWrap}>
            <OtpInput
              length={4}
              value={pickupCode}
              onChange={setPickupCode}
            />
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          title="Confirmer la recuperation"
          onPress={handleConfirm}
          disabled={!photo || pickupCode.length !== 4}
          loading={uploading}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  title: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  instruction: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  cameraPlaceholder: {
    flex: 1,
    maxHeight: 400,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  cameraText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  photoContainer: {
    flex: 1,
    maxHeight: 400,
  },
  photo: {
    flex: 1,
    borderRadius: borderRadius.lg,
  },
  retakeButton: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  retakeText: {
    ...typography.bodySmall,
    color: colors.white,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  senderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    marginBottom: spacing.md,
  },
  senderBoxLabel: {
    ...typography.caption,
    color: colors.primaryDark,
  },
  senderBoxValue: {
    ...typography.bodyMedium,
    color: colors.primaryDark,
  },
  codeBlock: {
    marginTop: spacing.lg,
  },
  codeTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  codeSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  otpWrap: {
    alignItems: 'center',
  },
});
