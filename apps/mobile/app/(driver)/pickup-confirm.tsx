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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeInDown,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Button, OtpInput } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useDriverStore } from '@/stores/driver.store';
import { uploadImage } from '@/services/upload.service';
import { alertConfirmSuccess } from '@/utils/alerts';
import { openPhone } from '@/utils/linking';

/**
 * Ecran de confirmation de récupération du colis.
 *
 * Flow progressif et visuel :
 *   1. Encart "Expéditeur sur place" (info récupération)
 *   2. Capture photo du colis
 *   3. Saisie code de récupération a 4 chiffres
 *   4. Bouton "Confirmer la récupération"
 *
 * Chaque étape s'anime a l'apparition. L'étape en cours est mise en avant
 * par une bordure accentuee et une pastille verte de "validé" apparait au
 * fur et a mesure.
 */
export default function PickupConfirmScreen() {
  const router = useRouter();
  const { confirmPickup, activeDelivery } = useDriverStore();
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pickupCode, setPickupCode] = useState('');

  const hasThirdParty = !!activeDelivery?.senderContactName;
  const photoDone = !!photo;
  const codeDone = pickupCode.length === 4;

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
      Alert.alert(
        'Erreur caméra',
        err?.message ?? "Impossible d'ouvrir l'appareil photo.",
      );
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Récupération du colis</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Encart expéditeur */}
        {hasThirdParty && (
          <Animated.View
            entering={FadeInDown.duration(350).delay(50)}
            style={styles.senderCard}
          >
            <View style={styles.senderAvatar}>
              <Ionicons name="person" size={24} color={colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.senderLabel}>Expéditeur du colis</Text>
              <Text style={styles.senderName}>
                {activeDelivery?.senderContactName}
              </Text>
            </View>
            {activeDelivery?.senderContactPhone && (
              <TouchableOpacity
                style={styles.senderCallBtn}
                onPress={() => openPhone(activeDelivery.senderContactPhone!)}
              >
                <Ionicons name="call" size={20} color={colors.primary} />
              </TouchableOpacity>
            )}
          </Animated.View>
        )}

        {/* Étape 1 — Photo */}
        <Animated.View
          entering={FadeInDown.duration(350).delay(120)}
          style={[
            styles.stepCard,
            photoDone && styles.stepCardDone,
            !photoDone && styles.stepCardCurrent,
          ]}
        >
          <View style={styles.stepHeader}>
            <StepBadge index={1} done={photoDone} />
            <Text style={styles.stepTitle}>Photo du colis</Text>
            {photoDone && <CheckPulse />}
          </View>
          <Text style={styles.stepHint}>
            Prenez une photo nette du colis avant de partir.
          </Text>

          {photo ? (
            <View style={styles.photoContainer}>
              <Image source={{ uri: photo }} style={styles.photo} />
              <TouchableOpacity
                style={styles.retakeButton}
                onPress={takePhoto}
              >
                <Ionicons name="camera" size={18} color={colors.white} />
                <Text style={styles.retakeText}>Reprendre</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.cameraPlaceholder}
              onPress={takePhoto}
              activeOpacity={0.8}
            >
              <Ionicons
                name="camera-outline"
                size={48}
                color={colors.primary}
              />
              <Text style={styles.cameraText}>
                Appuyez pour prendre la photo
              </Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Étape 2 — Code */}
        <Animated.View
          entering={FadeInDown.duration(350).delay(200)}
          style={[
            styles.stepCard,
            codeDone && styles.stepCardDone,
            photoDone && !codeDone && styles.stepCardCurrent,
          ]}
        >
          <View style={styles.stepHeader}>
            <StepBadge index={2} done={codeDone} />
            <Text style={styles.stepTitle}>Code de récupération</Text>
            {codeDone && <CheckPulse />}
          </View>
          <Text style={styles.stepHint}>
            {hasThirdParty
              ? `Demandez à ${activeDelivery?.senderContactName} son code à 4 chiffres.`
              : "Demandez à l'expéditeur son code à 4 chiffres."}
          </Text>
          <View style={styles.otpWrap}>
            <OtpInput
              length={4}
              value={pickupCode}
              onChange={setPickupCode}
            />
          </View>
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title="Confirmer la récupération"
          onPress={handleConfirm}
          disabled={!photoDone || !codeDone}
          loading={uploading}
        />
      </View>
    </SafeAreaView>
  );
}

function StepBadge({ index, done }: { index: number; done: boolean }) {
  return (
    <View style={[styles.badge, done && styles.badgeDone]}>
      {done ? (
        <Ionicons name="checkmark" size={16} color={colors.white} />
      ) : (
        <Text style={styles.badgeText}>{index}</Text>
      )}
    </View>
  );
}

/** Petit effet de pulsation verte quand une étape passe à "fait". */
function CheckPulse() {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.15, {
        duration: 900,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[styles.checkPulse, style]}
    >
      <Ionicons name="checkmark-circle" size={22} color={colors.success} />
    </Animated.View>
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
  headerTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  senderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primaryLight,
  },
  senderAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  senderLabel: {
    ...typography.caption,
    color: colors.primaryDark,
  },
  senderName: {
    ...typography.bodyMedium,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  senderCallBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCard: {
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  stepCardCurrent: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  stepCardDone: {
    borderColor: colors.successLight,
    backgroundColor: '#F4FBF5',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  badgeText: {
    ...typography.captionMedium,
    color: colors.textSecondary,
  },
  stepTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
  },
  checkPulse: {},
  stepHint: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  cameraPlaceholder: {
    height: 180,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryLight,
  },
  cameraText: {
    ...typography.bodySmall,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  photoContainer: {
    height: 200,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  photo: {
    flex: 1,
  },
  retakeButton: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  retakeText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '600',
  },
  otpWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
