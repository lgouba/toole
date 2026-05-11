import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';

type Channel = 'sms' | 'whatsapp';

export default function LoginScreen() {
  const router = useRouter();
  const { sendOtp, isLoading } = useAuthStore();
  const appName = useSettingsStore((s) => s.settings.appName);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  // Canal de reception : WhatsApp en premier car gratuit, fiable, populaire au BF
  const [channel, setChannel] = useState<Channel>('whatsapp');

  const handleContinue = async () => {
    setError('');

    // Validate Burkina phone number: 8 digits
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length !== 8) {
      setError('Entrez un numéro a 8 chiffres');
      return;
    }

    const fullPhone = `226${cleaned}`;
    const result = await sendOtp(fullPhone, channel);
    if (result.success) {
      router.push('/(auth)/otp');
    } else {
      setError(result.error || "Erreur lors de l'envoi du code");
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
          <Text style={styles.title}>Entrez votre numéro</Text>
          <Text style={styles.subtitle}>
            {channel === 'whatsapp'
              ? 'Nous vous enverrons un code de vérification par WhatsApp.'
              : 'Nous vous enverrons un code de vérification par SMS.'}
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

          {/* Choix du canal : WhatsApp / SMS */}
          <View style={styles.channelRow}>
            <Text style={styles.channelLabel}>Recevoir le code via</Text>
            <View style={styles.channelToggle}>
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
            </View>
          </View>

          <View style={styles.privacyRow}>
            <Ionicons
              name="lock-closed-outline"
              size={12}
              color={colors.textTertiary}
            />
            <Text style={styles.privacyText}>Votre numéro reste privé</Text>
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

function ChannelChip({
  active,
  onPress,
  icon,
  color,
  label,
}: {
  active: boolean;
  onPress: () => void;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && { borderColor: color, backgroundColor: color + '14' }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Ionicons name={icon} size={18} color={active ? color : colors.textSecondary} />
      <Text
        style={[
          styles.chipLabel,
          active && { color: color, fontWeight: '700' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
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
  channelRow: {
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  channelLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  channelToggle: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipLabel: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.md,
    justifyContent: 'center',
  },
  privacyText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  footer: {
    paddingBottom: spacing.lg,
  },
});
