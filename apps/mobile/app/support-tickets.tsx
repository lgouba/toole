import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, EmptyState, SkeletonList } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import {
  listSupportTickets,
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

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function SupportTicketsScreen() {
  const router = useRouter();
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setTickets(await listSupportTickets());
    } catch {
      setTickets([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes demandes</Text>
        <View style={{ width: 24 }} />
      </View>

      {tickets === null ? (
        <View style={styles.content}>
          <SkeletonList count={4} />
        </View>
      ) : tickets.length === 0 ? (
        <EmptyState
          icon="chatbox-ellipses-outline"
          title="Aucune demande"
          subtitle="Vos demandes au support apparaîtront ici."
          actionLabel="Envoyer une demande"
          onAction={() => router.replace('/support' as any)}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {tickets.map((t) => {
            const tone = STATUS_TONE[t.status];
            return (
              <Card key={t.id} style={styles.card} onPress={() => router.push(`/support-ticket/${t.id}` as any)}>
                <View style={styles.cardTop}>
                  <Text style={styles.ref}>{t.reference}</Text>
                  <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.badgeText, { color: tone.fg }]}>{STATUS_LABELS[t.status]}</Text>
                  </View>
                </View>
                <Text style={styles.category}>{CATEGORY_LABELS[t.category]}</Text>
                <Text style={styles.desc} numberOfLines={2}>{t.description}</Text>
                <Text style={styles.date}>{formatDate(t.createdAt)}</Text>
              </Card>
            );
          })}
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
  content: { padding: spacing.md, gap: spacing.sm },
  card: { gap: 6 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ref: { ...typography.bodyMedium, color: colors.textPrimary, fontWeight: '700' },
  badge: { borderRadius: borderRadius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { ...typography.caption, fontWeight: '700' },
  category: { ...typography.caption, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  desc: { ...typography.bodySmall, color: colors.textPrimary },
  date: { ...typography.caption, color: colors.textTertiary },
});
