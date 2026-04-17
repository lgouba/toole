import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { NumericKeypad } from '@/components/ui';
import { colors, typography, spacing } from '@/theme';
import { useDriverStore } from '@/stores/driver.store';
import { haptic } from '@/utils/haptics';

export default function CodeValidationScreen() {
  const router = useRouter();
  const { validateCode } = useDriverStore();
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);

  const handleComplete = async (code: string) => {
    setError('');
    const success = await validateCode(code);

    if (success) {
      haptic.success();
      router.replace('/(driver)/delivery-confirm');
    } else {
      haptic.error();
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 3) {
        setError('Trop de tentatives. Contactez le support.');
      } else {
        setError(`Code incorrect (${3 - newAttempts} tentative(s) restante(s))`);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.primary} />
          <Text style={styles.title}>Code de validation</Text>
          <Text style={styles.subtitle}>
            Demandez le code a 4 chiffres au destinataire
          </Text>
        </View>

        <NumericKeypad
          length={4}
          onComplete={handleComplete}
        />

        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : null}
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
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
    gap: spacing.sm,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  error: {
    ...typography.bodySmall,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
