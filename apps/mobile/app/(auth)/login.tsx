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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui';
import { colors, typography, spacing, borderRadius, shadow } from '@/theme';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { isEmail } from '@/services/auth.service';

type Channel = 'sms' | 'whatsapp' | 'email';

export default function LoginScreen() {
  const router = useRouter();
  const { sendOtp, isLoading } = useAuthStore();
  const appName = useSettingsStore((s) => s.settings.appName);
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  // Canal : selectionne automatiquement selon l'identifier (email -> email,
  // phone -> WhatsApp par defaut). L'utilisateur peut overrider via les chips.
  const [channel, setChannel] = useState<Channel>('whatsapp');

  // Detection auto email vs phone : impacte les chips proposes.
  const isEmailInput = isEmail(identifier);
  useEffect(() => {
    // Si email : force le canal email automatiquement.
    // Si phone et canal=email : retombe sur WhatsApp.
    if (isEmailInput && channel !== 'email') setChannel('email');
    if (!isEmailInput && channel === 'email') setChannel('whatsapp');
  }, [isEmailInput, channel]);

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

  const handleContinue = async () => {
    setError('');
    const trimmed = identifier.trim();
    if (!trimmed) {
      setError('Entrez votre numéro de téléphone ou email');
      return;
    }

    let payloadIdentifier = trimmed;
    if (!isEmailInput) {
      // Phone : nettoyer et prefixer 226 si l'utilisateur a tape 8 chiffres seuls.
      const cleaned = trimmed.replace(/\D/g, '');
      if (cleaned.length === 8) {
        payloadIdentifier = `226${cleaned}`;
      } else if (cleaned.length === 11 && cleaned.startsWith('226')) {
        payloadIdentifier = cleaned;
      } else {
        setError('Entrez un numéro à 8 chiffres ou un email valide');
        return;
      }
    }

    const result = await sendOtp(payloadIdentifier, channel);
    if (result.success) {
      router.push('/(auth)/otp');
    } else {
      setError(result.error || "Erreur lors de l'envoi du code");
    }
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
        {/* HERO : illustration moto sur fond terra cotta */}
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
            {channel === 'email'
              ? 'Recevez un code par email pour vous connecter.'
              : channel === 'whatsapp'
                ? 'Recevez un code WhatsApp pour vous connecter en toute sécurité.'
                : 'Recevez un code par SMS pour vous connecter en toute sécurité.'}
          </Text>

          {/* Champ identifier (phone OU email) */}
          <View style={styles.inputCard}>
            {isEmailInput ? (
              <Ionicons name="mail-outline" size={22} color={colors.primary} />
            ) : (
              <Text style={styles.flag}>🇧🇫</Text>
            )}
            <TextInput
              style={styles.identifierInput}
              placeholder="Numéro de téléphone ou email"
              placeholderTextColor={colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              value={identifier}
              onChangeText={setIdentifier}
              maxLength={80}
            />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Canaux affiches selon le type d'identifier */}
          <View style={styles.channels}>
            {isEmailInput ? (
              <ChannelChip
                active
                icon="mail"
                color={colors.primary}
                label="Code par email"
                onPress={() => {}}
                fullWidth
              />
            ) : (
              <>
                <ChannelChip
                  active={channel === 'whatsapp'}
                  onPress={() => setChannel('whatsapp')}
                  icon="logo-whatsapp"
                  color="#25D366"
                  label="WhatsApp"
                />
                <ChannelChip
                  active={channel === 'sms'}
                  onPress={() => setChannel('sms')}
                  icon="chatbubble-outline"
                  color={colors.primary}
                  label="SMS"
                />
              </>
            )}
          </View>

          {/* CTA + lien register */}
          <View style={styles.footer}>
            <Button
              title="Continuer ✨"
              onPress={handleContinue}
              loading={isLoading}
              disabled={identifier.trim().length < 3}
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
        </View>
      </ScrollView>
      </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ChannelChip({
  active,
  onPress,
  icon,
  color,
  label,
  fullWidth,
}: {
  active: boolean;
  onPress: () => void;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  fullWidth?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.chip,
        fullWidth && { flex: 1 },
        active && { borderColor: color, backgroundColor: color + '14' },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Ionicons name={icon} size={18} color={active ? color : colors.textSecondary} />
      <Text
        style={[
          styles.chipLabel,
          active && { color, fontWeight: '800' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
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
    gap: 10,
    marginTop: spacing.sm,
    ...shadow.sm,
  },
  flag: { fontSize: 24 },
  identifierInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    fontFamily: typography.bodyMedium.fontFamily,
  },
  error: {
    ...typography.bodySmall,
    color: colors.error,
    marginTop: -spacing.xs,
  },
  channels: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  chipLabel: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  footer: { marginTop: 'auto', gap: spacing.sm },
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
