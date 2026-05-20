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
import {
  PaymentMethodPicker,
  type ClientPaymentMethod,
} from '@/components/PaymentMethodPicker';
import { PaymentOtpModal } from '@/components/PaymentOtpModal';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useDeliveryStore } from '@/stores/delivery.store';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useDeliveryPrice } from '@/hooks/useDeliveryPrice';
import {
  PackageCategory,
  PackageSize,
  PACKAGE_CATEGORY_META,
  PACKAGE_SIZE_META,
  SIZE_TO_LEGACY_TYPE,
} from '@/types';
import { OUAGADOUGOU_CENTER } from '@/utils/geo';
import { validatePromoCode as apiValidatePromoCode } from '@/services/delivery.service';

// Ordre d'affichage des categories dans la grille (2 colonnes).
const CATEGORY_ORDER: PackageCategory[] = [
  'meal',
  'cake',
  'fresh',
  'grocery',
  'pharmacy',
  'cosmetics',
  'gift',
  'other',
];

const SIZE_ORDER: PackageSize[] = ['small', 'medium', 'large'];

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
  // Modal de paiement Mobile Money (USSD + OTP simule)
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  // Modal contact picker : 'recipient' = destinataire, 'sender' = expéditeur tiers
  const [contactPickerTarget, setContactPickerTarget] = useState<
    null | 'recipient' | 'sender'
  >(null);

  const refreshSettings = useSettingsStore((s) => s.refresh);
  // Flag qui indique si on a déjà initialisé le wizard pour cette session.
  // On veut reset SEULEMENT la premiere fois qu'on entre (depuis l'accueil),
  // pas quand on revient d'un sous-écran comme address-picker.
  const initializedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      // Toujours rafraîchir les settings (tarifs éventuellement modifiés)
      refreshSettings();

      // Si le draft est totalement vide (entré fresh depuis l'accueil, ou
      // retour après une livraison réussie/annulée qui a vidé le draft),
      // on remet le wizard à l'étape 0. Sinon, on garde l'état (utile si
      // on revient d'address-picker avec une position déjà saisie).
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

  // Quand le composant est unmount (retour à l'accueil par exemple),
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
    draft.packageSize,
  );

  const handleSubmit = async () => {
    if (!user) return;

    // Guard: il faut au moins une position GPS sur chaque point
    if (!draft.pickupLocation) {
      Alert.alert(
        'Position de récupération manquante',
        'Utilisez "Coller lien", "Ma position" ou "Sur la carte" pour définir le point de récupération.',
      );
      return;
    }
    if (!draft.deliveryLocation) {
      Alert.alert(
        'Position de livraison manquante',
        'Utilisez "Coller lien", "Ma position" ou "Sur la carte" pour définir le point de livraison.',
      );
      return;
    }
    if (!draft.recipientName?.trim() || !draft.recipientPhone?.trim()) {
      Alert.alert('Destinataire manquant', 'Renseignez le nom et le téléphone du destinataire.');
      return;
    }
    // Toggle "Programmer" active mais aucune date validé -> on empêche le submit
    // pour éviter qu'une mauvaise saisie soit silencieusement ignorée.
    if (scheduleEnabled && !draft.scheduledFor) {
      Alert.alert(
        'Heure de livraison invalide',
        "Choisissez une date au moins 10 minutes après l'heure actuelle, ou désactivez la programmation pour une recherche immédiate.",
      );
      return;
    }

    // Si paiement Mobile Money, on ouvre le modal USSD/OTP. La creation
    // effective se fait dans `actuallyCreate` apres validation OTP.
    const method = draft.paymentMethod ?? 'cash';
    if (method === 'orange_money' || method === 'moov_money') {
      setPaymentModalVisible(true);
      return;
    }

    await actuallyCreate();
  };

  const actuallyCreate = async () => {
    if (!user) return;

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
          'La demande met du temps à être envoyée. Vérifiez votre réseau et réessayez.',
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
    // Step 0: Colis (taille + categorie + valeur + fragile + description)
    <View key="type" style={styles.stepContent}>
      <Text style={styles.stepTitle}>Parlons de votre colis</Text>
      <Text style={styles.stepHint}>
        Quelques détails pour préparer le livreur.
      </Text>

      {/* TAILLE — 3 cards */}
      <Text style={styles.sectionTitle}>Quelle est la taille de votre colis ?</Text>
      <View style={styles.sizesRow}>
        {SIZE_ORDER.map((size) => {
          const selected = draft.packageSize === size;
          const meta = PACKAGE_SIZE_META[size];
          return (
            <TouchableOpacity
              key={size}
              style={[
                styles.sizeCard,
                selected && styles.sizeCardSelected,
              ]}
              onPress={() => {
                setDraftField('packageSize', size);
                // Bridge legacy packageType pour back-compat backend
                setDraftField('packageType', SIZE_TO_LEGACY_TYPE[size]);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.sizeEmoji}>📦</Text>
              <Text
                style={[
                  styles.sizeLabel,
                  selected && styles.sizeLabelSelected,
                ]}
              >
                {meta.label}
              </Text>
              <Text style={styles.sizeWeight}>{meta.weight}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* CATEGORIE — grille 2 colonnes */}
      <Text style={styles.sectionTitle}>Que souhaitez-vous envoyer ?</Text>
      <Text style={styles.sectionHint}>
        Cela aide à mieux organiser la livraison
      </Text>
      <View style={styles.categoryGrid}>
        {CATEGORY_ORDER.map((cat) => {
          const selected = draft.packageCategory === cat;
          const meta = PACKAGE_CATEGORY_META[cat];
          return (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryCard,
                selected && styles.categoryCardSelected,
              ]}
              onPress={() => setDraftField('packageCategory', cat)}
              activeOpacity={0.7}
            >
              <Text style={styles.categoryEmoji}>{meta.emoji}</Text>
              <Text
                style={[
                  styles.categoryLabel,
                  selected && styles.categoryLabelSelected,
                ]}
                numberOfLines={2}
              >
                {meta.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Input
        label="Description (optionnel)"
        placeholder="Ex: Téléphone portable"
        value={draft.packageDescription || ''}
        onChangeText={(v) => setDraftField('packageDescription', v)}
        containerStyle={styles.inputMargin}
      />

      <Input
        label="Valeur estimée du colis (FCFA)"
        placeholder="Ex: 25 000"
        value={draft.declaredValue ? String(draft.declaredValue) : ''}
        onChangeText={(v) => {
          const n = parseInt(v.replace(/\D/g, ''), 10);
          setDraftField('declaredValue', isNaN(n) ? undefined : n);
        }}
        keyboardType="numeric"
        containerStyle={styles.inputMargin}
      />
      <Text style={styles.fieldHint}>
        Aide le livreur à prendre soin du colis. Pas de paiement supplémentaire.
      </Text>

      <TouchableOpacity
        style={styles.fragileRow}
        onPress={() => setDraftField('isFragile', !draft.isFragile)}
        activeOpacity={0.7}
      >
        <View
          style={[styles.checkbox, draft.isFragile && styles.checkboxChecked]}
        >
          {draft.isFragile && (
            <Ionicons name="checkmark" size={16} color={colors.white} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.toggleLabel}>
            🍷 Colis fragile
          </Text>
          <Text style={styles.toggleHint}>
            Manipulation délicate requise. Le livreur en sera averti.
          </Text>
        </View>
      </TouchableOpacity>
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

    // Step 3: Paiement (mode de paiement dedie pour clarte UX)
    <View key="payment" style={styles.stepContent}>
      <Text style={styles.stepTitle}>Mode de paiement</Text>
      <Text style={styles.stepHint}>
        Comment souhaitez-vous regler cette course ?
      </Text>
      <PaymentMethodPicker
        value={(draft.paymentMethod as ClientPaymentMethod) ?? 'cash'}
        onChange={(m) => setDraftField('paymentMethod', m)}
        amount={estimate?.price ?? 0}
      />
    </View>,

    // Step 4: Summary
    <View key="summary" style={styles.stepContent}>
      <Text style={styles.stepTitle}>Recapitulatif</Text>
      {estimate && <PriceEstimate estimate={estimate} />}
      <Card style={styles.summaryCard}>
        {draft.packageSize && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Taille</Text>
            <Text style={styles.summaryValue}>
              {PACKAGE_SIZE_META[draft.packageSize].label} ·{' '}
              {PACKAGE_SIZE_META[draft.packageSize].weight}
            </Text>
          </View>
        )}
        {draft.packageCategory && (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Catégorie</Text>
            <Text style={styles.summaryValue}>
              {PACKAGE_CATEGORY_META[draft.packageCategory].emoji}{' '}
              {PACKAGE_CATEGORY_META[draft.packageCategory].label}
            </Text>
          </View>
        )}
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
        {draft.declaredValue ? (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Valeur estimée</Text>
            <Text style={styles.summaryValue}>
              {draft.declaredValue.toLocaleString('fr-FR')} FCFA
            </Text>
          </View>
        ) : null}
        {draft.isFragile ? (
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Fragile</Text>
            <Text style={[styles.summaryValue, { color: '#B91C1C', fontWeight: '700' }]}>
              🍷 Oui — manipulation délicate
            </Text>
          </View>
        ) : null}
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Paiement</Text>
          <Text style={styles.summaryValue}>
            {draft.paymentMethod === 'orange_money'
              ? '🟠 Orange Money'
              : draft.paymentMethod === 'moov_money'
                ? '🔵 Moov Money'
                : '💵 Espèces à la livraison'}
          </Text>
        </View>
      </Card>

      {/* Code promo */}
      <PromoCodeBlock
        code={draft.promoCode ?? ''}
        onChange={(v) => setDraftField('promoCode', v)}
        orderAmount={estimate?.price ?? 0}
      />

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
          <View style={{ width: 24 }} />
        </View>

        {/* Indicateur de steps visuel : 5 pastilles reliees */}
        <StepsIndicator
          current={step}
          labels={['Colis', 'Trajet', 'Destinataire', 'Paiement', 'Récap']}
        />

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
          {step < 4 ? (
            <Button
              title="Continuer"
              onPress={() => {
                // Validation par étape
                if (step === 0) {
                  if (!draft.packageSize) {
                    Alert.alert(
                      'Taille manquante',
                      'Sélectionnez la taille de votre colis (Petit / Moyen / Grand).',
                    );
                    return;
                  }
                  if (!draft.packageCategory) {
                    Alert.alert(
                      'Catégorie manquante',
                      'Sélectionnez le type de contenu (Repas, Cadeau, Pharmacie, etc.).',
                    );
                    return;
                  }
                }
                if (step === 1) {
                  if (!draft.pickupLocation) {
                    Alert.alert(
                      'Position de récupération manquante',
                      'Sélectionnez une adresse dans les suggestions, utilisez "Ma position", un lien WhatsApp, ou la carte.',
                    );
                    return;
                  }
                  if (!draft.deliveryLocation) {
                    Alert.alert(
                      'Position de livraison manquante',
                      'Sélectionnez une adresse dans les suggestions, utilisez un lien WhatsApp, ou la carte.',
                    );
                    return;
                  }
                }
                if (step === 2) {
                  if (!draft.recipientName?.trim() || !draft.recipientPhone?.trim()) {
                    Alert.alert('Destinataire incomplet', 'Renseignez le nom et le téléphone.');
                    return;
                  }
                  if (
                    thirdPartyPickup &&
                    (!draft.senderContactName?.trim() ||
                      !draft.senderContactPhone?.trim())
                  ) {
                    Alert.alert(
                      'Expéditeur incomplet',
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

      {/* Modal selection contact (destinataire OU expéditeur tiers) */}
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

      {/* Modal paiement Mobile Money (USSD + OTP simule) */}
      <PaymentOtpModal
        visible={paymentModalVisible}
        method={
          (draft.paymentMethod === 'moov_money'
            ? 'moov_money'
            : 'orange_money') as 'orange_money' | 'moov_money'
        }
        amount={estimate?.price ?? 0}
        onCancel={() => setPaymentModalVisible(false)}
        onSuccess={async () => {
          setPaymentModalVisible(false);
          await actuallyCreate();
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
  stepsIndicator: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  stepItem: {
    alignItems: 'center',
    width: 64,
  },
  stepConnector: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
    marginTop: 14, // aligne sur le centre de la pastille (28/2)
  },
  stepConnectorDone: {
    backgroundColor: colors.primary,
  },
  stepBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
  },
  stepBubbleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepBubbleDone: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepNum: {
    ...typography.captionMedium,
    color: colors.textTertiary,
    fontWeight: '700',
  },
  stepNumActive: {
    color: colors.white,
  },
  stepLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 4,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  fieldHint: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 4,
    marginBottom: spacing.sm,
  },
  fragileRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  sectionHint: {
    ...typography.caption,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  sizesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sizeCard: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.white,
    gap: 4,
  },
  sizeCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  sizeEmoji: {
    fontSize: 28,
  },
  sizeLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  sizeLabelSelected: {
    color: colors.primary,
  },
  sizeWeight: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  categoryCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  categoryCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  categoryEmoji: {
    fontSize: 22,
  },
  categoryLabel: {
    ...typography.captionMedium,
    color: colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  categoryLabelSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  promoBlock: {
    marginTop: spacing.md,
  },
  promoLabel: {
    ...typography.captionMedium,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  promoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  promoInputWrap: {
    flex: 1,
  },
  promoApplyBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
    height: 48,
  },
  promoApplyText: {
    ...typography.bodySmall,
    color: colors.white,
    fontWeight: '700',
  },
  promoError: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.xs,
  },
  promoApplied: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginTop: spacing.md,
  },
  promoAppliedTitle: {
    ...typography.bodyMedium,
    color: colors.success,
    fontWeight: '700',
  },
  promoAppliedAmount: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
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

/**
 * Indicateur visuel multi-step en haut du form. Affiche N pastilles reliees
 * par des traits, avec :
 *   - une coche verte sur les etapes terminees
 *   - le numero en gras sur l'etape courante (pastille pleine)
 *   - un label sous chaque pastille (current = primary, sinon gris)
 */
function StepsIndicator({
  current,
  labels,
}: {
  current: number;
  labels: string[];
}) {
  return (
    <View style={styles.stepsIndicator}>
      {labels.map((label, i) => {
        const isDone = i < current;
        const isActive = i === current;
        return (
          <React.Fragment key={label}>
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepBubble,
                  isActive && styles.stepBubbleActive,
                  isDone && styles.stepBubbleDone,
                ]}
              >
                {isDone ? (
                  <Ionicons name="checkmark" size={16} color={colors.white} />
                ) : (
                  <Text
                    style={[
                      styles.stepNum,
                      (isActive || isDone) && styles.stepNumActive,
                    ]}
                  >
                    {i + 1}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  isActive && styles.stepLabelActive,
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </View>
            {i < labels.length - 1 && (
              <View
                style={[
                  styles.stepConnector,
                  i < current && styles.stepConnectorDone,
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

/**
 * Bloc "Code promo" : champ texte + bouton "Appliquer". Au submit, appelle
 * l'API /promo/validate pour valider le code et afficher la remise.
 *
 * Si valide -> chip vert "Code XXXX applique : -1500 FCFA"
 * Si invalide -> message d'erreur rouge sous le champ
 */
function PromoCodeBlock({
  code,
  onChange,
  orderAmount,
}: {
  code: string;
  onChange: (v: string) => void;
  orderAmount: number;
}) {
  const [input, setInput] = useState(code);
  const [applied, setApplied] = useState<{
    code: string;
    discountAmount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const apply = async () => {
    const trimmed = input.trim().toUpperCase();
    if (!trimmed) return;
    if (!orderAmount) {
      setError(
        "Veuillez d'abord remplir les autres étapes pour qu'on connaisse le prix.",
      );
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await apiValidatePromoCode(trimmed, orderAmount);
      setApplied({ code: result.code, discountAmount: result.discountAmount });
      onChange(result.code);
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ?? 'Code promo invalide.';
      setError(msg);
      setApplied(null);
      onChange('');
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setInput('');
    setApplied(null);
    setError(null);
    onChange('');
  };

  if (applied) {
    return (
      <View style={styles.promoApplied}>
        <Ionicons name="checkmark-circle" size={20} color={colors.success} />
        <View style={{ flex: 1 }}>
          <Text style={styles.promoAppliedTitle}>
            Code {applied.code} appliqué
          </Text>
          <Text style={styles.promoAppliedAmount}>
            -{applied.discountAmount.toLocaleString('fr-FR')} FCFA de remise
          </Text>
        </View>
        <TouchableOpacity onPress={clear}>
          <Ionicons name="close-circle" size={22} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.promoBlock}>
      <Text style={styles.promoLabel}>Code promo</Text>
      <View style={styles.promoRow}>
        <View style={styles.promoInputWrap}>
          <Input
            value={input}
            onChangeText={(v) => {
              setInput(v.toUpperCase());
              if (error) setError(null);
            }}
            placeholder="Entrez un code promo"
            autoCapitalize="characters"
            containerStyle={{ marginBottom: 0 }}
          />
        </View>
        <TouchableOpacity
          style={[styles.promoApplyBtn, !input.trim() && { opacity: 0.5 }]}
          onPress={apply}
          disabled={!input.trim() || loading}
          activeOpacity={0.7}
        >
          <Text style={styles.promoApplyText}>
            {loading ? '...' : 'Appliquer'}
          </Text>
        </TouchableOpacity>
      </View>
      {error ? (
        <Text style={styles.promoError}>{error}</Text>
      ) : null}
    </View>
  );
}
