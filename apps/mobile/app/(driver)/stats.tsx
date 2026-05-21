import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui';
import { MiniBarChart } from '@/components/MiniBarChart';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { getMyDriverStats, type DriverStats } from '@/services/driver.service';
import { formatCFA, formatRating } from '@/utils/format';

type PeriodId = 'today' | 'week' | 'month';

const PERIOD_LABELS: Record<PeriodId, string> = {
  today: "Aujourd'hui",
  week: '7 jours',
  month: '30 jours',
};

export default function DriverStatsScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<DriverStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<PeriodId>('week');

  const load = async () => {
    const data = await getMyDriverStats();
    setStats(data);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!stats) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Impossible de charger les stats.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const current = stats[period];
  const totalEarnings = current.revenue + current.tips;

  // Choix du dataset pour le graphique selon la période
  const chartData =
    period === 'today'
      ? stats.last30Days.slice(-1).map((d) => ({
          label: 'Aujourd\'hui',
          value: d.revenue,
        }))
      : period === 'week'
        ? stats.last30Days.slice(-7).map((d) => ({
            label: formatDayShort(d.date),
            value: d.revenue,
          }))
        : stats.last30Days.map((d) => ({
            label: formatDayShort(d.date),
            value: d.revenue,
          }));

  const courseChartData =
    period === 'today'
      ? stats.last30Days.slice(-1).map((d) => ({
          label: 'Aujourd\'hui',
          value: d.count,
        }))
      : period === 'week'
        ? stats.last30Days.slice(-7).map((d) => ({
            label: formatDayShort(d.date),
            value: d.count,
          }))
        : stats.last30Days.map((d) => ({
            label: formatDayShort(d.date),
            value: d.count,
          }));

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes statistiques</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Sélecteur de période */}
        <View style={styles.periodSelector}>
          {(['today', 'week', 'month'] as PeriodId[]).map((p) => {
            const active = period === p;
            return (
              <TouchableOpacity
                key={p}
                style={[styles.periodTab, active && styles.periodTabActive]}
                onPress={() => setPeriod(p)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.periodTabText,
                    active && styles.periodTabTextActive,
                  ]}
                >
                  {PERIOD_LABELS[p]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Carte hero — CA */}
        <Card style={styles.heroCard}>
          <Text style={styles.heroLabel}>Vos gains · {PERIOD_LABELS[period]}</Text>
          <Text style={styles.heroValue}>{formatCFA(totalEarnings)}</Text>
          <View style={styles.heroSubrow}>
            <View style={styles.heroSubItem}>
              <Text style={styles.heroSubLabel}>Commissions</Text>
              <Text style={styles.heroSubValue}>
                {formatCFA(current.revenue)}
              </Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroSubItem}>
              <Text style={styles.heroSubLabel}>Pourboires</Text>
              <Text style={styles.heroSubValue}>
                {formatCFA(current.tips)}
              </Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroSubItem}>
              <Text style={styles.heroSubLabel}>Courses</Text>
              <Text style={styles.heroSubValue}>{current.deliveredCount}</Text>
            </View>
          </View>
        </Card>

        {/* Graphique CA */}
        <Card style={styles.chartCard}>
          <Text style={styles.chartTitle}>
            Chiffre d'affaires · {PERIOD_LABELS[period]}
          </Text>
          <MiniBarChart
            data={chartData}
            height={140}
            barWidth={period === 'month' ? 8 : 22}
            gap={period === 'month' ? 4 : 8}
            formatValue={(v) => formatCFA(v)}
          />
        </Card>

        {/* Graphique courses */}
        <Card style={styles.chartCard}>
          <Text style={styles.chartTitle}>
            Nombre de courses · {PERIOD_LABELS[period]}
          </Text>
          <MiniBarChart
            data={courseChartData}
            height={120}
            barWidth={period === 'month' ? 8 : 22}
            gap={period === 'month' ? 4 : 8}
            color={colors.secondary}
            formatValue={(v) => String(v)}
          />
        </Card>

        {/* Classement (gamification) */}
        <Card style={styles.rankCard}>
          <View style={styles.rankIconWrap}>
            <Text style={styles.rankEmoji}>
              {stats.ranking.position === 1
                ? '🏆'
                : stats.ranking.position <= 3
                  ? '🥇'
                  : stats.ranking.position <= 10
                    ? '⭐'
                    : '📊'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rankLabel}>Classement (30 derniers jours)</Text>
            <Text style={styles.rankValue}>
              {stats.ranking.position}
              <Text style={styles.rankSub}> / {stats.ranking.total} livreurs</Text>
            </Text>
            {stats.ranking.position <= 3 && stats.ranking.total > 3 ? (
              <Text style={styles.rankBadge}>
                🔥 Top 3 — Excellent travail !
              </Text>
            ) : stats.ranking.position <= 10 && stats.ranking.total > 10 ? (
              <Text style={styles.rankBadge}>⭐ Top 10 — Continuez !</Text>
            ) : null}
          </View>
        </Card>

        {/* Note moyenne + taux */}
        <View style={styles.metricsRow}>
          <Card style={styles.metricCard}>
            {(() => {
              const r = formatRating(stats.ratingAvg, stats.ratingCount);
              return (
                <>
                  <View style={styles.metricHeader}>
                    <Ionicons
                      name="star"
                      size={18}
                      color={r.hasRatings ? colors.warning : colors.textTertiary}
                    />
                    <Text style={styles.metricLabel}>Note moyenne</Text>
                  </View>
                  <Text style={styles.metricValue}>{r.value}</Text>
                  <Text style={styles.metricSub}>{r.label}</Text>
                </>
              );
            })()}
          </Card>

          <Card style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Ionicons
                name="checkmark-circle"
                size={18}
                color={colors.success}
              />
              <Text style={styles.metricLabel}>Acceptation</Text>
            </View>
            <Text style={styles.metricValue}>{stats.acceptanceRate}%</Text>
            <Text style={styles.metricSub}>des courses acceptées</Text>
          </Card>
        </View>

        <View style={styles.metricsRow}>
          <Card style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Ionicons
                name="close-circle"
                size={18}
                color={colors.error}
              />
              <Text style={styles.metricLabel}>Annulations</Text>
            </View>
            <Text style={styles.metricValue}>{stats.cancellationRate}%</Text>
            <Text style={styles.metricSub}>après acceptation</Text>
          </Card>

          <Card style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Ionicons name="cube" size={18} color={colors.primary} />
              <Text style={styles.metricLabel}>Total</Text>
            </View>
            <Text style={styles.metricValue}>{stats.totalDeliveries}</Text>
            <Text style={styles.metricSub}>courses livrées</Text>
          </Card>
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/** Formate une date ISO en label court "Lu", "12/05", etc. */
function formatDayShort(iso: string): string {
  const d = new Date(iso);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  return `${day}/${month}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textSecondary,
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
    fontWeight: '700',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 4,
    gap: 2,
  },
  periodTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.sm,
  },
  periodTabActive: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  periodTabText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  periodTabTextActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  heroCard: {
    padding: spacing.lg,
    backgroundColor: colors.primary,
  },
  heroLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '700',
  },
  heroValue: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.white,
    marginTop: 4,
    letterSpacing: -0.5,
  },
  heroSubrow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  heroSubItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  heroSubLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroSubValue: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '700',
    marginTop: 2,
  },
  chartCard: {
    padding: spacing.md,
  },
  chartTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  rankIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankEmoji: {
    fontSize: 28,
  },
  rankLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  rankValue: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: 2,
  },
  rankSub: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '400',
  },
  rankBadge: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '700',
    marginTop: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  metricCard: {
    flex: 1,
    padding: spacing.md,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  metricValue: {
    ...typography.h2,
    color: colors.textPrimary,
    marginTop: 4,
  },
  metricSub: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
