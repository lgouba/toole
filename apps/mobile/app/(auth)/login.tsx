import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button, Input } from '@/components/ui';
import { colors, typography, spacing } from '@/theme';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';

export default function LoginScreen() {
  const router = useRouter();
  const { sendOtp, isLoading } = useAuthStore();
  const appName = useSettingsStore((s) => s.settings.appName);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');

  const handleContinue = async () => {
    setError('');

    // Validate Burkina phone number: 8 digits
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length !== 8) {
      setError('Entrez un numero a 8 chiffres');
      return;
    }

    const fullPhone = `226${cleaned}`;
    const success = await sendOtp(fullPhone);
    if (success) {
      router.push('/(auth)/otp');
    } else {
      setError('Erreur lors de l\'envoi du code');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.logo}>{appName}</Text>
          <Text style={styles.title}>Entrez votre numero</Text>
          <Text style={styles.subtitle}>
            Nous vous enverrons un code de verification par SMS
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.phoneRow}>
            <View style={styles.prefix}>
              <Text style={styles.prefixText}>+226</Text>
            </View>
            <Input
              placeholder="70 12 34 56"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              error={error}
              containerStyle={styles.phoneInput}
              maxLength={12}
            />
          </View>
        </View>

        <View style={styles.footer}>
          <Button
            title="Continuer"
            onPress={handleContinue}
            loading={isLoading}
            disabled={phone.replace(/\D/g, '').length < 8}
          />
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
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  header: {
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
  },
  logo: {
    ...typography.h1,
    color: colors.primary,
    marginBottom: spacing.lg,
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
  form: {
    flex: 1,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  prefix: {
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  prefixText: {
    ...typography.body,
    color: colors.textPrimary,
  },
  phoneInput: {
    flex: 1,
  },
  footer: {
    paddingBottom: spacing.lg,
  },
});
