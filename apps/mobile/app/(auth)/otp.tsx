import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { OtpInput, Button } from '@/components/ui';
import { colors, typography, spacing } from '@/theme';
import { useAuthStore } from '@/stores/auth.store';
import { useCountdown } from '@/hooks/useCountdown';
import { formatPhone } from '@/utils/format';

export default function OtpScreen() {
  const router = useRouter();
  const { phoneNumber, verifyOtp, sendOtp, isLoading } = useAuthStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const { remaining, start, isActive } = useCountdown(60);

  const handleVerify = async (otpCode: string) => {
    setError('');
    const result = await verifyOtp(otpCode);

    if (!result.success) {
      setError('Code incorrect. Utilisez 1234 pour le test.');
      setCode('');
      return;
    }

    if (result.isNewUser) {
      router.replace('/(auth)/register');
    }
    // If existing user, the auth guard in _layout.tsx will redirect
  };

  const handleResend = async () => {
    await sendOtp(phoneNumber);
    start();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Verification</Text>
          <Text style={styles.subtitle}>
            Entrez le code envoye au{'\n'}
            <Text style={styles.phone}>{formatPhone(phoneNumber)}</Text>
          </Text>
        </View>

        <OtpInput
          length={4}
          value={code}
          onChange={setCode}
          onComplete={handleVerify}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.resend}>
          {isActive ? (
            <Text style={styles.resendText}>
              Renvoyer dans {remaining}s
            </Text>
          ) : (
            <Button
              title="Renvoyer le code"
              variant="ghost"
              size="small"
              onPress={handleResend}
            />
          )}
        </View>
      </View>
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
    lineHeight: 24,
  },
  phone: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  error: {
    ...typography.bodySmall,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  resend: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  resendText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
