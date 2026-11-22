import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Card, Button } from '@/components/ui';
import { colors, typography, spacing, borderRadius, sizes } from '@/theme';
import { useAuthStore } from '@/stores/auth.store';
import { getDeliveries } from '@/services/delivery.service';
import type { Delivery } from '@/types/delivery';
import {
  createSupportTicket,
  CATEGORY_LABELS,
  type SupportCategory,
} from '@/services/support.service';
import { uploadImage } from '@/services/upload.service';

const CATEGORIES: { key: SupportCategory; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'app_problem', icon: 'warning-outline' },
  { key: 'account_data', icon: 'person-outline' },
  { key: 'dispute', icon: 'alert-circle-outline' },
  { key: 'refund', icon: 'cash-outline' },
  { key: 'other', icon: 'ellipsis-horizontal' },
];

export default function SupportScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [category, setCategory] = useState<SupportCategory | null>(null);
  const [description, setDescription] = useState('');
  const [deliveryId, setDeliveryId] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const needsDelivery = category === 'dispute' || category === 'refund';

  // Charge les courses récentes seulement quand une rubrique course-liée est choisie.
  useEffect(() => {
    if (!needsDelivery || deliveries.length || !user) return;
    const role = user.userType === 'driver' ? 'driver' : 'client';
    getDeliveries(user.id, role)
      .then((list) => setDeliveries(list.slice(0, 8)))
      .catch(() => {});
  }, [needsDelivery, deliveries.length, user]);

  const canSubmit = useMemo(
    () => !!category && description.trim().length > 0 && !submitting,
    [category, description, submitting],
  );

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', "Autorisez l'accès à la galerie.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
    });
    if (res.canceled || !res.assets[0]) return;
    setUploading(true);
    const uploaded = await uploadImage(res.assets[0].uri, 'reports');
    setUploading(false);
    if (uploaded) setPhotoUrl(uploaded.url);
    else Alert.alert('Erreur', "Envoi de la photo échoué.");
  };

  const submit = async () => {
    if (!category) return;
    setSubmitting(true);
    try {
      const ticket = await createSupportTicket({
        category,
        description: description.trim(),
        deliveryId: deliveryId ?? undefined,
        photoUrl: photoUrl ?? undefined,
      });
      Alert.alert(
        'Demande envoyée',
        `Votre demande ${ticket.reference} a bien été reçue. Nous vous répondrons rapidement.`,
        [{ text: 'OK', onPress: () => router.replace('/support-tickets' as any) }],
      );
    } catch (e) {
      const msg =
        (e as { response?: { data?: { error?: { message?: string } } } })?.response
          ?.data?.error?.message ?? "Échec de l'envoi. Vérifiez votre connexion et réessayez.";
      Alert.alert('Erreur', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Envoyer une demande</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Rubrique */}
        <Text style={styles.sectionLabel}>Type de demande</Text>
        <Card style={styles.section}>
          {CATEGORIES.map((c, i) => {
            const selected = category === c.key;
            return (
              <View key={c.key}>
                {i > 0 && <View style={styles.separator} />}
                <TouchableOpacity
                  style={styles.row}
                  activeOpacity={0.6}
                  onPress={() => setCategory(c.key)}
                >
                  <Ionicons name={c.icon} size={20} color={selected ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.rowTitle, selected && { color: colors.primary, fontWeight: '600' }]}>
                    {CATEGORY_LABELS[c.key]}
                  </Text>
                  {selected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                </TouchableOpacity>
              </View>
            );
          })}
        </Card>

        {/* Message */}
        <Text style={styles.sectionLabel}>Votre message</Text>
        <TextInput
          style={styles.textarea}
          placeholder="Décrivez votre demande…"
          placeholderTextColor={colors.textTertiary}
          multiline
          textAlignVertical="top"
          value={description}
          onChangeText={setDescription}
          maxLength={2000}
        />

        {/* Course concernée (litige / remboursement) */}
        {needsDelivery && (
          <>
            <Text style={styles.sectionLabel}>Course concernée (optionnel)</Text>
            {deliveries.length === 0 ? (
              <Text style={styles.emptyHint}>Aucune course récente à rattacher.</Text>
            ) : (
              <Card style={styles.section}>
                {deliveries.map((d, i) => {
                  const selected = deliveryId === d.id;
                  return (
                    <View key={d.id}>
                      {i > 0 && <View style={styles.separator} />}
                      <TouchableOpacity
                        style={styles.row}
                        activeOpacity={0.6}
                        onPress={() => setDeliveryId(selected ? null : d.id)}
                      >
                        <Ionicons name="cube-outline" size={20} color={selected ? colors.primary : colors.textSecondary} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.rowTitle, selected && { color: colors.primary, fontWeight: '600' }]}>
                            {d.reference}
                          </Text>
                          <Text style={styles.rowHint} numberOfLines={1}>{d.deliveryAddress}</Text>
                        </View>
                        {selected && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </Card>
            )}
          </>
        )}

        {/* Photo */}
        <Text style={styles.sectionLabel}>Photo (optionnel)</Text>
        <Card style={styles.section}>
          <TouchableOpacity style={styles.row} activeOpacity={0.6} onPress={pickPhoto} disabled={uploading}>
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.thumb} />
            ) : (
              <Ionicons name="camera-outline" size={20} color={colors.primary} />
            )}
            <Text style={[styles.rowTitle, { color: photoUrl ? colors.textPrimary : colors.primary }]}>
              {photoUrl ? 'Photo ajoutée · changer' : 'Ajouter une photo'}
            </Text>
            {uploading && <ActivityIndicator size="small" color={colors.primary} />}
          </TouchableOpacity>
        </Card>

        <Button
          title="Envoyer la demande"
          onPress={submit}
          loading={submitting}
          disabled={!canSubmit}
          style={{ marginTop: spacing.lg }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

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
  headerTitle: { ...typography.bodyMedium, color: colors.textPrimary },
  content: { padding: spacing.md, paddingBottom: spacing.xxl },
  sectionLabel: {
    ...typography.captionMedium,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  section: { padding: 0, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  rowTitle: { ...typography.body, color: colors.textPrimary, flex: 1 },
  rowHint: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: spacing.md },
  textarea: {
    ...typography.body,
    color: colors.textPrimary,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 120,
  },
  emptyHint: { ...typography.bodySmall, color: colors.textTertiary, paddingHorizontal: spacing.xs },
  thumb: { width: 28, height: 28, borderRadius: 8 },
});
