import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useDriverStore } from '@/stores/driver.store';

export default function PickupConfirmScreen() {
  const router = useRouter();
  const { confirmPickup } = useDriverStore();
  const [photo, setPhoto] = useState<string | null>(null);

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0].uri);
    }
  };

  const handleConfirm = async () => {
    if (!photo) return;
    await confirmPickup(photo);
    router.replace('/(driver)/delivery-navigation');
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
      </View>

      <View style={styles.footer}>
        <Button
          title="Confirmer la recuperation"
          onPress={handleConfirm}
          disabled={!photo}
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
});
