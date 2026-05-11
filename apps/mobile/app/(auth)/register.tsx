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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Input } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { UserRole } from '@/types';

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
    subtitle: 'Je livre des colis',
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

type Step = 'role' | 'identity' | 'vehicle';

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

  // Code de parrainage (optionnel) — actuellement stocke seulement, la logique
  // de bonus (parrain X FCFA / parraine Y FCFA) sera activee plus tard.
  const [referralCode, setReferralCode] = useState('');

  const [error, setError] = useState('');

  const totalSteps = selectedRole === 'driver' ? 3 : 2;
  const currentStepIndex = useMemo(() => {
    if (step === 'role') return 1;
    if (step === 'identity') return 2;
    return 3;
  }, [step]);

  const handleBack = () => {
    setError('');
    if (step === 'identity') return setStep('role');
    if (step === 'vehicle') return setStep('identity');
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

  const handleVehicleConfirm = async () => {
    if (!vehicleType) return;
    await doRegister();
  };

  const doRegister = async () => {
    if (!selectedRole) return;
    setError('');
    const dob = `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    const ok = await register({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dateOfBirth: dob,
      userType: selectedRole,
      vehicleType: vehicleType ?? undefined,
      vehiclePlate: vehiclePlate.trim() || undefined,
      referralCode: referralCode.trim() || undefined,
    });
    if (!ok) {
      setError('Impossible de créer le compte. Vérifiez votre connexion.');
      return;
    }
    // Redirection selon le role
    if (selectedRole === 'driver') {
      router.replace('/(driver)');
    } else {
      router.replace('/(client)');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.stepIndicator}>
          Etape {currentStepIndex}/{totalSteps}
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
          showsVerticalScrollIndicator={false}
        >
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
                  label="Prenom *"
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
              title={selectedRole === 'driver' ? 'Continuer' : 'Creer mon compte'}
              onPress={handleIdentityNext}
              loading={isLoading}
            />
          )}
          {step === 'vehicle' && (
            <Button
              title="Créer mon compte"
              onPress={handleVehicleConfirm}
              loading={isLoading}
              disabled={!vehicleType}
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
