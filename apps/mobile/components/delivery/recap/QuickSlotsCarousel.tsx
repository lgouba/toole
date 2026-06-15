import React from 'react';
import { ScrollView, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { recap as R } from '@/theme/recapTokens';
import { Slot, formatTimeHM, formatDayShort } from '@/utils/scheduleSlots';

const ICON: Record<Slot['icon'], string> = { bolt: '⚡', moon: '🌙', sun: '🌅' };
const TILE_W = 100;
const GAP = 9;

interface Props {
  slots: Slot[];
  selectedKey?: string;
  onSelect: (slot: Slot) => void;
}

/** Carrousel horizontal des créneaux suggérés (heures réelles calculées). */
export function QuickSlotsCarousel({ slots, selectedKey, onSelect }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={TILE_W + GAP}
      contentContainerStyle={styles.content}
    >
      {slots.map((s) => {
        const active = s.key === selectedKey;
        return (
          <TouchableOpacity
            key={s.key}
            style={[styles.tile, active && styles.tileActive]}
            onPress={() => onSelect(s)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${s.label}, ${formatTimeHM(s.at)}, ${formatDayShort(s.at)}`}
          >
            <Text style={styles.icon}>{ICON[s.icon]}</Text>
            <Text style={[styles.label, active && styles.textActive]} numberOfLines={1}>
              {s.label}
            </Text>
            <Text style={[styles.time, active && styles.textActive]}>{formatTimeHM(s.at)}</Text>
            <Text style={[styles.day, active && styles.dayActive]}>{formatDayShort(s.at)}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { gap: GAP, paddingVertical: 2, paddingRight: 4 },
  tile: {
    width: TILE_W,
    borderRadius: R.radius.tile,
    borderWidth: 1,
    borderColor: R.color.border,
    backgroundColor: R.color.surface,
    paddingVertical: R.space.lg,
    paddingHorizontal: R.space.md,
    gap: 3,
  },
  tileActive: { backgroundColor: R.color.green, borderColor: R.color.green },
  icon: { fontSize: 16 },
  label: { fontFamily: R.font.body, fontSize: 11, color: R.color.textSecond },
  time: { fontFamily: R.font.mono, fontSize: 18, color: R.color.textPrimary, marginTop: 1 },
  day: { fontFamily: R.font.mono, fontSize: 10, letterSpacing: 0.5, color: R.color.textMuted },
  textActive: { color: '#FFFFFF' },
  dayActive: { color: 'rgba(255,255,255,0.85)' },
});
