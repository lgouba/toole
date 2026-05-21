import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
      // Livreur en attente de validation KYC : message explicite et rassurant.
      if (result.errorCode === 'DRIVER_KYC_PENDING') {
        Alert.alert(
          'Compte en cours de validation',
          result.errorMessage ??
            'Vos justificatifs sont en cours de validation par notre equipe. Vous recevrez une notification des l\'activation de votre compte (24-48h).',
          [{ text: 'OK' }],
        );
        setCode('');
        return;
      }
      // Livreur dont le KYC a ete rejete par l'admin.
      if (result.errorCode === 'DRIVER_KYC_REJECTED') {
        Alert.alert(
          'Compte refusé',
          result.errorMessage ??
            'Vos justificatifs ont ete refuses. Contactez le support pour relancer votre inscription.',
          [{ text: 'OK' }],
        );
        setCode('');
        return;
      }
      // Compte suspendu / desactive par l'admin -> message generique
      // (on ne dit pas a un attaquant si le compte est suspendu vs autre)
      if (result.errorCode === 'ACCOUNT_UNAVAILABLE') {
        Alert.alert(
          'Compte indisponible',
          result.errorMessage ??
            'Votre compte n\'est pas accessible pour le moment. Veuillez contacter le support.',
        );
        setCode('');
        return;
      }
      // Code OTP incorrect / expire
      if (result.errorCode === 'EXPIRED_OTP') {
        setError('Code expiré. Demandez un nouveau code.');
      } else {
        setError(result.errorMessage ?? 'Code incorrect.');
      }
      setCode('');
      return;
    }

    if (result.isNewUser) {
      router.replace('/(auth)/register');
      return;
    }

    // Existing user: navigate explicitly based on userType
    const userType = useAuthStore.getState().user?.userType;
    if (userType === 'driver') {
      router.replace('/(driver)');
    } else {
      router.replace('/(client)');
    }
  };

  const handleResend = async () => {
    await sendOtp(phoneNumber);
    start();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Bouton retour : permet de modifier le numero si erreur de saisie. */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={10}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Vérification</Text>
          <Text style={styles.subtitle}>
            Entrez le code à 4 chiffres envoyé au{'\n'}
            <Text style={styles.phone}>{formatPhone(phoneNumber)}</Text>
          </Text>
          <Text style={styles.devHint}>Code test: 1234</Text>
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
  topBar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
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
  devHint: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.sm,
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
