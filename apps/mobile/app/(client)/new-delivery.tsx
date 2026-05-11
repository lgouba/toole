import React, { useState, useCallback, useRef } from 'react';
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
import { AddressField } from '@/components/AddressField';
import { PriceEstimate, SchedulePicker } from '@/components/delivery';
import { ContactPickerModal } from '@/components/ContactPickerModal';
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
  const [thirdPartyPickup, setThirdPartyPickup] = useState(
    !!(draft.senderContactName || draft.senderContactPhone),
  );
  // True quand le toggle "Programmer" est ON dans le SchedulePicker. Permet
  // de bloquer la soumission si l'utilisateur a active le toggle mais que la
  // date saisie est invalide (auquel cas draft.scheduledFor est undefined).
  const [scheduleEnabled, setScheduleEnabled] = useState(!!draft.scheduledFor);
  // Modal contact picker : 'recipient' = destinataire, 'sender' = expediteur tiers
  const [contactPickerTarget, setContactPickerTarget] = useState<
    null | 'recipient' | 'sender'
  >(null);

  const refreshSettings = useSettingsStore((s) => s.refresh);
  // Flag qui indique si on a déjà initialise le wizard pour cette session.
  // On veut reset SEULEMENT la premiere fois qu'on entre (depuis l'accueil),
  // pas quand on revient d'un sous-ecran comme address-picker.
  const initializedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      // Toujours rafraichir les settings (tarifs eventuellement modifies)
      refreshSettings();

      // Si le draft est totalement vide (entre fresh depuis l'accueil, ou
      // retour apres une livraison reussie/annulee qui a vide le draft),
      // on remet le wizard a l'etape 0. Sinon, on garde l'etat (utile si
      // on revient d'address-picker avec une position deja saisie).
      const currentDraft = useDeliveryStore.getState().draft;
      const draftIsEmpty =
        !currentDraft.packageType &&
        !currentDraft.pickupLocation &&
        !currentDraft.deliveryLocation &&
        !currentDraft.recipientName &&
        !currentDraft.recipientPhone;

      if (!initializedRef.current || draftIsEmpty) {
        setStep(0);
        if (!draftIsEmpty) resetDraft();
        initializedRef.current = true;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // Quand le composant est unmount (retour a l'accueil par exemple),
  // on remet le flag pour que la prochaine ouverture reparte de zero.
  React.useEffect(() => {
    return () => {
      initializedRef.current = false;
    };
  }, []);

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
        'Position de récupération manquante',
        'Utilisez "Coller lien", "Ma position" ou "Sur la carte" pour definir le point de récupération.',
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
      Alert.alert('Destinataire manquant', 'Renseignez le nom et le téléphone du destinataire.');
      return;
    }
    // Toggle "Programmer" active mais aucune date valide -> on empeche le submit
    // pour eviter qu'une mauvaise saisie soit silencieusement ignoree.
    if (scheduleEnabled && !draft.scheduledFor) {
      Alert.alert(
        'Heure de livraison invalide',
        "Choisissez une date au moins 10 minutes après l'heure actuelle, ou désactivez la programmation pour une recherche immédiate.",
      );
      return;
    }

    // Capture le scheduledFor AVANT createDelivery (qui reset le draft),
    // pour pouvoir afficher l'heure exacte dans l'alert.
    const scheduledIsoBefore = draft.scheduledFor;

    try {
      const delivery = await createDelivery(user.id);
      if (delivery?.status === 'scheduled') {
        const when = scheduledIsoBefore
          ? new Date(scheduledIsoBefore).toLocaleString('fr-FR', {
              dateStyle: 'medium',
              timeStyle: 'short',
            })
          : 'plus tard';
        Alert.alert(
          'Livraison programmée',
          `Votre course sera diffusée aux livreurs le ${when}. Vous recevrez une notification.`,
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
          'La demande met du temps a etre envoyee. Vérifiez votre réseau et réessayez.',
        );
      } else {
        const msg =
          e?.response?.data?.error?.message ||
          e?.message ||
          'Impossible de créer la livraison. Vérifiez les informations saisies.';
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
        placeholder="Ex: Téléphone portable"
        value={draft.packageDescription || ''}
        onChangeText={(v) => setDraftField('packageDescription', v)}
        containerStyle={styles.inputMargin}
      />
    </View>,

    // Step 1: Addresses
    <View key="addresses" style={styles.stepContent}>
      <Text style={styles.stepTitle}>Trajet</Text>
      <Text style={styles.stepHint}>
        Appuyez sur chaque champ pour saisir l'adresse.
      </Text>

      <View style={{ gap: spacing.sm }}>
        <AddressField
          variant="pickup"
          address={draft.pickupAddress}
          location={draft.pickupLocation}
        />
        <AddressField
          variant="delivery"
          address={draft.deliveryAddress}
          location={draft.deliveryLocation}
        />
      </View>
    </View>,

    // Step 2: Recipient
    <View key="recipient" style={styles.stepContent}>
      <Text style={styles.stepTitle}>Destinataire</Text>

      {/* Picker contact */}
      <TouchableOpacity
        style={styles.contactBtn}
        onPress={() => setContactPickerTarget('recipient')}
        activeOpacity={0.7}
      >
        <Ionicons name="people-outline" size={18} color={colors.primary} />
        <Text style={styles.contactBtnText}>Choisir depuis mes contacts</Text>
      </TouchableOpacity>

      <Input
        label="Nom du destinataire"
        placeholder="Ex: Rasmane Kindo"
        value={draft.recipientName || ''}
        onChangeText={(v) => setDraftField('recipientName', v)}
        autoCapitalize="words"
        containerStyle={styles.inputMargin}
      />
      <Input
        label="Téléphone du destinataire"
        placeholder="70 12 34 56"
        value={draft.recipientPhone || ''}
        onChangeText={(v) => setDraftField('recipientPhone', v)}
        keyboardType="phone-pad"
        containerStyle={styles.inputMargin}
      />

      {/* Toggle expéditeur tiers — UX améliorée */}
      <TouchableOpacity
        style={styles.toggleRow}
        onPress={() => {
          const next = !thirdPartyPickup;
          setThirdPartyPickup(next);
          if (!next) {
            setDraftField('senderContactName', undefined);
            setDraftField('senderContactPhone', undefined);
          }
        }}
        activeOpacity={0.7}
      >
        <View
          style={[styles.checkbox, thirdPartyPickup && styles.checkboxChecked]}
        >
          {thirdPartyPickup && (
            <Ionicons name="checkmark" size={16} color={colors.white} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleLabel}>
            Quelqu'un d'autre détient le colis
          </Text>
          <Text style={styles.toggleHint}>
            Activez cette option si le colis n'est pas chez vous (ex : chez un
            ami, dans une boutique). Le livreur contactera cette personne.
          </Text>
        </View>
      </TouchableOpacity>

      {thirdPartyPickup && (
        <View style={styles.thirdPartyBlock}>
          <TouchableOpacity
            style={styles.contactBtn}
            onPress={() => setContactPickerTarget('sender')}
            activeOpacity={0.7}
          >
            <Ionicons name="people-outline" size={18} color={colors.primary} />
            <Text style={styles.contactBtnText}>Choisir depuis mes contacts</Text>
          </TouchableOpacity>
          <Input
            label="Nom de l'expéditeur"
            placeholder="Ex: Awa Sawadogo"
            value={draft.senderContactName || ''}
            onChangeText={(v) => setDraftField('senderContactName', v)}
            autoCapitalize="words"
            containerStyle={styles.inputMargin}
          />
          <Input
            label="Téléphone de l'expéditeur"
            placeholder="70 12 34 56"
            value={draft.senderContactPhone || ''}
            onChangeText={(v) => setDraftField('senderContactPhone', v)}
            keyboardType="phone-pad"
            containerStyle={styles.inputMargin}
          />
        </View>
      )}
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
          <Text style={styles.summaryLabel}>Récupération</Text>
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
        {thirdPartyPickup && draft.senderContactName && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Expéditeur</Text>
            <Text style={styles.summaryValue}>{draft.senderContactName}</Text>
          </View>
        )}
      </Card>

      {/* Programmer la livraison */}
      <SchedulePicker
        value={draft.scheduledFor}
        onChange={(iso) => setDraftField('scheduledFor', iso)}
        onEnabledChange={setScheduleEnabled}
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
                // Validation par étape
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
                  if (
                    thirdPartyPickup &&
                    (!draft.senderContactName?.trim() ||
                      !draft.senderContactPhone?.trim())
                  ) {
                    Alert.alert(
                      'Expediteur incomplet',
                      "Renseignez le nom et le téléphone de la personne qui detient le colis.",
                    );
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

      {/* Modal selection contact (destinataire OU expediteur tiers) */}
      <ContactPickerModal
        visible={contactPickerTarget !== null}
        onClose={() => setContactPickerTarget(null)}
        title={
          contactPickerTarget === 'sender'
            ? "Choisir l'expéditeur"
            : 'Choisir le destinataire'
        }
        onPick={({ name, phone }) => {
          if (contactPickerTarget === 'recipient') {
            setDraftField('recipientName', name);
            setDraftField('recipientPhone', phone);
          } else if (contactPickerTarget === 'sender') {
            setDraftField('senderContactName', name);
            setDraftField('senderContactPhone', phone);
          }
          setContactPickerTarget(null);
        }}
      />
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
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
    marginBottom: spacing.md,
  },
  contactBtnText: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    marginTop: spacing.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toggleLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  toggleHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  thirdPartyBlock: {
    marginTop: spacing.md,
  },
});
