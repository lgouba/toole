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
import { Button } from '@/components/ui';
import { DeliveryRecap } from '@/components/delivery/recap/DeliveryRecap';
import { PackageStep1 } from '@/components/delivery/step1/PackageStep1';
import { TripStep2 } from '@/components/delivery/step2/TripStep2';
import { RecipientStep3 } from '@/components/delivery/step3/RecipientStep3';
import { isValidBF } from '@/utils/phone';
import { formatCFA } from '@/utils/format';
import { ContactPickerModal } from '@/components/ContactPickerModal';
import { PaymentStep4, type PayMethod } from '@/components/delivery/step4/PaymentStep4';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useDeliveryStore } from '@/stores/delivery.store';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useDeliveryPrice } from '@/hooks/useDeliveryPrice';
import {
  PackageSize,
  SIZE_TO_LEGACY_TYPE,
} from '@/types';
import { OUAGADOUGOU_CENTER } from '@/utils/geo';
import { validatePromoCode as apiValidatePromoCode } from '@/services/delivery.service';

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
  // Code promo appliqué (validé côté serveur) — pour l'état visuel du champ.
  const [promoApplied, setPromoApplied] = useState(false);
  // Paiement mobile money : OTP désormais validé EN LIGNE à l'étape 4 (plus de
  // modale post-récap). On suit le statut + la transaction + le montant payé
  // (pour invalider si le prix change ensuite).
  const [paymentStatus, setPaymentStatus] = useState<'unpaid' | 'paid'>('unpaid');
  const [paymentTxId, setPaymentTxId] = useState<string | undefined>(undefined);
  const [paidAmount, setPaidAmount] = useState<number | undefined>(undefined);
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

  // Taille par défaut = Moyen (la scène héro l'affiche par défaut) tant que
  // l'utilisateur n'a rien choisi → "Continuer" ne dépend que de la catégorie.
  React.useEffect(() => {
    if (!draft.packageSize) {
      setDraftField('packageSize', 'medium');
      setDraftField('packageType', SIZE_TO_LEGACY_TYPE['medium']);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si le montant change (retour modifier colis/trajet) après un paiement mobile
  // validé, on invalide le paiement → l'utilisateur devra re-valider à l'étape 4.
  React.useEffect(() => {
    if (paymentStatus === 'paid' && estimate && paidAmount !== estimate.price) {
      setPaymentStatus('unpaid');
      setPaymentTxId(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estimate?.price]);

  // Applique un code promo : valide côté serveur, met à jour le draft + l'état visuel.
  const applyPromo = async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    if (!estimate?.price) {
      Alert.alert('Code promo', "Renseigne d'abord le trajet pour connaître le prix.");
      return;
    }
    try {
      const result = await apiValidatePromoCode(trimmed, estimate.price);
      setDraftField('promoCode', result.code);
      setPromoApplied(true);
      Alert.alert('Code appliqué', `-${result.discountAmount.toLocaleString('fr-FR')} FCFA de remise`);
    } catch (err: any) {
      setPromoApplied(false);
      setDraftField('promoCode', '');
      Alert.alert('Code promo', err?.response?.data?.error?.message ?? 'Code promo invalide.');
    }
  };

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

    // Paiement mobile money : l'OTP est validé à l'étape 4. Ici on vérifie juste
    // que c'est bien payé (cas limite : montant changé entre-temps -> invalidé).
    const method = draft.paymentMethod ?? 'cash';
    if ((method === 'orange_money' || method === 'moov_money') && paymentStatus !== 'paid') {
      Alert.alert(
        'Paiement à valider',
        "Le montant a changé ou le paiement n'est pas validé. Valide-le à l'étape Paiement.",
        [{ text: 'OK', onPress: () => setStep(3) }],
      );
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
    // Step 0: Colis (refonte "scène héro" : taille + catégories + détails repliables)
    <View key="type" style={styles.stepContent}>
      <PackageStep1
        size={(draft.packageSize ?? 'medium') as PackageSize}
        onSizeChange={(s) => {
          setDraftField('packageSize', s);
          // Bridge legacy packageType pour back-compat backend
          setDraftField('packageType', SIZE_TO_LEGACY_TYPE[s]);
        }}
        category={draft.packageCategory}
        onCategoryChange={(c) => setDraftField('packageCategory', c)}
        description={draft.packageDescription || ''}
        onDescriptionChange={(v) => setDraftField('packageDescription', v)}
        declaredValue={draft.declaredValue ?? undefined}
        onDeclaredValueChange={(n) => setDraftField('declaredValue', n)}
        fragile={!!draft.isFragile}
        onFragileChange={(b) => setDraftField('isFragile', b)}
      />
    </View>,

    // Step 1: Trajet (refonte inline — billet + panneau source, sans carte)
    <View key="addresses" style={styles.stepContent}>
      <Text style={styles.stepTitle}>Le trajet</Text>
      <Text style={styles.stepHint}>
        Indique où récupérer puis où livrer le colis.
      </Text>

      <TripStep2
        pickup={
          draft.pickupLocation
            ? { label: draft.pickupAddress || 'Point de récupération', location: draft.pickupLocation }
            : null
        }
        dropoff={
          draft.deliveryLocation
            ? { label: draft.deliveryAddress || 'Point de livraison', location: draft.deliveryLocation }
            : null
        }
        onPickup={(p) => {
          setDraftField('pickupAddress', p.label);
          setDraftField('pickupLocation', p.location);
        }}
        onDropoff={(p) => {
          setDraftField('deliveryAddress', p.label);
          setDraftField('deliveryLocation', p.location);
        }}
        estimate={estimate ? { distanceKm: estimate.distanceKm, price: estimate.price } : null}
      />
    </View>,

    // Step 2: Destinataire (refonte cartes personne + bascule détenteur)
    <View key="recipient" style={styles.stepContent}>
      <Text style={styles.stepTitle}>Le destinataire</Text>
      <Text style={styles.stepHint}>À qui — et où — remettre le colis.</Text>

      <RecipientStep3
        recipientName={draft.recipientName || ''}
        recipientPhone={draft.recipientPhone || ''}
        onRecipientName={(v) => setDraftField('recipientName', v)}
        onRecipientPhone={(n) => setDraftField('recipientPhone', n)}
        heldByOther={thirdPartyPickup}
        onHeldByOther={(next) => {
          setThirdPartyPickup(next);
          if (!next) {
            setDraftField('senderContactName', undefined);
            setDraftField('senderContactPhone', undefined);
          }
        }}
        holderName={draft.senderContactName || ''}
        holderPhone={draft.senderContactPhone || ''}
        onHolderName={(v) => setDraftField('senderContactName', v)}
        onHolderPhone={(n) => setDraftField('senderContactPhone', n)}
        onPickContact={(which) =>
          setContactPickerTarget(which === 'holder' ? 'sender' : 'recipient')
        }
      />
    </View>,

    // Step 3: Paiement (refonte — OTP mobile money EN LIGNE ici, plus de modale)
    <View key="payment" style={styles.stepContent}>
      <Text style={styles.stepTitle}>Le paiement</Text>
      <Text style={styles.stepHint}>Comment régler cette course ?</Text>

      <PaymentStep4
        estimate={estimate}
        method={(draft.paymentMethod as PayMethod) ?? 'cash'}
        onMethodChange={(m) => {
          setDraftField('paymentMethod', m);
          // Changement de mode/opérateur → paiement réinitialisé.
          setPaymentStatus('unpaid');
          setPaymentTxId(undefined);
          setPaidAmount(undefined);
        }}
        paid={paymentStatus === 'paid'}
        txId={paymentTxId}
        onPaid={(r) => {
          setPaymentStatus('paid');
          setPaymentTxId(r.transactionId);
          setPaidAmount(estimate?.price);
        }}
      />
    </View>,

    // Step 4: Récapitulatif (direction "billet / itinéraire")
    <View key="summary" style={styles.stepContent}>
      <DeliveryRecap
        draft={draft}
        estimate={estimate}
        scheduleValue={draft.scheduledFor}
        onScheduleChange={(iso) => setDraftField('scheduledFor', iso)}
        onScheduleEnabledChange={setScheduleEnabled}
        promo={draft.promoCode ?? ''}
        onPromoChange={(v) => {
          setDraftField('promoCode', v);
          if (promoApplied) setPromoApplied(false);
        }}
        onApplyPromo={applyPromo}
        promoApplied={promoApplied}
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
              title={
                step === 3 &&
                (draft.paymentMethod === 'orange_money' ||
                  draft.paymentMethod === 'moov_money') &&
                paymentStatus !== 'paid'
                  ? 'Valide le paiement ci-dessus'
                  : 'Continuer'
              }
              disabled={
                (step === 0 && !draft.packageCategory) ||
                (step === 1 && (!draft.pickupLocation || !draft.deliveryLocation)) ||
                (step === 2 &&
                  (!draft.recipientName?.trim() ||
                    !isValidBF(draft.recipientPhone || '') ||
                    (thirdPartyPickup &&
                      (!draft.senderContactName?.trim() ||
                        !isValidBF(draft.senderContactPhone || ''))))) ||
                (step === 3 &&
                  (draft.paymentMethod === 'orange_money' ||
                    draft.paymentMethod === 'moov_money') &&
                  paymentStatus !== 'paid')
              }
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
            <Button
              title={
                estimate
                  ? `Confirmer l'envoi · ${formatCFA(estimate.price)}`
                  : "Confirmer l'envoi"
              }
              onPress={handleSubmit}
              loading={isLoading}
            />
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
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
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
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs,
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

