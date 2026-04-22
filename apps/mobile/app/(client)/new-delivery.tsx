import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input, Card } from '@/components/ui';
import { LocationPicker } from '@/components/LocationPicker';
import { PriceEstimate, SchedulePicker } from '@/components/delivery';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useDeliveryStore } from '@/stores/delivery.store';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useDeliveryPrice } from '@/hooks/useDeliveryPrice';
import { PackageType, PACKAGE_LABELS } from '@/types';
import { OUAGADOUGOU_CENTER } from '@/utils/geo';

const packageTypes: { type: PackageType; icon: string }[] = [
  { type: 'envelope', icon: 'mail-outline' },
  { type: 'small', icon: 'cube-outline' },
  { type: 'large', icon: 'archive-outline' },
];

export default function NewDeliveryScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { draft, setDraftField, createDelivery, resetDraft, isLoading } = useDeliveryStore();
  const [step, setStep] = useState(0);

  const refreshSettings = useSettingsStore((s) => s.refresh);

  // Chaque fois qu'on arrive sur cet ecran, on repart de l'etape 0 avec un draft vide
  // et on rafraichit les settings (tarifs a jour si l'admin vient de modifier).
  useFocusEffect(
    useCallback(() => {
      refreshSettings();
      setStep(0);
      resetDraft();
    }, [resetDraft]),
  );

  // Prix calcule UNIQUEMENT quand les deux positions sont definies
  const estimate = useDeliveryPrice(
    draft.packageType,
    draft.pickupLocation,
    draft.deliveryLocation,
  );

  const handleSubmit = async () => {
    if (!user) return;

    // Guard: il faut au moins une position GPS sur chaque point
    if (!draft.pickupLocation) {
      Alert.alert(
        'Position de recuperation manquante',
        'Utilisez "Coller lien", "Ma position" ou "Sur la carte" pour definir le point de recuperation.',
      );
      return;
    }
    if (!draft.deliveryLocation) {
      Alert.alert(
        'Position de livraison manquante',
        'Utilisez "Coller lien", "Ma position" ou "Sur la carte" pour definir le point de livraison.',
      );
      return;
    }
    if (!draft.recipientName?.trim() || !draft.recipientPhone?.trim()) {
      Alert.alert('Destinataire manquant', 'Renseignez le nom et le telephone du destinataire.');
      return;
    }

    try {
      const delivery = await createDelivery(user.id);
      if (delivery?.status === 'scheduled') {
        const when = draft.scheduledFor
          ? new Date(draft.scheduledFor).toLocaleString('fr-FR', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })
          : 'plus tard';
        Alert.alert(
          'Livraison programmee',
          `Votre course sera diffusee aux livreurs le ${when}. Vous recevrez une notification.`,
          [{ text: 'OK', onPress: () => router.replace('/(client)') }],
        );
        return;
      }
      router.push('/(client)/searching');
    } catch (e: any) {
      const isTimeout =
        e?.code === 'ECONNABORTED' ||
        e?.message?.toLowerCase?.().includes('timeout');
      if (isTimeout) {
        Alert.alert(
          'Connexion lente',
          'La demande met du temps a etre envoyee. Verifiez votre reseau et reessayez.',
        );
      } else {
        const msg =
          e?.response?.data?.error?.message ||
          e?.message ||
          'Impossible de creer la livraison. Verifiez les informations saisies.';
        Alert.alert('Erreur', msg);
      }
    }
  };

  const steps = [
    // Step 0: Package type
    <View key="type" style={styles.stepContent}>
      <Text style={styles.stepTitle}>Type de colis</Text>
      <View style={styles.packageTypes}>
        {packageTypes.map((pkg) => (
          <TouchableOpacity
            key={pkg.type}
            style={[
              styles.packageCard,
              draft.packageType === pkg.type && styles.packageCardSelected,
            ]}
            onPress={() => setDraftField('packageType', pkg.type)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={pkg.icon as any}
              size={32}
              color={draft.packageType === pkg.type ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[
                styles.packageLabel,
                draft.packageType === pkg.type && styles.packageLabelSelected,
              ]}
            >
              {PACKAGE_LABELS[pkg.type]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Input
        label="Description (optionnel)"
        placeholder="Ex: Telephone portable"
        value={draft.packageDescription || ''}
        onChangeText={(v) => setDraftField('packageDescription', v)}
        containerStyle={styles.inputMargin}
      />
    </View>,

    // Step 1: Addresses
    <View key="addresses" style={styles.stepContent}>
      {/* Tip banner */}
      <View style={styles.tipBanner}>
        <Ionicons name="bulb-outline" size={18} color={colors.primary} />
        <Text style={styles.tipText}>
          Tapez un lieu (nom de quartier, marché, école...), utilisez votre
          position GPS, collez un lien WhatsApp ou pointez sur la carte.
        </Text>
      </View>

      <View style={styles.addressBlock}>
        <View style={styles.addressHeader}>
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          <Text style={styles.addressHeading}>Départ</Text>
        </View>
        <LocationPicker
          variant="pickup"
          address={draft.pickupAddress || ''}
          onAddressChange={(v) => setDraftField('pickupAddress', v)}
          location={draft.pickupLocation || null}
          onLocationChange={(loc) => setDraftField('pickupLocation', loc ?? undefined)}
          autoUseGpsOnMount
        />
      </View>

      <View style={styles.addressBlock}>
        <View style={styles.addressHeader}>
          <View style={[styles.dot, { backgroundColor: colors.secondary }]} />
          <Text style={styles.addressHeading}>Arrivée</Text>
        </View>
        <LocationPicker
          variant="delivery"
          address={draft.deliveryAddress || ''}
          onAddressChange={(v) => setDraftField('deliveryAddress', v)}
          location={draft.deliveryLocation || null}
          onLocationChange={(loc) => setDraftField('deliveryLocation', loc ?? undefined)}
        />
      </View>
    </View>,

    // Step 2: Recipient
    <View key="recipient" style={styles.stepContent}>
      <Text style={styles.stepTitle}>Destinataire</Text>
      <Input
        label="Nom du destinataire"
        placeholder="Ex: Rasmane Kindo"
        value={draft.recipientName || ''}
        onChangeText={(v) => setDraftField('recipientName', v)}
        autoCapitalize="words"
        containerStyle={styles.inputMargin}
      />
      <Input
        label="Telephone du destinataire"
        placeholder="70 12 34 56"
        value={draft.recipientPhone || ''}
        onChangeText={(v) => setDraftField('recipientPhone', v)}
        keyboardType="phone-pad"
        containerStyle={styles.inputMargin}
      />
    </View>,

    // Step 3: Summary
    <View key="summary" style={styles.stepContent}>
      <Text style={styles.stepTitle}>Recapitulatif</Text>
      {estimate && <PriceEstimate estimate={estimate} />}
      <Card style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Colis</Text>
          <Text style={styles.summaryValue}>
            {draft.packageType ? PACKAGE_LABELS[draft.packageType] : '-'}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Recuperation</Text>
          <Text style={styles.summaryValue} numberOfLines={1}>
            {draft.pickupAddress || '-'}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Livraison</Text>
          <Text style={styles.summaryValue} numberOfLines={1}>
            {draft.deliveryAddress || '-'}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Destinataire</Text>
          <Text style={styles.summaryValue}>{draft.recipientName || '-'}</Text>
        </View>
      </Card>

      {/* Programmer la livraison */}
      <SchedulePicker
        value={draft.scheduledFor}
        onChange={(iso) => setDraftField('scheduledFor', iso)}
      />
    </View>,
  ];

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => step > 0 ? setStep(step - 1) : router.back()}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nouveau colis</Text>
          <Text style={styles.stepIndicator}>{step + 1}/4</Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${((step + 1) / 4) * 100}%` }]} />
        </View>

        <ScrollView
          style={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
        >
          {steps[step]}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          {step < 3 ? (
            <Button
              title="Continuer"
              onPress={() => {
                // Validation par etape
                if (step === 0 && !draft.packageType) {
                  Alert.alert('Type de colis manquant', 'Choisissez un type de colis.');
                  return;
                }
                if (step === 1) {
                  if (!draft.pickupLocation) {
                    Alert.alert(
                      'Position de recuperation manquante',
                      'Selectionnez une adresse dans les suggestions, utilisez "Ma position", un lien WhatsApp, ou la carte.',
                    );
                    return;
                  }
                  if (!draft.deliveryLocation) {
                    Alert.alert(
                      'Position de livraison manquante',
                      'Selectionnez une adresse dans les suggestions, utilisez un lien WhatsApp, ou la carte.',
                    );
                    return;
                  }
                }
                if (step === 2) {
                  if (!draft.recipientName?.trim() || !draft.recipientPhone?.trim()) {
                    Alert.alert('Destinataire incomplet', 'Renseignez le nom et le telephone.');
                    return;
                  }
                }
                setStep(step + 1);
              }}
            />
          ) : (
            <Button title="Confirmer" onPress={handleSubmit} loading={isLoading} />
          )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  stepIndicator: {
    ...typography.captionMedium,
    color: colors.textSecondary,
  },
  progressBar: {
    height: 3,
    backgroundColor: colors.surface,
  },
  progressFill: {
    height: 3,
    backgroundColor: colors.primary,
  },
  body: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  stepContent: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  stepTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  stepHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  locationGroup: {
    gap: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  tipBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primaryLight,
    marginBottom: spacing.lg,
  },
  tipText: {
    ...typography.caption,
    color: colors.primaryDark,
    flex: 1,
    lineHeight: 17,
  },
  addressBlock: {
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  addressHeading: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  packageTypes: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  packageCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
  },
  packageCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  packageLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  packageLabelSelected: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
  inputMargin: {
    marginBottom: spacing.md,
  },
  summaryCard: {
    marginTop: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  summaryLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  summaryValue: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
    marginLeft: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
});
