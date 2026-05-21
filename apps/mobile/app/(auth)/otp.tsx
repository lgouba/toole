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
import { api, unwrap, tokenStorage } from '@/services/api.client';
import { isEmail } from '@/services/auth.service';

export default function OtpScreen() {
  const router = useRouter();
  const { phoneNumber, verifyOtp, sendOtp, isLoading } = useAuthStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const { remaining, start, isActive } = useCountdown(60);

  /**
   * Si on a une `pendingRegistration` (= l'utilisateur vient du register screen),
   * on appelle /auth/register avec les donnees stockees + l'OTP saisi pour
   * finaliser la creation de compte. Sinon, on fait un login OTP classique.
   */
  const handleVerify = async (otpCode: string) => {
    setError('');

    const pending = useAuthStore.getState().pendingRegistration;
    if (pending) {
      await finalizeRegistration(otpCode, pending);
      return;
    }

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
    // Si on est dans un flow d'inscription, on renvoie l'OTP au meme identifier
    // (phone OU email) que celui choisi initialement.
    const pending = useAuthStore.getState().pendingRegistration;
    const target = pending?.otpIdentifier ?? phoneNumber;
    const channel = pending && isEmail(pending.otpIdentifier) ? 'email' : undefined;
    await sendOtp(target, channel);
    start();
  };

  /**
   * Finalise l'inscription en appelant POST /auth/register avec :
   *   - les donnees du formulaire stockees dans pendingRegistration
   *   - le code OTP saisi par l'utilisateur
   *
   * Le serveur valide l'OTP (envoye sur phone OU email), cree l'utilisateur,
   * et renvoie un accessToken + refreshToken si client. Pour driver, le compte
   * est cree en isActive=false (KYC en attente) : on logout et on affiche un
   * message d'attente.
   */
  const finalizeRegistration = async (
    otpCode: string,
    pending: NonNullable<ReturnType<typeof useAuthStore.getState>['pendingRegistration']>,
  ) => {
    try {
      const res = await api.post('/auth/register', {
        phone: pending.phone,
        firstName: pending.firstName,
        lastName: pending.lastName,
        dateOfBirth: pending.dateOfBirth,
        userType: pending.userType,
        otpCode,
        email: pending.email,
        vehicleType: pending.vehicleType,
        vehiclePlate: pending.vehiclePlate,
        // Photos KYC envoyees au register : impossible de faire un PUT
        // /drivers/me/kyc apres car le middleware authRequired refuse
        // les comptes isActive=false (cas du driver tout neuf).
        cnibPhotoUrl: pending.cnibPhotoUrl,
        cnibPhotoBackUrl: pending.cnibPhotoBackUrl,
        referralCode: pending.referralCode,
      });
      const data = unwrap<{
        user: any;
        accessToken: string;
        refreshToken: string;
      }>(res);

      // Stocker les tokens (les photos KYC ont deja ete envoyees dans le
      // payload du register et stockees en DB cote driverProfile).
      await tokenStorage.setTokens(data.accessToken, data.refreshToken);

      // Pour driver : compte isActive=false. On nettoie les tokens et redirige
      // vers login avec message d'attente.
      if (pending.userType === 'driver') {
        await tokenStorage.clear();
        useAuthStore.getState().setPendingRegistration(null);
        router.replace('/(auth)/login');
        setTimeout(() => {
          Alert.alert(
            'Inscription envoyée 🎉',
            "Vos justificatifs sont en cours de validation par notre équipe (24-48h). Vous recevrez une notification dès l'activation de votre compte.",
          );
        }, 200);
        return;
      }

      // Client : on est connecte directement.
      useAuthStore.setState({
        user: data.user,
        isAuthenticated: true,
        pendingRegistration: null,
      });
      router.replace('/(client)');
    } catch (err: any) {
      const code = err?.response?.data?.error?.code;
      const message = err?.response?.data?.error?.message;
      const fieldErrors = err?.response?.data?.error?.details?.fieldErrors as
        | Record<string, string[]>
        | undefined;
      if (code === 'EXPIRED_OTP' || code === 'INVALID_OTP') {
        setError('Code incorrect ou expiré. Vérifiez ou demandez un nouveau code.');
      } else if (code === 'USER_EXISTS') {
        setError('Ce numéro ou cet email est déjà associé à un compte.');
      } else if (fieldErrors) {
        const first = Object.keys(fieldErrors).find(
          (k) => (fieldErrors[k]?.length ?? 0) > 0,
        );
        setError(
          first
            ? `Champ invalide : ${first}. ${fieldErrors[first][0]}`
            : message ?? "Erreur d'inscription.",
        );
      } else {
        setError(message ?? "Impossible de finaliser l'inscription.");
      }
      setCode('');
    }
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
            Entrez le code à 4 chiffres envoyé à{'\n'}
            <Text style={styles.phone}>
              {isEmail(phoneNumber) ? phoneNumber : formatPhone(phoneNumber)}
            </Text>
          </Text>
          {/* Code test 1234 uniquement pour SMS/WhatsApp (en attendant un
              vrai provider). Pour email, le SMTP livre un vrai code. */}
          {!isEmail(phoneNumber) ? (
            <Text style={styles.devHint}>Code test: 1234</Text>
          ) : null}
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
