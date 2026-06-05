import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
  Animated,
  Easing,
  Keyboard,
  TouchableWithoutFeedback,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, OtpInput } from '@/components/ui';
import { colors, typography, spacing, borderRadius, shadow } from '@/theme';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useCountdown } from '@/hooks/useCountdown';

// Indicatif Burkina Faso, prefixe automatiquement : l'utilisateur saisit
// uniquement ses 8 chiffres locaux, sans se demander s'il faut ajouter +226.
const COUNTRY_CODE = '226';

/** Formate 8 chiffres "70123456" en "70 12 34 56" pour la lisibilite. */
function formatLocal(digits: string): string {
  return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
}

export default function LoginScreen() {
  const router = useRouter();
  const { sendOtp, verifyOtp, isLoading } = useAuthStore();
  const appName = useSettingsStore((s) => s.settings.appName);

  // Etape : 'phone' = saisie du numero, 'otp' = saisie du code (meme page).
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState(''); // 8 chiffres locaux
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const { remaining, start, isActive } = useCountdown(60);

  // Identifier complet envoye au backend (226 + 8 chiffres).
  const fullIdentifier = `${COUNTRY_CODE}${phone}`;
  const phoneValid = phone.length === 8;

  // Animation flottante de la moto dans le hero
  const floatY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: -8,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatY, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [floatY]);

  // ----- Etape 1 : envoi de l'OTP par SMS -----
  const handleSendOtp = async () => {
    setError('');
    if (!phoneValid) {
      setError('Entrez votre numéro à 8 chiffres');
      return;
    }
    Keyboard.dismiss();
    const result = await sendOtp(fullIdentifier, 'sms', 'login');
    if (result.success) {
      setStep('otp');
      setCode('');
      start(); // demarre le compte a rebours "Renvoyer dans Xs"
    } else {
      // Message generique : ne pas reveler si le numero existe ou non
      // (protection contre l'enumeration de comptes).
      setError(result.error || "Impossible d'envoyer le code. Vérifiez votre numéro.");
    }
  };

  // ----- Etape 2 : verification du code + connexion auto -----
  const handleVerify = async (otpCode: string) => {
    setError('');
    setVerifying(true);
    try {
      const result = await verifyOtp(otpCode);

      if (!result.success) {
        if (result.errorCode === 'DRIVER_KYC_PENDING') {
          Alert.alert(
            'Compte en cours de validation',
            result.errorMessage ??
              "Vos justificatifs sont en cours de validation par notre équipe. Vous recevrez une notification dès l'activation de votre compte (24-48h).",
          );
          setCode('');
          return;
        }
        if (result.errorCode === 'DRIVER_KYC_REJECTED') {
          Alert.alert(
            'Compte refusé',
            result.errorMessage ??
              'Vos justificatifs ont été refusés. Contactez le support pour relancer votre inscription.',
          );
          setCode('');
          return;
        }
        if (result.errorCode === 'ACCOUNT_UNAVAILABLE') {
          Alert.alert(
            'Compte indisponible',
            result.errorMessage ??
              "Votre compte n'est pas accessible pour le moment. Veuillez contacter le support.",
          );
          setCode('');
          return;
        }
        if (result.errorCode === 'EXPIRED_OTP') {
          setError('Code expiré. Demandez un nouveau code.');
        } else {
          setError(result.errorMessage ?? 'Code incorrect.');
        }
        setCode('');
        return;
      }

      // Nouveau numero (pas encore de compte) : on bascule sur l'inscription.
      if (result.isNewUser) {
        router.replace('/(auth)/register');
        return;
      }

      // Connexion reussie : redirection selon le role.
      const userType = useAuthStore.getState().user?.userType;
      if (userType === 'driver') {
        router.replace('/(driver)');
      } else {
        router.replace('/(client)');
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setError('');
    const result = await sendOtp(fullIdentifier, 'sms', 'login');
    if (result.success) {
      setCode('');
      start();
    } else {
      setError(result.error || "Impossible de renvoyer le code. Réessayez.");
    }
  };

  const handleEditPhone = () => {
    setStep('phone');
    setCode('');
    setError('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* HERO : illustration moto */}
            <View style={styles.hero}>
              <Text style={styles.heroAccentBox}>📦</Text>
              <Text style={styles.heroAccentStar}>⭐</Text>
              <Animated.Text
                style={[styles.heroEmoji, { transform: [{ translateY: floatY }] }]}
              >
                🛵
              </Animated.Text>
            </View>

            {/* FORM bas */}
            <View style={styles.form}>
              <Text style={styles.title}>Bienvenue chez {appName} !</Text>
              <Text style={styles.subtitle}>
                {step === 'phone'
                  ? 'Entrez votre numéro pour recevoir un code de connexion par SMS.'
                  : `Code envoyé par SMS au +${COUNTRY_CODE} ${formatLocal(phone)}.`}
              </Text>

              {step === 'phone' ? (
                <>
                  {/* Champ telephone avec indicatif +226 fixe */}
                  <View style={styles.inputCard}>
                    <Text style={styles.flag}>🇧🇫</Text>
                    <Text style={styles.dialCode}>+{COUNTRY_CODE}</Text>
                    <View style={styles.divider} />
                    <TextInput
                      style={styles.phoneInput}
                      placeholder="70 12 34 56"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="number-pad"
                      autoComplete="tel"
                      textContentType="telephoneNumber"
                      value={formatLocal(phone)}
                      onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 8))}
                      maxLength={11} // 8 chiffres + 3 espaces
                      autoFocus
                    />
                  </View>
                  {error ? <Text style={styles.error}>{error}</Text> : null}

                  <View style={styles.footer}>
                    <Button
                      title="Continuer ✨"
                      onPress={handleSendOtp}
                      loading={isLoading}
                      disabled={!phoneValid}
                    />
                    <TouchableOpacity
                      onPress={() => router.push('/(auth)/register')}
                      style={styles.registerLink}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.registerLinkText}>
                        Première fois ici ?{' '}
                        <Text style={styles.registerLinkBold}>S'inscrire</Text>
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  {/* Saisie du code OTP, sur la meme page */}
                  <View style={styles.otpWrap}>
                    <OtpInput
                      length={4}
                      value={code}
                      onChange={setCode}
                      onComplete={handleVerify}
                    />
                  </View>
                  {error ? (
                    <Text style={[styles.error, styles.errorCentered]}>{error}</Text>
                  ) : null}

                  {verifying ? (
                    <Text style={styles.verifying}>Vérification…</Text>
                  ) : null}

                  <View style={styles.otpActions}>
                    {isActive ? (
                      <Text style={styles.resendText}>Renvoyer dans {remaining}s</Text>
                    ) : (
                      <TouchableOpacity onPress={handleResend} activeOpacity={0.7}>
                        <Text style={styles.resendLink}>Renvoyer le code</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={handleEditPhone} activeOpacity={0.7}>
                      <Text style={styles.editPhoneLink}>Modifier le numéro</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const HERO_HEIGHT = 300;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  hero: {
    height: HERO_HEIGHT,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  heroEmoji: {
    fontSize: 130,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 8 },
    textShadowRadius: 16,
  },
  heroAccentBox: {
    position: 'absolute',
    top: 40,
    left: 30,
    fontSize: 36,
    opacity: 0.85,
  },
  heroAccentStar: {
    position: 'absolute',
    bottom: 40,
    right: 30,
    fontSize: 30,
    opacity: 0.9,
  },
  form: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  title: {
    ...typography.h1,
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginTop: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    gap: 8,
    marginTop: spacing.sm,
    ...shadow.sm,
  },
  flag: { fontSize: 24 },
  dialCode: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    fontFamily: typography.bodyMedium.fontFamily,
  },
  divider: {
    width: 1.5,
    height: 24,
    backgroundColor: colors.border,
  },
  phoneInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    color: colors.textPrimary,
    fontFamily: typography.bodyMedium.fontFamily,
  },
  error: {
    ...typography.bodySmall,
    color: colors.error,
    marginTop: -spacing.xs,
  },
  errorCentered: {
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  otpWrap: {
    marginTop: spacing.lg,
  },
  verifying: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  otpActions: {
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  resendText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  resendLink: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '800',
  },
  editPhoneLink: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  footer: { marginTop: spacing.lg, gap: spacing.xs },
  registerLink: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  registerLinkText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  registerLinkBold: {
    color: colors.primary,
    fontWeight: '800',
  },
});
