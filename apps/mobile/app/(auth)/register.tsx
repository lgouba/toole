import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@/types';

type VehicleType = 'moto' | 'velo' | 'voiture' | 'tricycle';

const roles: {
  type: UserRole;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}[] = [
  {
    type: 'client',
    icon: 'cube-outline',
    title: 'Client',
    subtitle: "J'envoie des colis",
  },
  {
    type: 'driver',
    icon: 'bicycle-outline',
    title: 'Livreur',
    subtitle: 'Je livre des colis',
  },
];

const vehicles: {
  type: VehicleType;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
}[] = [
  { type: 'moto', icon: 'bicycle-outline', label: 'Moto', hint: 'Le plus rapide en ville' },
  { type: 'velo', icon: 'walk-outline', label: 'Velo', hint: 'Courtes distances' },
  { type: 'tricycle', icon: 'bus-outline', label: 'Tricycle', hint: 'Colis volumineux' },
  { type: 'voiture', icon: 'car-outline', label: 'Voiture', hint: 'Longues distances' },
];

type Step = 'role' | 'name' | 'vehicle';

export default function RegisterScreen() {
  const router = useRouter();
  const { register, isLoading, logout } = useAuthStore();
  const [step, setStep] = useState<Step>('role');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);
  const [error, setError] = useState('');

  // Nombre total d'etapes selon le role
  const totalSteps = selectedRole === 'driver' ? 3 : 2;
  const currentStepIndex = useMemo(() => {
    if (step === 'role') return 1;
    if (step === 'name') return 2;
    return 3;
  }, [step]);

  const handleBack = () => {
    setError('');
    if (step === 'name') return setStep('role');
    if (step === 'vehicle') return setStep('name');
    // Step 'role': back to login
    logout();
    router.replace('/(auth)/login');
  };

  const handleRoleNext = () => {
    if (!selectedRole) return;
    setStep('name');
  };

  const handleNameNext = async () => {
    setError('');
    const name = fullName.trim();
    if (name.length < 2) {
      setError('Entrez au moins 2 caracteres');
      return;
    }
    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Format d'email invalide");
      return;
    }

    if (selectedRole === 'driver') {
      setStep('vehicle');
      return;
    }

    await doRegister({ vehicleType: undefined });
  };

  const handleVehicleConfirm = async () => {
    if (!vehicleType) return;
    await doRegister({ vehicleType });
  };

  const doRegister = async (extras: { vehicleType?: VehicleType }) => {
    if (!selectedRole) return;
    setError('');
    const ok = await register(fullName.trim(), selectedRole, {
      email: email.trim() || undefined,
      vehicleType: extras.vehicleType,
    });
    if (!ok) {
      setError('Impossible de creer le compte. Verifiez votre connexion.');
      return;
    }
    // Redirection : driver -> KYC obligatoire avant d'entrer dans l'app
    if (selectedRole === 'driver') {
      router.replace('/(driver)/kyc');
    } else {
      router.replace('/(client)');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header avec bouton retour + progression */}
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.stepIndicator}>
          Etape {currentStepIndex}/{totalSteps}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Barre de progression */}
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
                <Text style={styles.title}>Bienvenue sur Tolle</Text>
                <Text style={styles.subtitle}>
                  Choisissez votre profil pour commencer
                </Text>
              </View>

              <View style={styles.cardsGrid}>
                {roles.map((role) => (
                  <TouchableOpacity
                    key={role.type}
                    style={[
                      styles.roleCard,
                      selectedRole === role.type && styles.roleCardSelected,
                    ]}
                    onPress={() => setSelectedRole(role.type)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.roleIconCircle,
                        selectedRole === role.type && styles.roleIconCircleSelected,
                      ]}
                    >
                      <Ionicons
                        name={role.icon}
                        size={34}
                        color={
                          selectedRole === role.type ? colors.white : colors.primary
                        }
                      />
                    </View>
                    <Text
                      style={[
                        styles.roleTitle,
                        selectedRole === role.type && styles.roleTitleSelected,
                      ]}
                    >
                      {role.title}
                    </Text>
                    <Text style={styles.roleSubtitle}>{role.subtitle}</Text>
                    {selectedRole === role.type ? (
                      <View style={styles.checkmark}>
                        <Ionicons name="checkmark" size={14} color={colors.white} />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {step === 'name' && (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>Parlez-nous de vous</Text>
                <Text style={styles.subtitle}>
                  {selectedRole === 'driver'
                    ? 'Ces informations seront visibles par vos clients'
                    : 'Ces informations seront visibles par les livreurs'}
                </Text>
              </View>

              <View style={styles.form}>
                <Input
                  label="Nom complet *"
                  placeholder="Ex: Aminata Ouedraogo"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  autoFocus
                />

                <Input
                  label="Email (optionnel)"
                  placeholder="exemple@email.com"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
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

              <View style={styles.vehicleList}>
                {vehicles.map((v) => (
                  <TouchableOpacity
                    key={v.type}
                    style={[
                      styles.vehicleRow,
                      vehicleType === v.type && styles.vehicleRowSelected,
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
                      <Ionicons
                        name={v.icon}
                        size={24}
                        color={
                          vehicleType === v.type ? colors.white : colors.primary
                        }
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.vehicleLabel}>{v.label}</Text>
                      <Text style={styles.vehicleHint}>{v.hint}</Text>
                    </View>
                    {vehicleType === v.type ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color={colors.primary}
                      />
                    ) : (
                      <View style={styles.radioEmpty} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Text style={styles.vehicleDisclaimer}>
                Apres inscription, vous completerez votre dossier (photo de vehicule,
                CNIB, permis) avant d'etre active.
              </Text>
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
          {step === 'name' && (
            <Button
              title={selectedRole === 'driver' ? 'Continuer' : 'Creer mon compte'}
              onPress={handleNameNext}
              loading={isLoading}
              disabled={fullName.trim().length < 2}
            />
          )}
          {step === 'vehicle' && (
            <Button
              title="Creer mon compte"
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
  backBtn: {
    padding: 4,
  },
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
  content: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  header: {
    marginBottom: spacing.xl,
  },
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
  cardsGrid: {
    gap: spacing.md,
  },
  roleCard: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    position: 'relative',
  },
  roleCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  roleIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  roleIconCircleSelected: {
    backgroundColor: colors.primary,
  },
  roleTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  roleTitleSelected: {
    color: colors.primaryDark,
  },
  roleSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  checkmark: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    gap: spacing.md,
  },
  error: {
    ...typography.bodySmall,
    color: colors.error,
    marginTop: spacing.sm,
  },
  vehicleList: {
    gap: spacing.sm,
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
  },
  vehicleRowSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  vehicleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleIconSelected: {
    backgroundColor: colors.primary,
  },
  vehicleLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  vehicleHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  radioEmpty: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
  },
  vehicleDisclaimer: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.lg,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
});
