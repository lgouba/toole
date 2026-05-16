import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, typography, spacing } from '@/theme';

export interface MiniBarChartPoint {
  /** Label affiche sous la barre (court : "Lu", "12/05", etc.) */
  label: string;
  /** Valeur numerique de la barre. */
  value: number;
}

/**
 * Mini histogramme leger pour afficher une serie de valeurs (CA quotidien,
 * nombre de courses, etc.). Utilise des Views avec hauteur dynamique pour
 * eviter de pull une lib charts trop grosse.
 *
 * - Auto-scale : la barre la plus haute = 100% de la hauteur dispo
 * - Scroll horizontal si trop de barres pour l'ecran
 * - Tooltip optionnel via prop `formatValue`
 */
export function MiniBarChart({
  data,
  height = 120,
  barWidth = 14,
  gap = 6,
  color = colors.primary,
  formatValue,
}: {
  data: MiniBarChartPoint[];
  height?: number;
  barWidth?: number;
  gap?: number;
  color?: string;
  /** Formate la valeur affichee en haut de la barre la plus haute. */
  formatValue?: (v: number) => string;
}) {
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={[styles.chart, { height }]}>
        {data.map((d, i) => {
          const ratio = d.value / maxValue;
          const barHeight = Math.max(ratio * (height - 24), d.value > 0 ? 3 : 0);
          const isMax = d.value === maxValue && d.value > 0;
          return (
            <View key={`${d.label}-${i}`} style={[styles.column, { width: barWidth, marginRight: gap }]}>
              {isMax && formatValue ? (
                <Text style={styles.peakValue}>{formatValue(d.value)}</Text>
              ) : null}
              <View
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    width: barWidth,
                    backgroundColor:
                      d.value === 0 ? colors.border : color,
                  },
                ]}
              />
              <Text style={styles.label} numberOfLines={1}>
                {d.label}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingVertical: spacing.xs,
    alignItems: 'flex-end',
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  column: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    borderRadius: 3,
  },
  label: {
    fontSize: 9,
    color: colors.textTertiary,
    marginTop: 4,
    textAlign: 'center',
  },
  peakValue: {
    fontSize: 9,
    color: colors.textSecondary,
    fontWeight: '700',
    marginBottom: 2,
  },
});
