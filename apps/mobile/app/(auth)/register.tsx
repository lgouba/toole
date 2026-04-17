import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useAuthStore } from '@/stores/auth.store';
import { UserRole } from '@/types';

const roles: { type: UserRole; icon: string; title: string; subtitle: string }[] = [
  {
    type: 'client',
    icon: 'cube-outline',
    title: 'Client',
    subtitle: 'J\'envoie des colis',
  },
  {
    type: 'driver',
    icon: 'bicycle-outline',
    title: 'Livreur',
    subtitle: 'Je livre des colis',
  },
];

export default function RegisterScreen() {
  const { register, isLoading } = useAuthStore();
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [step, setStep] = useState<'name' | 'role'>('name');

  const handleNext = () => {
    if (step === 'name' && fullName.trim().length >= 2) {
      setStep('role');
    }
  };

  const handleRegister = async () => {
    if (!selectedRole) return;
    await register(fullName.trim(), selectedRole);
    // Auth guard will redirect
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        {step === 'name' ? (
          <>
            <View style={styles.body}>
              <View style={styles.header}>
                <Text style={styles.title}>Comment vous appelez-vous ?</Text>
                <Text style={styles.subtitle}>Ce nom sera visible par les autres utilisateurs</Text>
              </View>

              <Input
                label="Nom complet"
                placeholder="Ex: Aminata Ouedraogo"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                autoFocus
              />
            </View>

            <View style={styles.footer}>
              <Button
                title="Continuer"
                onPress={handleNext}
                disabled={fullName.trim().length < 2}
              />
            </View>
          </>
        ) : (
          <>
            <View style={styles.body}>
              <View style={styles.header}>
                <Text style={styles.title}>Choisissez votre profil</Text>
                <Text style={styles.subtitle}>Vous pourrez changer plus tard</Text>
              </View>

              <View style={styles.roles}>
              {roles.map((role) => (
                <TouchableOpacity
                  key={role.type}
                  style={[
                    styles.roleCard,
                    selectedRole === role.type && styles.roleCardSelected,
                  ]}
                  onPress={() => setSelectedRole(role.type)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={role.icon as any}
                    size={36}
                    color={selectedRole === role.type ? colors.primary : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.roleTitle,
                      selectedRole === role.type && styles.roleTitleSelected,
                    ]}
                  >
                    {role.title}
                  </Text>
                  <Text style={styles.roleSubtitle}>{role.subtitle}</Text>
                </TouchableOpacity>
              ))}
              </View>
            </View>

            <View style={styles.footer}>
              <Button
                title="Creer mon compte"
                onPress={handleRegister}
                disabled={!selectedRole}
                loading={isLoading}
              />
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  body: {
    flex: 1,
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
  },
  roles: {
    gap: spacing.md,
  },
  roleCard: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  roleCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
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
  footer: {
    paddingBottom: spacing.lg,
  },
});
