import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Button, Input, Badge } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { getMyKyc, updateMyKyc, DriverKyc } from '@/services/driver.service';
import { uploadImage, resolveUploadUrl } from '@/services/upload.service';
import { VehicleType } from '@/types';

type IconSet = 'ionicons' | 'material';

const VEHICLE_OPTIONS: {
  value: VehicleType;
  label: string;
  iconSet: IconSet;
  icon: string;
}[] = [
  { value: 'moto', label: 'Moto', iconSet: 'material', icon: 'motorbike' },
  { value: 'velo', label: 'Velo', iconSet: 'ionicons', icon: 'bicycle' },
  { value: 'voiture', label: 'Voiture', iconSet: 'ionicons', icon: 'car' },
  { value: 'tricycle', label: 'Tricycle', iconSet: 'material', icon: 'rickshaw' },
];

function VehicleIcon({
  iconSet,
  name,
  size,
  color,
}: {
  iconSet: IconSet;
  name: string;
  size: number;
  color: string;
}) {
  if (iconSet === 'material') {
    return <MaterialCommunityIcons name={name as any} size={size} color={color} />;
  }
  return <Ionicons name={name as any} size={size} color={color} />;
}

export default function DriverKycScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [kyc, setKyc] = useState<DriverKyc | null>(null);

  // champs locaux editables
  const [vehicleType, setVehicleType] = useState<VehicleType>('moto');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [vehiclePhotoUrl, setVehiclePhotoUrl] = useState<string | null>(null);
  const [cnibNumber, setCnibNumber] = useState('');
  const [cnibPhotoUrl, setCnibPhotoUrl] = useState<string | null>(null);
  /** CNIB verso : ajoute au registration KYC, modifiable ensuite ici. */
  const [cnibPhotoBackUrl, setCnibPhotoBackUrl] = useState<string | null>(null);
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licensePhotoUrl, setLicensePhotoUrl] = useState<string | null>(null);

  const [uploadingField, setUploadingField] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const data = await getMyKyc();
      if (data) {
        setKyc(data);
        setVehicleType(data.vehicleType);
        setVehiclePlate(data.vehiclePlate ?? '');
        setVehiclePhotoUrl(data.vehiclePhotoUrl);
        setCnibNumber(data.cnibNumber ?? '');
        setCnibPhotoUrl(data.cnibPhotoUrl);
        setCnibPhotoBackUrl(data.cnibPhotoBackUrl ?? null);
        setLicenseNumber(data.licenseNumber ?? '');
        setLicensePhotoUrl(data.licensePhotoUrl);
      }
      setLoading(false);
    })();
  }, []);

  const pickAndUpload = async (
    field: 'vehicle' | 'cnib' | 'cnibBack' | 'license',
    setter: (url: string) => void,
  ) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Autorisez l\'acces a la galerie.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (res.canceled || !res.assets[0]) return;

    setUploadingField(field);
    const uploaded = await uploadImage(res.assets[0].uri, 'kyc');
    setUploadingField(null);
    if (uploaded) {
      setter(uploaded.url);
    } else {
      Alert.alert('Erreur', 'Impossible d\'envoyer l\'image.');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const updated = await updateMyKyc({
      vehicleType,
      vehiclePlate: vehiclePlate.trim() || undefined,
      vehiclePhotoUrl: vehiclePhotoUrl ?? undefined,
      cnibNumber: cnibNumber.trim() || undefined,
      cnibPhotoUrl: cnibPhotoUrl ?? undefined,
      cnibPhotoBackUrl: cnibPhotoBackUrl ?? undefined,
      licenseNumber: licenseNumber.trim() || undefined,
      licensePhotoUrl: licensePhotoUrl ?? undefined,
    });
    setSaving(false);
    if (updated) {
      setKyc(updated);
      Alert.alert(
        'Dossier envoyé',
        'Vos informations ont été envoyées pour vérification. Vous pouvez commencer à recevoir des courses dès que votre dossier sera approuvé.',
        [
          {
            text: 'Continuer',
            onPress: () => router.replace('/(driver)'),
          },
        ],
      );
    } else {
      Alert.alert('Erreur', 'Échec de l\'enregistrement.');
    }
  };

  const handleBack = () => {
    // Safely return to driver home (handles new-driver case coming from register)
    router.replace('/(driver)');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes documents</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {kyc && (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>Statut de vérification</Text>
            <View style={styles.statusRow}>
              {kyc.verificationStatus === 'verified' ? (
                <View style={[styles.badge, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                  <Text style={[styles.badgeText, { color: colors.primaryDark }]}>
                    Verifie
                  </Text>
                </View>
              ) : kyc.verificationStatus === 'rejected' ? (
                <View style={[styles.badge, { backgroundColor: colors.errorLight }]}>
                  <Ionicons name="close-circle" size={16} color={colors.error} />
                  <Text style={[styles.badgeText, { color: colors.error }]}>Refusé</Text>
                </View>
              ) : (
                <View style={[styles.badge, { backgroundColor: colors.warningLight }]}>
                  <Ionicons name="time-outline" size={16} color={colors.warning} />
                  <Text style={[styles.badgeText, { color: colors.warning }]}>
                    En attente
                  </Text>
                </View>
              )}
            </View>
            {kyc.verificationNote ? (
              <Text style={styles.statusNote}>Note : {kyc.verificationNote}</Text>
            ) : null}
          </View>
        )}

        {/* Vehicule */}
        <Text style={styles.sectionTitle}>Vehicule</Text>
        <View style={styles.vehicleGrid}>
          {VEHICLE_OPTIONS.map((v) => {
            const sel = vehicleType === v.value;
            return (
              <TouchableOpacity
                key={v.value}
                style={[styles.vehicleCard, sel && styles.vehicleCardSelected]}
                onPress={() => setVehicleType(v.value)}
                activeOpacity={0.7}
              >
                <VehicleIcon
                  iconSet={v.iconSet}
                  name={v.icon}
                  size={28}
                  color={sel ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.vehicleLabel, sel && styles.vehicleLabelSelected]}>
                  {v.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Input
          label="Plaque d'immatriculation (optionnel)"
          placeholder="Ex: 11 BF 1234"
          value={vehiclePlate}
          onChangeText={setVehiclePlate}
          containerStyle={{ marginTop: spacing.sm }}
        />

        <DocField
          label="Photo du vehicule"
          url={vehiclePhotoUrl}
          uploading={uploadingField === 'vehicle'}
          onPick={() => pickAndUpload('vehicle', setVehiclePhotoUrl)}
        />

        {/* CNIB */}
        <Text style={styles.sectionTitle}>Carte nationale (CNIB)</Text>
        <Input
          label="Numéro CNIB"
          placeholder="B1234567"
          value={cnibNumber}
          onChangeText={setCnibNumber}
          autoCapitalize="characters"
        />
        <DocField
          label="Photo de la CNIB (recto)"
          url={cnibPhotoUrl}
          uploading={uploadingField === 'cnib'}
          onPick={() => pickAndUpload('cnib', setCnibPhotoUrl)}
        />
        <DocField
          label="Photo de la CNIB (verso)"
          url={cnibPhotoBackUrl}
          uploading={uploadingField === 'cnibBack'}
          onPick={() => pickAndUpload('cnibBack', setCnibPhotoBackUrl)}
        />

        {/* Permis */}
        <Text style={styles.sectionTitle}>Permis de conduire</Text>
        <Input
          label="Numéro du permis"
          placeholder="Ex: 123456789"
          value={licenseNumber}
          onChangeText={setLicenseNumber}
        />
        <DocField
          label="Photo du permis"
          url={licensePhotoUrl}
          uploading={uploadingField === 'license'}
          onPick={() => pickAndUpload('license', setLicensePhotoUrl)}
        />

        <View style={{ height: spacing.lg }} />
        <Button
          title="Envoyer pour vérification"
          onPress={handleSave}
          loading={saving}
        />
        <View style={{ height: spacing.xxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function DocField({
  label,
  url,
  uploading,
  onPick,
}: {
  label: string;
  url: string | null;
  uploading: boolean;
  onPick: () => void;
}) {
  const resolved = resolveUploadUrl(url);
  return (
    <View style={{ marginTop: spacing.sm }}>
      <Text style={styles.docLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.docBox}
        onPress={onPick}
        activeOpacity={0.7}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator color={colors.primary} />
        ) : resolved ? (
          <Image source={{ uri: resolved }} style={styles.docImage} />
        ) : (
          <View style={styles.docPlaceholder}>
            <Ionicons name="cloud-upload-outline" size={28} color={colors.textTertiary} />
            <Text style={styles.docHint}>Appuyez pour choisir une photo</Text>
          </View>
        )}
      </TouchableOpacity>
      {resolved && !uploading && (
        <TouchableOpacity style={styles.replaceBtn} onPress={onPick}>
          <Ionicons name="refresh" size={14} color={colors.primary} />
          <Text style={styles.replaceText}>Remplacer</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.bodyMedium, color: colors.textPrimary },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.md, gap: spacing.sm },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  statusCard: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    gap: spacing.xs,
  },
  statusTitle: { ...typography.captionMedium, color: colors.textSecondary },
  statusRow: { flexDirection: 'row' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
  },
  badgeText: { ...typography.captionMedium, fontWeight: '700' },
  statusNote: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  vehicleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  vehicleCard: {
    flex: 1,
    minWidth: '22%',
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    gap: 4,
  },
  vehicleCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  vehicleLabel: { ...typography.caption, color: colors.textSecondary },
  vehicleLabelSelected: { color: colors.primaryDark, fontWeight: '700' },
  docLabel: { ...typography.bodySmall, color: colors.textPrimary, marginBottom: 4 },
  docBox: {
    height: 180,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  docImage: { width: '100%', height: '100%' },
  docPlaceholder: { alignItems: 'center', gap: 6 },
  docHint: { ...typography.caption, color: colors.textTertiary },
  replaceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  replaceText: {
    ...typography.caption,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
