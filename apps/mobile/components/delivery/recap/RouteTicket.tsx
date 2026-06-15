import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { recap as R } from '@/theme/recapTokens';
import { colors } from '@/theme';
import { formatCFA } from '@/utils/format';

interface Props {
  pickupAddress: string;
  dropoffAddress: string;
  recipientName?: string;
  distanceKm: number;
  basePrice: number;
  distancePrice: number;
  total: number;
}

/** Carte-billet : trajet (récup → livraison) + perforation + détail prix. */
export function RouteTicket({
  pickupAddress,
  dropoffAddress,
  recipientName,
  distanceKm,
  basePrice,
  distancePrice,
  total,
}: Props) {
  const kmLabel = `${distanceKm.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;

  return (
    <View style={styles.card}>
      {/* --- Trajet --- */}
      <View style={styles.routeBlock}>
        {/* Stop A : récupération */}
        <View style={styles.stopRow}>
          <View style={styles.dotPickupWrap}>
            <View style={styles.dotPickup} />
          </View>
          <View style={styles.stopText}>
            <Text style={styles.stopLabel}>RÉCUPÉRATION</Text>
            <Text style={styles.address}>{pickupAddress}</Text>
          </View>
        </View>

        {/* Connecteur : rail pointillé + chip distance (sur le tracé) */}
        <View style={styles.connectorRow}>
          <View style={styles.railCol}>
            <View style={styles.rail} />
          </View>
          <View style={styles.kmChip}>
            <Text style={styles.kmChipText}>📍 {kmLabel} de trajet</Text>
          </View>
        </View>

        {/* Stop B : livraison */}
        <View style={styles.stopRow}>
          <View style={styles.dotDropWrap}>
            <View style={styles.dotDrop} />
          </View>
          <View style={styles.stopText}>
            <Text style={styles.stopLabel}>
              LIVRAISON{recipientName ? ` · ${recipientName}` : ''}
            </Text>
            <Text style={styles.address}>{dropoffAddress}</Text>
          </View>
        </View>
      </View>

      {/* --- Perforation (effet ticket) --- */}
      <View style={styles.perforation}>
        <View style={[styles.notch, styles.notchLeft]} />
        <View style={styles.dashLine}>
          {Array.from({ length: 26 }).map((_, i) => (
            <View key={i} style={styles.dash} />
          ))}
        </View>
        <View style={[styles.notch, styles.notchRight]} />
      </View>

      {/* --- Prix --- */}
      <View style={styles.priceBlock}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Prix de base</Text>
          <Text style={styles.priceValue}>{formatCFA(basePrice)}</Text>
        </View>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Distance · {kmLabel}</Text>
          <Text style={styles.priceValue}>{formatCFA(distancePrice)}</Text>
        </View>
        <View style={styles.totalDivider} />
        <View style={styles.priceRow}>
          <Text style={styles.totalLabel}>TOTAL</Text>
          <Text style={styles.totalValue}>{formatCFA(total)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: R.color.surface,
    borderRadius: R.radius.card,
    borderWidth: 1,
    borderColor: R.color.border,
    ...R.shadow.card,
  },
  routeBlock: { padding: R.space.pad },

  stopRow: { flexDirection: 'row', gap: R.space.lg },
  dotPickupWrap: {
    width: 22,
    alignItems: 'center',
    paddingTop: 3,
  },
  dotPickup: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: R.color.dotPickup,
    borderWidth: 4,
    borderColor: 'rgba(22,163,74,0.15)',
  },
  dotDropWrap: { width: 22, alignItems: 'center', paddingTop: 3 },
  dotDrop: {
    width: 14,
    height: 14,
    borderRadius: 4,
    backgroundColor: R.color.dotDropoff,
  },
  stopText: { flex: 1 },
  stopLabel: {
    fontFamily: R.font.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: R.color.textMuted,
    marginBottom: 3,
  },
  address: {
    fontFamily: R.font.bodyBold,
    fontSize: 14,
    lineHeight: 19,
    color: R.color.textPrimary,
  },

  connectorRow: { flexDirection: 'row', gap: R.space.lg, alignItems: 'center', marginVertical: 2 },
  railCol: { width: 22, alignItems: 'center' },
  rail: {
    width: 2,
    height: 28,
    borderRadius: 1,
    borderLeftWidth: 2,
    borderStyle: 'dashed',
    borderColor: R.color.dashed,
  },
  kmChip: {
    backgroundColor: R.color.greenTintBg,
    borderWidth: 1,
    borderColor: R.color.greenTintBd,
    borderRadius: R.radius.pill,
    paddingHorizontal: R.space.lg,
    paddingVertical: R.space.xs,
  },
  kmChipText: {
    fontFamily: R.font.mono,
    fontSize: 11,
    letterSpacing: 0.3,
    color: R.color.green,
  },

  perforation: {
    height: 22,
    justifyContent: 'center',
    marginVertical: 2,
  },
  notch: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    // Couleur du FOND réel de l'écran (le billet est posé dessus) pour que la
    // "morsure" du ticket se fonde parfaitement.
    backgroundColor: colors.background,
    top: 0,
  },
  notchLeft: { left: -11 },
  notchRight: { right: -11 },
  dashLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: R.space.pad,
    alignItems: 'center',
  },
  dash: {
    width: 6,
    height: 2,
    borderRadius: 1,
    backgroundColor: R.color.dashed,
  },

  priceBlock: { padding: R.space.pad, paddingTop: R.space.lg },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  priceLabel: {
    fontFamily: R.font.body,
    fontSize: 13.5,
    color: R.color.textSecond,
  },
  priceValue: {
    fontFamily: R.font.mono,
    fontSize: 13.5,
    color: R.color.textPrimary,
  },
  totalDivider: {
    height: 1,
    backgroundColor: R.color.hairline,
    marginVertical: R.space.md,
  },
  totalLabel: {
    fontFamily: R.font.mono,
    fontSize: 11,
    letterSpacing: 1.5,
    color: R.color.textSecond,
  },
  totalValue: {
    fontFamily: R.font.mono,
    fontSize: 30,
    lineHeight: 34,
    color: R.color.green,
  },
});
