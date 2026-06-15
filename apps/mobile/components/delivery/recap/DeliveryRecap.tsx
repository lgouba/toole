import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { recap as R } from '@/theme/recapTokens';
import { DeliveryDraft, PriceEstimate } from '@/types';
import { RouteTicket } from './RouteTicket';
import { InfoGrid, InfoTile } from './InfoGrid';
import { PromoField } from './PromoField';
import { ScheduleDelivery } from './ScheduleDelivery';

interface Props {
  draft: DeliveryDraft;
  estimate: PriceEstimate | null;
  scheduleValue: string | undefined;
  onScheduleChange: (iso: string | undefined) => void;
  onScheduleEnabledChange: (enabled: boolean) => void;
  promo: string;
  onPromoChange: (s: string) => void;
  onApplyPromo: (code: string) => void;
  promoApplied?: boolean;
}

const SIZE_META: Record<string, { label: string; weight: string }> = {
  small: { label: 'Petit', weight: '< 5 kg' },
  medium: { label: 'Moyen', weight: '5–20 kg' },
  large: { label: 'Grand', weight: '> 20 kg' },
};

const CATEGORY_LABEL: Record<string, string> = {
  meal: 'Repas',
  cake: 'Gâteau',
  fresh: 'Produits frais',
  grocery: 'Courses',
  pharmacy: 'Pharmacie',
  cosmetics: 'Cosmétiques',
  gift: 'Cadeau',
  other: 'Colis & Divers',
};

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Espèces à la livraison',
  orange_money: 'Orange Money',
  moov_money: 'Moov Money',
};

function resolveSize(draft: DeliveryDraft): { label: string; weight: string } {
  const key =
    draft.packageSize ??
    (draft.packageType === 'envelope'
      ? 'small'
      : draft.packageType === 'small'
        ? 'medium'
        : 'large');
  return SIZE_META[key] ?? SIZE_META.medium;
}

/** Écran récap (direction billet) — assemblage des blocs. */
export function DeliveryRecap({
  draft,
  estimate,
  scheduleValue,
  onScheduleChange,
  onScheduleEnabledChange,
  promo,
  onPromoChange,
  onApplyPromo,
  promoApplied,
}: Props) {
  const size = resolveSize(draft);
  const tiles: InfoTile[] = [
    { label: 'TAILLE', value: `${size.label} · ${size.weight}` },
    {
      label: 'CATÉGORIE',
      value: draft.packageCategory
        ? CATEGORY_LABEL[draft.packageCategory] ?? 'Colis & Divers'
        : 'Colis & Divers',
    },
    {
      label: 'PAIEMENT',
      value: PAYMENT_LABEL[draft.paymentMethod ?? 'cash'] ?? 'Espèces',
    },
    { label: 'DESTINATAIRE', value: draft.recipientName || '—' },
  ];

  return (
    <View style={styles.wrap}>
      <RouteTicket
        pickupAddress={draft.pickupAddress || 'Point de récupération'}
        dropoffAddress={draft.deliveryAddress || 'Point de livraison'}
        recipientName={draft.recipientName}
        distanceKm={estimate?.distanceKm ?? 0}
        basePrice={estimate?.basePrice ?? 0}
        distancePrice={estimate?.distancePrice ?? 0}
        total={estimate?.price ?? 0}
      />

      <InfoGrid items={tiles} />

      <View>
        <Text style={styles.sectionLabel}>CODE PROMO</Text>
        <PromoField
          value={promo}
          onChangeText={onPromoChange}
          onApply={onApplyPromo}
          applied={promoApplied}
        />
      </View>

      <ScheduleDelivery
        value={scheduleValue}
        onChange={onScheduleChange}
        onEnabledChange={onScheduleEnabledChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: R.space.xxl, paddingTop: R.space.lg },
  sectionLabel: {
    fontFamily: R.font.mono,
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: R.color.textMuted,
    marginBottom: R.space.sm,
  },
});
