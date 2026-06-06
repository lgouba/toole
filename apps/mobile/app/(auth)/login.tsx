import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Keyboard,
  TouchableWithoutFeedback,
  Alert,
  AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { OtpInput } from '@/components/ui';
import { DeliveryHero } from '@/components/auth/DeliveryHero';
import { PhoneField } from '@/components/auth/PhoneField';
import { COUNTRIES, Country } from '@/components/auth/CountryPicker';
import { authColors as C, authFonts as F, authRadius as R } from '@/theme/auth';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useCountdown } from '@/hooks/useCountdown';

export default function AuthScreen() {
  const router = useRouter();
  const { sendOtp, verifyOtp, isLoading } = useAuthStore();
  const appName = useSettingsStore((s) => s.settings.appName);

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [country, setCountry] = useState<Country>(COUNTRIES[0]); // BF +226
  const [digits, setDigits] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  const { remaining, start, isActive } = useCountdown(60);

  const isValid = digits.length >= 8;
  const phoneE164 = `${country.dial}${digits}`; // ex "22670123456" (backend normalise)

  // ---- animations légères (pill + shine CTA) ----
  const ping = useSharedValue(0);
  const shine = useSharedValue(0);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((rm) => {
      setReduceMotion(rm);
      if (rm) return;
      ping.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false);
    });
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    if (isValid && step === 'phone') {
      shine.value = withRepeat(
        withDelay(1200, withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) })),
        -1,
        false,
      );
    } else {
      shine.value = 0;
    }
  }, [isValid, step, reduceMotion]);

  const pingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ping.value, [0, 1], [0.9, 0]),
    transform: [{ scale: interpolate(ping.value, [0, 1], [1, 2.6]) }],
  }));

  const shineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shine.value, [0, 0.5, 1], [0, 0.35, 0]),
    transform: [
      { translateX: interpolate(shine.value, [0, 1], [-160, 220]) },
      { skewX: '-18deg' },
    ],
  }));

  // ---- étape 1 : envoi OTP par SMS ----
  const handleSendOtp = async () => {
    setError('');
    if (!isValid) {
      setError('Entrez un numéro valide (8 chiffres).');
      return;
    }
    Keyboard.dismiss();
    const result = await sendOtp(phoneE164, 'sms', 'login');
    if (result.success) {
      setStep('otp');
      setCode('');
      start();
    } else {
      setError(result.error || "Impossible d'envoyer le code. Vérifiez votre numéro.");
    }
  };

  // ---- étape 2 : vérification + connexion auto ----
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
              "Vos justificatifs sont en cours de validation par notre équipe (24-48h).",
          );
          setCode('');
          return;
        }
        if (result.errorCode === 'DRIVER_KYC_REJECTED') {
          Alert.alert(
            'Compte refusé',
            result.errorMessage ??
              'Vos justificatifs ont été refusés. Contactez le support.',
          );
          setCode('');
          return;
        }
        if (result.errorCode === 'ACCOUNT_UNAVAILABLE') {
          Alert.alert(
            'Compte indisponible',
            result.errorMessage ??
              "Votre compte n'est pas accessible pour le moment. Contactez le support.",
          );
          setCode('');
          return;
        }
        setError(
          result.errorCode === 'EXPIRED_OTP'
            ? 'Code expiré. Demandez un nouveau code.'
            : result.errorMessage ?? 'Code incorrect.',
        );
        setCode('');
        return;
      }

      if (result.isNewUser) {
        router.replace('/(auth)/register');
        return;
      }
      const userType = useAuthStore.getState().user?.userType;
      router.replace(userType === 'driver' ? '/(driver)' : '/(client)');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setError('');
    const result = await sendOtp(phoneE164, 'sms', 'login');
    if (result.success) {
      setCode('');
      start();
    } else {
      setError(result.error || 'Impossible de renvoyer le code. Réessayez.');
    }
  };

  const editPhone = () => {
    setStep('phone');
    setCode('');
    setError('');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* ===== HÉROS ANIMÉ ===== */}
        <DeliveryHero />

        {/* ===== CARTE FORMULAIRE (remplit tout le bas) ===== */}
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <SafeAreaView edges={['bottom']} style={styles.cardWrap}>
            <View style={styles.card}>
                {/* Pill "Livraison en direct" */}
                <View style={styles.pill}>
                  <View style={styles.pingWrap}>
                    <Animated.View style={[styles.pingRing, pingStyle]} />
                    <View style={styles.pingDot} />
                  </View>
                  <Text style={styles.pillText}>LIVRAISON PARTOUT</Text>
                </View>

                <Text style={styles.title}>Bienvenue chez {appName} !</Text>

                {step === 'phone' ? (
                  <>
                    <Text style={styles.subtitle}>
                      Entrez votre numéro pour recevoir un code de connexion par SMS.
                    </Text>

                    <Text style={styles.label}>Numéro de téléphone</Text>
                    <PhoneField
                      country={country}
                      onCountryChange={setCountry}
                      digits={digits}
                      onDigitsChange={setDigits}
                      maxDigits={country.code === 'FR' ? 9 : 8}
                    />

                    {error ? <Text style={styles.error}>{error}</Text> : null}

                    {/* CTA Continuer */}
                    <PressableCTA
                      label="Continuer"
                      onPress={handleSendOtp}
                      disabled={!isValid || isLoading}
                      loading={isLoading}
                      shineStyle={!reduceMotion && isValid ? shineStyle : undefined}
                    />

                    <TouchableOpacity
                      onPress={() => router.push('/(auth)/register')}
                      style={styles.altLink}
                      activeOpacity={0.7}
                      accessibilityRole="link"
                    >
                      <Text style={styles.altText}>
                        Première fois ici ?{' '}
                        <Text style={styles.altBold}>S'inscrire</Text>
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={styles.subtitle}>
                      Code envoyé par SMS au +{country.dial} {formatLocal(digits)}.
                    </Text>

                    <View style={styles.otpWrap}>
                      <OtpInput length={4} value={code} onChange={setCode} onComplete={handleVerify} />
                    </View>

                    {error ? (
                      <Text style={[styles.error, { textAlign: 'center' }]}>{error}</Text>
                    ) : null}
                    {verifying ? <Text style={styles.verifying}>Vérification…</Text> : null}

                    <View style={styles.otpActions}>
                      {isActive ? (
                        <Text style={styles.resendText}>Renvoyer dans {remaining}s</Text>
                      ) : (
                        <TouchableOpacity onPress={handleResend} activeOpacity={0.7}>
                          <Text style={styles.resendLink}>Renvoyer le code</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={editPhone} activeOpacity={0.7}>
                        <Text style={styles.editLink}>Modifier le numéro</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </SafeAreaView>
          </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}

function formatLocal(digits: string): string {
  return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
}

/** CTA plein largeur avec shine sweep + press-scale. */
function PressableCTA({
  label,
  onPress,
  disabled,
  loading,
  shineStyle,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  shineStyle?: any;
}) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={aStyle}>
      <TouchableOpacity
        activeOpacity={1}
        disabled={disabled}
        onPressIn={() => {
          scale.value = withTiming(0.97, { duration: 90 });
        }}
        onPressOut={() => {
          scale.value = withTiming(1, { duration: 120 });
        }}
        onPress={onPress}
        style={[styles.cta, disabled && styles.ctaDisabled]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {shineStyle ? <Animated.View style={[styles.ctaShine, shineStyle]} /> : null}
        <Text style={styles.ctaText}>{loading ? 'Envoi…' : label}</Text>
        {!loading && <Ionicons name="arrow-forward" size={20} color="#fff" />}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // L'écran entier est blanc (renforcé par contentStyle blanc du navigateur).
  // La carte se dimensionne à son contenu ; sous elle, c'est le même blanc →
  // transition invisible, blanc continu jusqu'en bas. Pas de "bloc" séparé.
  container: { flex: 1, backgroundColor: '#fff' },
  cardWrap: {
    marginTop: -32, // chevauche légèrement le héros
    flex: 1,
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: R.card,
    borderTopRightRadius: R.card,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    gap: 14,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    backgroundColor: C.pillBg,
    borderRadius: R.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  pingWrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  pingRing: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.primary,
  },
  pingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.primary },
  pillText: {
    fontFamily: F.bodyBold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: C.primary,
  },
  title: {
    fontFamily: F.displayExtra,
    fontSize: 27,
    color: C.text,
    lineHeight: 32,
  },
  subtitle: {
    fontFamily: F.bodyRegular,
    fontSize: 15,
    color: C.muted,
    lineHeight: 22,
  },
  label: {
    fontFamily: F.bodyBold,
    fontSize: 14,
    color: C.text,
    marginTop: 2,
  },
  error: {
    fontFamily: F.bodyMedium,
    fontSize: 13,
    color: '#DC2626',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: C.primary,
    borderRadius: R.pill,
    paddingVertical: 18,
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: C.primary,
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  ctaDisabled: {
    backgroundColor: C.primary + '66',
    shadowOpacity: 0,
    elevation: 0,
  },
  ctaShine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: '#fff',
  },
  ctaText: {
    fontFamily: F.displayBold,
    fontSize: 17,
    color: '#fff',
  },
  altLink: { alignItems: 'center', paddingVertical: 6, marginTop: 4 },
  altText: { fontFamily: F.bodyMedium, fontSize: 14, color: C.muted },
  altBold: { fontFamily: F.bodyBold, color: C.primary },
  // OTP
  otpWrap: { marginTop: 8, alignItems: 'center' },
  verifying: {
    fontFamily: F.bodyMedium,
    fontSize: 13,
    color: C.muted,
    textAlign: 'center',
    marginTop: 8,
  },
  otpActions: { alignItems: 'center', gap: 12, marginTop: 16 },
  resendText: { fontFamily: F.bodyMedium, fontSize: 14, color: C.muted },
  resendLink: { fontFamily: F.bodyBold, fontSize: 14, color: C.primary },
  editLink: {
    fontFamily: F.bodyMedium,
    fontSize: 14,
    color: C.muted,
    textDecorationLine: 'underline',
  },
});
