import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import {
  getSupportTicket,
  CATEGORY_LABELS,
  STATUS_LABELS,
  type SupportTicket,
  type SupportStatus,
} from '@/services/support.service';

const STATUS_TONE: Record<SupportStatus, { bg: string; fg: string }> = {
  open: { bg: colors.warningLight, fg: colors.warning },
  in_progress: { bg: colors.primaryLight, fg: colors.primaryDark },
  resolved: { bg: colors.secondaryLight, fg: colors.secondary },
};

export default function SupportTicketDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    getSupportTicket(id).then(setTicket).catch(() => setError(true));
  }, [id]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Demande</Text>
        <View style={{ width: 24 }} />
      </View>

      {error ? (
        <Text style={styles.emptyHint}>Demande introuvable.</Text>
      ) : !ticket ? (
        <Text style={styles.emptyHint}>Chargement…</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.topRow}>
            <Text style={styles.ref}>{ticket.reference}</Text>
            <View style={[styles.badge, { backgroundColor: STATUS_TONE[ticket.status].bg }]}>
              <Text style={[styles.badgeText, { color: STATUS_TONE[ticket.status].fg }]}>
                {STATUS_LABELS[ticket.status]}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Rubrique</Text>
          <Card style={styles.block}><Text style={styles.body}>{CATEGORY_LABELS[ticket.category]}</Text></Card>

          <Text style={styles.sectionLabel}>Votre message</Text>
          <Card style={styles.block}><Text style={styles.body}>{ticket.description}</Text></Card>

          {ticket.delivery && (
            <>
              <Text style={styles.sectionLabel}>Course concernée</Text>
              <Card style={styles.block}><Text style={styles.body}>{ticket.delivery.reference}</Text></Card>
            </>
          )}

          {ticket.photoUrl && (
            <>
              <Text style={styles.sectionLabel}>Photo</Text>
              <Image source={{ uri: ticket.photoUrl }} style={styles.photo} resizeMode="cover" />
            </>
          )}

          {ticket.adminNote && (
            <>
              <Text style={styles.sectionLabel}>Réponse du support</Text>
              <Card style={styles.block}><Text style={styles.body}>{ticket.adminNote}</Text></Card>
            </>
          )}
        </ScrollView>
      )}
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
  content: { padding: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  ref: { ...typography.h3, color: colors.textPrimary },
  badge: { borderRadius: borderRadius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { ...typography.caption, fontWeight: '700' },
  sectionLabel: {
    ...typography.captionMedium,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  block: {},
  body: { ...typography.body, color: colors.textPrimary },
  photo: { width: '100%', height: 220, borderRadius: borderRadius.lg, backgroundColor: colors.surface },
  emptyHint: { ...typography.body, color: colors.textTertiary, padding: spacing.lg, textAlign: 'center' },
});
