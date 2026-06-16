import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { recap as R, driverHome as D } from '@/theme/recapTokens';
import { formatCFA } from '@/utils/format';

interface Props {
  revenueToday?: number;
  courses?: number;
  onlineLabel: string; // ex. "1 h 12" ou "—"
  rating?: number | null;
}

/** Gains du jour + 3 KPIs (Courses / En ligne / Note). */
export function DriverKpis({ revenueToday, courses, onlineLabel, rating }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.earnLabel}>GAINS AUJOURD'HUI</Text>
      <Text style={styles.earnValue}>{formatCFA(revenueToday ?? 0)}</Text>

      <View style={styles.kpis}>
        <Kpi value={courses != null ? String(courses) : '—'} label="COURSES" />
        <View style={styles.sep} />
        <Kpi value={onlineLabel} label="EN LIGNE" />
        <View style={styles.sep} />
        <Kpi value={rating ? rating.toFixed(1) : '—'} label="NOTE" />
      </View>
    </View>
  );
}

function Kpi({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 2 },
  earnLabel: { fontFamily: R.font.mono, fontSize: 9.5, letterSpacing: 1.4, color: D.textMuted },
  earnValue: { fontFamily: R.font.displayXBold, fontSize: 28, color: D.green, marginTop: 1 },
  kpis: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: D.surface,
    borderRadius: D.radius.card,
    borderWidth: 1,
    borderColor: D.border,
    paddingVertical: R.space.lg,
    marginTop: R.space.md,
  },
  kpi: { flex: 1, alignItems: 'center', gap: 2 },
  kpiValue: { fontFamily: R.font.displayXBold, fontSize: 17, color: D.textPrim },
  kpiLabel: { fontFamily: R.font.mono, fontSize: 8.5, letterSpacing: 1, color: D.textMuted },
  sep: { width: 1, height: 26, backgroundColor: D.divider },
});
