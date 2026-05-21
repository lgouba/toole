import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Input } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { UserRole } from '@/types';
import * as ImagePicker from 'expo-image-picker';
import { uploadImage } from '@/services/upload.service';
import { api } from '@/services/api.client';

type VehicleType = 'moto' | 'velo' | 'voiture' | 'tricycle';

const roles: {
  type: UserRole;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  description: string;
}[] = [
  {
    type: 'client',
    icon: 'cube-outline',
    title: 'Client',
    subtitle: "J'envoie des colis",
    description: 'Faites livrer un colis partout en ville en quelques minutes.',
  },
  {
    type: 'driver',
    icon: 'bicycle-outline',
    title: 'Livreur',
    subtitle: 'Je livré des colis',
    description:
      "Inscrivez-vous comme livreur indépendant, fixez vos horaires et gagnez de l'argent.",
  },
];

// Icones: on utilise MaterialCommunityIcons pour avoir une vraie moto et un
// vrai rickshaw (tricycle), que Ionicons ne fournit pas.
const vehicles: {
  type: VehicleType;
  iconSet: 'ionicons' | 'material';
  icon: string;
  label: string;
}[] = [
  { type: 'moto', iconSet: 'material', icon: 'motorbike', label: 'Moto' },
  { type: 'velo', iconSet: 'ionicons', icon: 'bicycle-outline', label: 'Velo' },
  { type: 'tricycle', iconSet: 'material', icon: 'rickshaw', label: 'Tricycle' },
  { type: 'voiture', iconSet: 'ionicons', icon: 'car-outline', label: 'Voiture' },
];

function VehicleIcon({
  iconSet,
  name,
  size,
  color,
}: {
  iconSet: 'ionicons' | 'material';
  name: string;
  size: number;
  color: string;
}) {
  if (iconSet === 'material') {
    return <MaterialCommunityIcons name={name as any} size={size} color={color} />;
  }
  return <Ionicons name={name as any} size={size} color={color} />;
}

type Step = 'role' | 'identity' | 'vehicle' | 'kyc';

import { Image } from 'react-native';

function KycPhotoButton({
  label,
  uri,
  onPress,
}: {
  label: string;
  uri: string | null;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.kycPhotoBtn,
        uri ? styles.kycPhotoBtnFilled : undefined,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {uri ? (
        <>
          <Image source={{ uri }} style={styles.kycPhotoThumb} />
          <View style={styles.kycPhotoOverlay}>
            <Ionicons name="camera" size={18} color={colors.white} />
          </View>
        </>
      ) : (
        <>
          <Ionicons name="camera-outline" size={26} color={colors.primary} />
          <Text style={styles.kycPhotoBtnLabel}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const CURRENT_YEAR = new Date().getFullYear();

function validateDate(d: string, m: string, y: string): string | null {
  const day = parseInt(d, 10);
  const month = parseInt(m, 10);
  const year = parseInt(y, 10);
  if (!day || !month || !year) return 'Date incomplete';
  if (day < 1 || day > 31) return 'Jour invalide';
  if (month < 1 || month > 12) return 'Mois invalide';
  if (year < 1920 || year > CURRENT_YEAR - 16) {
    return `Vous devez avoir au moins 16 ans`;
  }
  const dt = new Date(year, month - 1, day);
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return 'Date invalide';
  }
  return null;
}

export default function RegisterScreen() {
  const router = useRouter();
  const { register, isLoading, logout } = useAuthStore();
  const appName = useSettingsStore((s) => s.settings.appName);
  const [step, setStep] = useState<Step>('role');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  // Identity
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  // Driver only
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);
  const [vehiclePlate, setVehiclePlate] = useState('');

  // Driver KYC : email + photos piece d'identite (recto + verso)
  const [email, setEmail] = useState('');
  const [cnibFrontUri, setCnibFrontUri] = useState<string | null>(null);
  const [cnibBackUri, setCnibBackUri] = useState<string | null>(null);
  const [submittingKyc, setSubmittingKyc] = useState(false);

  // Code de parrainage (optionnel) — actuellement stocke seulement, la logique
  // de bonus (parrain X FCFA / parraine Y FCFA) sera activee plus tard.
  const [referralCode, setReferralCode] = useState('');

  const [error, setError] = useState('');

  const totalSteps = selectedRole === 'driver' ? 4 : 2;
  const currentStepIndex = useMemo(() => {
    if (step === 'role') return 1;
    if (step === 'identity') return 2;
    if (step === 'vehicle') return 3;
    return 4; // kyc
  }, [step]);

  const handleBack = () => {
    setError('');
    if (step === 'identity') return setStep('role');
    if (step === 'vehicle') return setStep('identity');
    if (step === 'kyc') return setStep('vehicle');
    // Step 'role' : back to login
    logout();
    router.replace('/(auth)/login');
  };

  const handleRoleNext = () => {
    if (!selectedRole) return;
    setStep('identity');
  };

  const handleIdentityNext = async () => {
    setError('');
    if (firstName.trim().length < 2) {
      setError('Entrez votre prenom (2 caracteres min)');
      return;
    }
    if (lastName.trim().length < 2) {
      setError('Entrez votre nom (2 caracteres min)');
      return;
    }
    const dateErr = validateDate(day, month, year);
    if (dateErr) {
      setError(dateErr);
      return;
    }

    if (selectedRole === 'driver') {
      setStep('vehicle');
      return;
    }

    await doRegister();
  };

  const handleVehicleConfirm = () => {
    if (!vehicleType) return;
    // Pour les drivers, on enchaine sur le step KYC (email + 2 photos d'identite).
    // Le register lui-meme se fait apres soumission du KYC, pour que le compte
    // soit cree avec les justificatifs deja attaches (etat 'pending').
    setStep('kyc');
  };

  const pickPhoto = async (which: 'front' | 'back') => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      setError(
        "Permission appareil photo refusee. Activez-la dans les reglages.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      if (which === 'front') setCnibFrontUri(result.assets[0].uri);
      else setCnibBackUri(result.assets[0].uri);
    }
  };

  const handleKycSubmit = async () => {
    setError('');
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Entrez une adresse email valide.');
      return;
    }
    if (!cnibFrontUri) {
      setError("Ajoutez la photo recto de votre piece d'identite.");
      return;
    }
    if (!cnibBackUri) {
      setError("Ajoutez la photo verso de votre piece d'identite.");
      return;
    }

    setSubmittingKyc(true);
    try {
      // 1) Cree d'abord le compte driver (avec email). Le register utilise
      //    l'OTP deja valide, le compte sera cree en isActive=false +
      //    verificationStatus=pending.
      const created = await doRegister();
      if (!created) {
        // doRegister a deja appele setError, on stoppe ici.
        setSubmittingKyc(false);
        return;
      }

      // 2) Upload des deux photos. On parallelise pour gagner du temps.
      const [front, back] = await Promise.all([
        uploadImage(cnibFrontUri, 'kyc'),
        uploadImage(cnibBackUri, 'kyc'),
      ]);
      if (!front || !back) {
        setError(
          "Une des photos n'a pas pu etre envoyee. Reessayez avec une meilleure connexion.",
        );
        setSubmittingKyc(false);
        return;
      }

      // 3) Attache les URLs photos au profil driver via PUT /drivers/me/kyc.
      await api.put('/drivers/me/kyc', {
        cnibPhotoUrl: front.url,
        cnibPhotoBackUrl: back.url,
      });

      // 4) Logout + redirection ecran login avec message d'attente.
      // Comme le compte est isActive=false, on ne peut pas rester loggue.
      // L'utilisateur sera notifie quand l'admin validera.
      logout();
      router.replace('/(auth)/login');
      // Petit alert pour le rassurer.
      setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Alert } = require('react-native');
        Alert.alert(
          'Inscription envoyée',
          "Vos justificatifs sont en cours de validation par notre equipe (24-48h). Vous recevrez une notification des l'activation de votre compte.",
        );
      }, 200);
    } catch (err: any) {
      setError(
        err?.response?.data?.error?.message ??
          'Impossible de soumettre le KYC. Reessayez dans un instant.',
      );
    } finally {
      setSubmittingKyc(false);
    }
  };

  /**
   * Cree le compte cote serveur. Retourne true en cas de succes, false sinon.
   * En cas d'echec, l'erreur est affichee via setError (pas de throw : sinon
   * unhandled promise rejection silencieuse qui semble bloquer l'UI).
   */
  const doRegister = async (): Promise<boolean> => {
    if (!selectedRole) return false;
    setError('');
    const dob = `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const ok = await register({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dateOfBirth: dob,
      userType: selectedRole,
      vehicleType: vehicleType ?? undefined,
      vehiclePlate: vehiclePlate.trim() || undefined,
      email: email.trim() || undefined,
      referralCode: referralCode.trim() || undefined,
      // Pour le driver, on differe l'authentification : sinon l'auth guard
      // redirige immediatement vers /(driver) et empeche l'upload KYC qui suit.
      deferAuth: selectedRole === 'driver',
    });
    if (!ok) {
      setError(
        'Impossible de créer le compte. Le code OTP a peut-être expiré, demandez-en un nouveau.',
      );
      return false;
    }
    // Pour client : redirection direct sur la home.
    // Pour driver : on continue le flow KYC (pas de redirection ici).
    if (selectedRole === 'client') {
      router.replace('/(client)');
    }
    return true;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.stepIndicator}>
          Étape {currentStepIndex}/{totalSteps}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${(currentStepIndex / totalSteps) * 100}%` },
          ]}
        />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
        {/* Tap n'importe ou hors d'un Input ferme le clavier numerique
            (qui n'a pas de bouton "Retour" natif). */}
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View>
          {step === 'role' && (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Bienvenue sur {appName}</Text>
                <Text style={styles.subtitle}>
                  Choisissez votre profil pour commencer
                </Text>
              </View>

              <View style={styles.cardsGrid}>
                {roles.map((role) => {
                  const isSelected = selectedRole === role.type;
                  return (
                    <TouchableOpacity
                      key={role.type}
                      style={[
                        styles.roleCard,
                        isSelected && styles.roleCardSelected,
                      ]}
                      onPress={() => setSelectedRole(role.type)}
                      activeOpacity={0.8}
                    >
                      <View
                        style={[
                          styles.roleIconBox,
                          isSelected && styles.roleIconBoxSelected,
                        ]}
                      >
                        <Ionicons
                          name={role.icon}
                          size={28}
                          color={isSelected ? colors.white : colors.primary}
                        />
                      </View>
                      <View style={styles.roleTextWrap}>
                        <Text
                          style={[
                            styles.roleTitle,
                            isSelected && styles.roleTitleSelected,
                          ]}
                        >
                          {role.title}
                        </Text>
                        <Text style={styles.roleSubtitle}>{role.subtitle}</Text>
                        <Text style={styles.roleDescription}>
                          {role.description}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.roleRadio,
                          isSelected && styles.roleRadioSelected,
                        ]}
                      >
                        {isSelected ? (
                          <Ionicons name="checkmark" size={14} color={colors.white} />
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.roleHelp}>
                Vous pourrez modifier ces choix plus tard dans votre profil.
              </Text>
            </>
          )}

          {step === 'identity' && (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Vos informations</Text>
                <Text style={styles.subtitle}>
                  Ces informations seront visibles par les autres utilisateurs
                </Text>
              </View>

              <View style={styles.form}>
                <Input
                  label="Prénom *"
                  placeholder="Aminata"
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                  autoFocus
                />

                <Input
                  label="Nom *"
                  placeholder="Ouedraogo"
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                />

                <View>
                  <Text style={styles.dobLabel}>Date de naissance *</Text>
                  <View style={styles.dobRow}>
                    <TextInput
                      style={styles.dobInput}
                      placeholder="JJ"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="number-pad"
                      maxLength={2}
                      value={day}
                      onChangeText={(t) => {
                        const v = t.replace(/\D/g, '');
                        setDay(v);
                        if (v.length === 2) monthRef.current?.focus();
                      }}
                    />
                    <Text style={styles.dobSeparator}>/</Text>
                    <TextInput
                      ref={monthRef}
                      style={styles.dobInput}
                      placeholder="MM"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="number-pad"
                      maxLength={2}
                      value={month}
                      onChangeText={(t) => {
                        const v = t.replace(/\D/g, '');
                        setMonth(v);
                        if (v.length === 2) yearRef.current?.focus();
                      }}
                    />
                    <Text style={styles.dobSeparator}>/</Text>
                    <TextInput
                      ref={yearRef}
                      style={[styles.dobInput, styles.dobInputYear]}
                      placeholder="AAAA"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="number-pad"
                      maxLength={4}
                      value={year}
                      onChangeText={(t) => setYear(t.replace(/\D/g, ''))}
                    />
                  </View>
                  <Text style={styles.dobHint}>Format : JJ / MM / AAAA</Text>
                </View>

                <Input
                  label="Code de parrainage (optionnel)"
                  placeholder="Ex : AMINA22"
                  value={referralCode}
                  onChangeText={(t) => setReferralCode(t.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={20}
                />

                {error ? <Text style={styles.error}>{error}</Text> : null}
              </View>
            </>
          )}

          {step === 'vehicle' && (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Votre vehicule</Text>
                <Text style={styles.subtitle}>
                  Avec quoi effectuez-vous vos livraisons ?
                </Text>
              </View>

              <View style={styles.vehicleGrid}>
                {vehicles.map((v) => (
                  <TouchableOpacity
                    key={v.type}
                    style={[
                      styles.vehicleCard,
                      vehicleType === v.type && styles.vehicleCardSelected,
                    ]}
                    onPress={() => setVehicleType(v.type)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.vehicleIcon,
                        vehicleType === v.type && styles.vehicleIconSelected,
                      ]}
                    >
                      <VehicleIcon
                        iconSet={v.iconSet}
                        name={v.icon}
                        size={26}
                        color={
                          vehicleType === v.type ? colors.white : colors.primary
                        }
                      />
                    </View>
                    <Text
                      style={[
                        styles.vehicleCardLabel,
                        vehicleType === v.type && styles.vehicleCardLabelSelected,
                      ]}
                    >
                      {v.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ marginTop: spacing.md }}>
                <Input
                  label="Plaque d'immatriculation (optionnel)"
                  placeholder="Ex : 11 BF 1234"
                  value={vehiclePlate}
                  onChangeText={setVehiclePlate}
                  autoCapitalize="characters"
                />
                <Text style={styles.plateHint}>
                  Laissez vide si vous avez plusieurs vehicules ou n'avez pas encore
                  la plaque.
                </Text>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.infoBox}>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.infoText}>
                  Votre compte sera validé par notre équipe avant que vous ne puissiez
                  recevoir des courses.
                </Text>
              </View>
            </>
          )}

          {step === 'kyc' && (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Justificatifs d'identité</Text>
                <Text style={styles.subtitle}>
                  Notre équipe a besoin de vérifier ces documents avant
                  d'activer votre compte (24-48h).
                </Text>
              </View>

              <Input
                label="Email professionnel"
                placeholder="vous@exemple.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                containerStyle={styles.inputMargin}
              />

              <Text style={styles.kycSectionLabel}>
                Pièce d'identité (CNIB, passeport, permis)
              </Text>
              <View style={styles.kycPhotoRow}>
                <KycPhotoButton
                  label="Recto"
                  uri={cnibFrontUri}
                  onPress={() => pickPhoto('front')}
                />
                <KycPhotoButton
                  label="Verso"
                  uri={cnibBackUri}
                  onPress={() => pickPhoto('back')}
                />
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <View style={styles.infoBox}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={20}
                  color={colors.primary}
                />
                <Text style={styles.infoText}>
                  Vos documents sont chiffrés et utilisés uniquement pour
                  vérifier votre identité. Conformément à notre politique de
                  confidentialité.
                </Text>
              </View>
            </>
          )}
        </View>
        </TouchableWithoutFeedback>
        </ScrollView>

        <View style={styles.footer}>
          {step === 'role' && (
            <Button
              title="Continuer"
              onPress={handleRoleNext}
              disabled={!selectedRole}
            />
          )}
          {step === 'identity' && (
            <Button
              title={selectedRole === 'driver' ? 'Continuer' : 'Créer mon compte'}
              onPress={handleIdentityNext}
              loading={isLoading}
            />
          )}
          {step === 'vehicle' && (
            <Button
              title="Continuer"
              onPress={handleVehicleConfirm}
              loading={isLoading}
              disabled={!vehicleType}
            />
          )}
          {step === 'kyc' && (
            <Button
              title="Soumettre mes documents"
              onPress={handleKycSubmit}
              loading={submittingKyc || isLoading}
              disabled={!email.trim() || !cnibFrontUri || !cnibBackUri}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: { padding: 4 },
  stepIndicator: {
    ...typography.captionMedium,
    color: colors.textSecondary,
  },
  progressTrack: {
    height: 3,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  content: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  header: { marginBottom: spacing.xl },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  cardsGrid: { gap: spacing.md },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: colors.surface,
  },
  roleCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  roleIconBox: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleIconBoxSelected: { backgroundColor: colors.primary },
  roleTextWrap: { flex: 1, gap: 2 },
  roleTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  roleTitleSelected: { color: colors.primaryDark },
  roleSubtitle: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  roleDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 17,
    marginTop: 2,
  },
  roleRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleRadioSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleHelp: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.lg,
    fontStyle: 'italic',
  },
  form: { gap: spacing.md },
  dobLabel: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    marginBottom: 6,
    fontWeight: '600',
  },
  dobRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dobInput: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  dobInputYear: { flex: 1.5 },
  dobSeparator: {
    fontSize: 20,
    color: colors.textTertiary,
    fontWeight: '600',
  },
  dobHint: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 4,
  },
  error: {
    ...typography.bodySmall,
    color: colors.error,
    marginTop: spacing.sm,
  },
  vehicleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  vehicleCard: {
    flexBasis: '48%',
    flexGrow: 1,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: spacing.xs,
  },
  vehicleCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  vehicleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleIconSelected: { backgroundColor: colors.primary },
  vehicleCardLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  vehicleCardLabelSelected: { color: colors.primaryDark },
  plateHint: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 4,
  },
  // ============ Step KYC ============
  kycSectionLabel: {
    ...typography.captionMedium,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  kycPhotoRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  kycPhotoBtn: {
    flex: 1,
    aspectRatio: 1.4,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    overflow: 'hidden',
  },
  kycPhotoBtnFilled: {
    borderStyle: 'solid',
    borderColor: colors.primary,
  },
  kycPhotoBtnLabel: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600',
  },
  kycPhotoThumb: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: 'cover',
  },
  kycPhotoOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputMargin: {
    marginTop: spacing.md,
  },
  infoBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
    marginTop: spacing.lg,
  },
  infoText: {
    ...typography.bodySmall,
    color: colors.primaryDark,
    flex: 1,
    lineHeight: 19,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
});
