import React, { useMemo, useRef, useState } from 'react';
import { View, Text, Switch, TouchableOpacity, StyleSheet } from 'react-native';
import { recap as R } from '@/theme/recapTokens';
import { useSettingsStore } from '@/stores/settings.store';
import {
  generateSlots,
  formatNowLong,
  ouagaFields,
  DEFAULT_MIN_LEAD_MIN,
  Slot,
} from '@/utils/scheduleSlots';
import { QuickSlotsCarousel } from './QuickSlotsCarousel';
import { DateTimeWheelSheet } from './DateTimeWheelSheet';

interface Props {
  /** ISO 8601 (heure programmée) ou undefined (= diffusion immédiate). */
  value: string | undefined;
  onChange: (iso: string | undefined) => void;
  onEnabledChange?: (enabled: boolean) => void;
}

/**
 * Bloc "Programmer la livraison" : toggle, carrousel de créneaux, champs
 * date/heure ouvrant une molette. Contrat externe identique à l'ancien
 * SchedulePicker (value ISO | undefined) → aucun changement du flow de création.
 */
export function ScheduleDelivery({ value, onChange, onEnabledChange }: Props) {
  const minLead =
    useSettingsStore((s) => s.settings.operations.scheduledMinDelayMinutes) ??
    DEFAULT_MIN_LEAD_MIN;

  // "Maintenant" figé au montage (instant courant).
  const now = useRef(new Date()).current;
  const slots = useMemo(() => generateSlots(now, minLead), [now, minLead]);

  const [enabled, setEnabled] = useState<boolean>(!!value);
  const [localDate, setLocalDate] = useState<Date>(
    value ? new Date(value) : slots[0]?.at ?? now,
  );
  const [slotKey, setSlotKey] = useState<string | undefined>(undefined);
  const [sheet, setSheet] = useState<{ open: boolean; mode: 'date' | 'time' }>({
    open: false,
    mode: 'date',
  });

  const isValid = (d: Date) => d.getTime() >= Date.now() + minLead * 60_000;
  const commit = (d: Date) => onChange(isValid(d) ? d.toISOString() : undefined);

  const toggle = (on: boolean) => {
    setEnabled(on);
    onEnabledChange?.(on);
    if (on) {
      const first = slots[0];
      const d = first?.at ?? new Date(Date.now() + (minLead + 30) * 60_000);
      setLocalDate(d);
      setSlotKey(first?.key);
      commit(d);
    } else {
      setSlotKey(undefined);
      onChange(undefined);
    }
  };

  const selectSlot = (s: Slot) => {
    setLocalDate(s.at);
    setSlotKey(s.key);
    commit(s.at);
  };

  const onWheelConfirm = (d: Date) => {
    setSheet((p) => ({ ...p, open: false }));
    setLocalDate(d);
    setSlotKey(undefined); // ajustement manuel = créneau désélectionné
    commit(d);
  };

  const f = ouagaFields(localDate);
  const invalid = enabled && !isValid(localDate);

  return (
    <View style={styles.card}>
      {/* En-tête + toggle */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Programmer la livraison</Text>
          <Text style={styles.subtitle}>Diffusée aux livreurs au moment choisi</Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={toggle}
          trackColor={{ false: R.color.border, true: R.color.green }}
          thumbColor="#FFFFFF"
          accessibilityRole="switch"
        />
      </View>

      {enabled && (
        <View style={styles.body}>
          <View style={styles.nowChip}>
            <Text style={styles.nowChipText}>🕐 Maintenant : {formatNowLong(now)}</Text>
          </View>

          <Text style={styles.fieldLabel}>CRÉNEAUX SUGGÉRÉS</Text>
          <QuickSlotsCarousel slots={slots} selectedKey={slotKey} onSelect={selectSlot} />

          <Text style={[styles.fieldLabel, { marginTop: R.space.lg }]}>OU CHOISIS PRÉCISÉMENT</Text>

          {/* DATE */}
          <View style={styles.fieldsRow}>
            <Field text={f.dd} onPress={() => setSheet({ open: true, mode: 'date' })} active={sheet.open && sheet.mode === 'date'} a11y={`Choisir le jour, ${f.dd}`} />
            <Text style={styles.sep}>/</Text>
            <Field text={f.mm} onPress={() => setSheet({ open: true, mode: 'date' })} active={sheet.open && sheet.mode === 'date'} a11y={`Choisir le mois, ${f.mm}`} />
            <Text style={styles.sep}>/</Text>
            <Field text={f.yyyy} flex={1.4} onPress={() => setSheet({ open: true, mode: 'date' })} active={sheet.open && sheet.mode === 'date'} a11y={`Choisir l'année, ${f.yyyy}`} />
          </View>

          {/* HEURE */}
          <View style={[styles.fieldsRow, { marginTop: R.space.sm }]}>
            <Field text={f.HH} onPress={() => setSheet({ open: true, mode: 'time' })} active={sheet.open && sheet.mode === 'time'} a11y={`Choisir l'heure, ${f.HH}`} />
            <Text style={styles.sep}>:</Text>
            <Field text={f.MM} onPress={() => setSheet({ open: true, mode: 'time' })} active={sheet.open && sheet.mode === 'time'} a11y={`Choisir les minutes, ${f.MM}`} />
            <View style={{ flex: 1.4 }} />
          </View>

          {invalid && (
            <Text style={styles.errorText}>
              Choisis une heure au moins {minLead} min après maintenant.
            </Text>
          )}
        </View>
      )}

      <DateTimeWheelSheet
        visible={sheet.open}
        mode={sheet.mode}
        value={localDate}
        onConfirm={onWheelConfirm}
        onCancel={() => setSheet((p) => ({ ...p, open: false }))}
      />
    </View>
  );
}

function Field({
  text,
  onPress,
  active,
  flex = 1,
  a11y,
}: {
  text: string;
  onPress: () => void;
  active?: boolean;
  flex?: number;
  a11y?: string;
}) {
  return (
    <TouchableOpacity
      style={[styles.field, active && styles.fieldActive, { flex }]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={a11y}
    >
      <Text style={styles.fieldText}>{text}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: R.color.surface,
    borderRadius: R.radius.card - 6,
    borderWidth: 1,
    borderColor: R.color.border,
    padding: R.space.gut,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: R.space.md },
  title: { fontFamily: R.font.display, fontSize: 16, color: R.color.textPrimary },
  subtitle: { fontFamily: R.font.body, fontSize: 12.5, color: R.color.textMuted, marginTop: 2 },
  body: { marginTop: R.space.lg, gap: R.space.sm },
  nowChip: {
    alignSelf: 'flex-start',
    backgroundColor: R.color.greenTintBg,
    borderRadius: R.radius.pill,
    paddingHorizontal: R.space.lg,
    paddingVertical: R.space.xs,
  },
  nowChipText: { fontFamily: R.font.mono, fontSize: 11, color: R.color.green },
  fieldLabel: {
    fontFamily: R.font.mono,
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: R.color.textMuted,
    marginTop: R.space.sm,
    marginBottom: R.space.xs,
  },
  fieldsRow: { flexDirection: 'row', alignItems: 'center', gap: R.space.sm },
  field: {
    height: 48,
    borderRadius: R.radius.field,
    borderWidth: 1,
    borderColor: R.color.border,
    backgroundColor: R.color.greenTintBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldActive: {
    borderColor: R.color.green,
    backgroundColor: '#FFFFFF',
  },
  fieldText: { fontFamily: R.font.mono, fontSize: 15, color: R.color.textPrimary },
  sep: { fontFamily: R.font.mono, fontSize: 16, color: R.color.textMuted },
  errorText: {
    fontFamily: R.font.body,
    fontSize: 12.5,
    color: '#B91C1C',
    marginTop: R.space.sm,
  },
});
