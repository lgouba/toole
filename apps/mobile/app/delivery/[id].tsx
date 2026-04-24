import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Badge } from '@/components/ui';
import { Map } from '@/components/map/Map';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useAuthStore } from '@/stores/auth.store';
import { Delivery, PACKAGE_LABELS } from '@/types';
import * as deliveryService from '@/services/delivery.service';
import { resolveUploadUrl } from '@/services/upload.service';
import { formatCFA, formatDateTime, formatDistance } from '@/utils/format';
import { openPhone } from '@/utils/linking';

/** Livraison encore en cours : on peut afficher les numéros de téléphone. */
function isActiveDelivery(status: string): boolean {
  return ['pending', 'accepted', 'picking_up', 'picked_up', 'delivering'].includes(
    status,
  );
}

export default function DeliveryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    deliveryService
      .getDeliveryById(id)
      .then((d) => setDelivery(d))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!delivery) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Détail</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loader}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>Livraison introuvable</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isSender = user?.id === delivery.senderId;
  const canCancel =
    ['pending', 'accepted', 'picking_up'].includes(delivery.status) &&
    (isSender || user?.id === delivery.driverId);

  const handleCancel = () => {
    Alert.alert('Annuler cette livraison ?', 'Cette action est irreversible.', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui, annuler',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          const updated = await deliveryService.cancelDelivery(
            delivery.id,
            isSender ? 'client_cancelled' : 'driver_unavailable',
          );
          setCancelling(false);
          if (updated) setDelivery(updated);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{delivery.reference}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Statut */}
        <View style={styles.statusRow}>
          <Badge status={delivery.status} />
          <Text style={styles.dateText}>{formatDateTime(delivery.createdAt)}</Text>
        </View>

        {/* Carte trajet */}
        <View style={styles.mapCard}>
          <Map
            center={delivery.pickupLocation}
            zoom={12}
            interactive={false}
            markers={[
              { id: 'pickup', coordinate: delivery.pickupLocation, icon: 'pickup' },
              { id: 'delivery', coordinate: delivery.deliveryLocation, icon: 'delivery' },
            ]}
            routeCoordinates={[delivery.pickupLocation, delivery.deliveryLocation]}
          />
        </View>

        {/* Colis */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Colis</Text>
          <Row label="Type" value={PACKAGE_LABELS[delivery.packageType]} />
          {delivery.packageDescription ? (
            <Row label="Description" value={delivery.packageDescription} />
          ) : null}
          {delivery.estimatedDistanceKm != null ? (
            <Row
              label="Distance"
              value={formatDistance(delivery.estimatedDistanceKm)}
            />
          ) : null}
          <Row label="Prix" value={formatCFA(delivery.price)} highlight />
        </Card>

        {/* Adresses */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Adresses</Text>
          <View style={styles.addressBlock}>
            <View style={styles.dotPickup} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addressLabel}>Récupération</Text>
              <Text style={styles.addressValue}>{delivery.pickupAddress}</Text>
              {delivery.pickupDetails ? (
                <Text style={styles.addressDetails}>{delivery.pickupDetails}</Text>
              ) : null}
            </View>
          </View>
          <View style={styles.addressConnector} />
          <View style={styles.addressBlock}>
            <View style={styles.dotDelivery} />
            <View style={{ flex: 1 }}>
              <Text style={styles.addressLabel}>Livraison</Text>
              <Text style={styles.addressValue}>{delivery.deliveryAddress}</Text>
              {delivery.deliveryDetails ? (
                <Text style={styles.addressDetails}>{delivery.deliveryDetails}</Text>
              ) : null}
            </View>
          </View>
        </Card>

        {/* Destinataire : numéro et bouton appel masques une fois la livraison
            terminee / annulée / expiree (confidentialite) */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Destinataire</Text>
          <View style={styles.recipientRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.recipientName}>{delivery.recipientName}</Text>
              {isActiveDelivery(delivery.status) ? (
                <Text style={styles.recipientPhone}>{delivery.recipientPhone}</Text>
              ) : null}
            </View>
            {isActiveDelivery(delivery.status) ? (
              <TouchableOpacity
                style={styles.callBtn}
                onPress={() => openPhone(delivery.recipientPhone)}
              >
                <Ionicons name="call" size={20} color={colors.primary} />
              </TouchableOpacity>
            ) : null}
          </View>
        </Card>

        {/* Code de validation (seulement visible si sender et non livre) */}
        {isSender && delivery.validationCode && delivery.status !== 'delivered' ? (
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Code de validation</Text>
            <Text style={styles.codeValue}>{delivery.validationCode}</Text>
            <Text style={styles.codeHint}>
              Communiquez ce code au destinataire
            </Text>
          </View>
        ) : null}

        {/* Photos */}
        {(delivery.packagePhotoPickupUrl || delivery.packagePhotoDeliveryUrl) && (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>Preuves</Text>
            <View style={styles.photosRow}>
              {delivery.packagePhotoPickupUrl ? (
                <View style={styles.photoWrap}>
                  <Text style={styles.photoLabel}>Récupération</Text>
                  <Image
                    source={{ uri: resolveUploadUrl(delivery.packagePhotoPickupUrl) ?? '' }}
                    style={styles.photo}
                  />
                </View>
              ) : null}
              {delivery.packagePhotoDeliveryUrl ? (
                <View style={styles.photoWrap}>
                  <Text style={styles.photoLabel}>Livraison</Text>
                  <Image
                    source={{ uri: resolveUploadUrl(delivery.packagePhotoDeliveryUrl) ?? '' }}
                    style={styles.photo}
                  />
                </View>
              ) : null}
            </View>
          </Card>
        )}

        {/* Dates cles */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Chronologie</Text>
          <Row label="Créée" value={formatDateTime(delivery.createdAt)} />
          {delivery.acceptedAt ? (
            <Row label="Acceptée" value={formatDateTime(delivery.acceptedAt)} />
          ) : null}
          {delivery.pickedUpAt ? (
            <Row label="Récupérée" value={formatDateTime(delivery.pickedUpAt)} />
          ) : null}
          {delivery.deliveredAt ? (
            <Row label="Livrée" value={formatDateTime(delivery.deliveredAt)} />
          ) : null}
          {delivery.cancelledAt ? (
            <Row label="Annulée" value={formatDateTime(delivery.cancelledAt)} />
          ) : null}
        </Card>

        {canCancel ? (
          <Button
            title="Annuler cette livraison"
            variant="outline"
            onPress={handleCancel}
            loading={cancelling}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={[rowStyles.value, highlight && rowStyles.valueHighlight]}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  label: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  value: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '500',
    maxWidth: '60%',
    textAlign: 'right',
  },
  valueHighlight: {
    color: colors.primary,
    fontWeight: '700',
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { padding: 4 },
  title: { ...typography.bodyMedium, color: colors.textPrimary },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  emptyText: { ...typography.body, color: colors.textSecondary },
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateText: { ...typography.caption, color: colors.textTertiary },
  mapCard: {
    height: 200,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  section: { gap: 4 },
  sectionTitle: {
    ...typography.captionMedium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  addressBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  addressConnector: {
    width: 2,
    height: 16,
    backgroundColor: colors.border,
    marginLeft: 5,
    marginVertical: 2,
  },
  dotPickup: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    marginTop: 4,
  },
  dotDelivery: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.secondary,
    marginTop: 4,
  },
  addressLabel: {
    ...typography.captionMedium,
    color: colors.textTertiary,
  },
  addressValue: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  addressDetails: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  recipientName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  recipientPhone: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  codeLabel: {
    ...typography.captionMedium,
    color: colors.primaryDark,
  },
  codeValue: {
    ...typography.h1,
    color: colors.primaryDark,
    letterSpacing: 8,
    marginVertical: spacing.xs,
  },
  codeHint: {
    ...typography.caption,
    color: colors.primaryDark,
  },
  photosRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  photoWrap: { flex: 1 },
  photoLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  photo: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
  },
});
