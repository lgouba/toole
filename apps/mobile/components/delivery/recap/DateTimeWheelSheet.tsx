import React, { useEffect, useMemo, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { recap as R } from '@/theme/recapTokens';
import { WheelColumn, ITEM_H } from './WheelPicker';
import {
  MONTHS_FR,
  daysInMonth,
  dateFromOuagaParts,
} from '@/utils/scheduleSlots';

interface Props {
  visible: boolean;
  mode: 'date' | 'time';
  value: Date;
  onConfirm: (d: Date) => void;
  onCancel: () => void;
}

const p2 = (n: number) => String(n).padStart(2, '0');

/** Bottom-sheet de sélection date/heure via molette (pur JS). */
export function DateTimeWheelSheet({ visible, mode, value, onConfirm, onCancel }: Props) {
  // Composantes murales Ouaga (UTC+0 → getters UTC).
  const [year, setYear] = useState(value.getUTCFullYear());
  const [month1, setMonth1] = useState(value.getUTCMonth() + 1);
  const [day, setDay] = useState(value.getUTCDate());
  const [hour, setHour] = useState(value.getUTCHours());
  const [minute, setMinute] = useState(value.getUTCMinutes());

  // Réinitialise à l'ouverture / quand la valeur change.
  useEffect(() => {
    if (!visible) return;
    setYear(value.getUTCFullYear());
    setMonth1(value.getUTCMonth() + 1);
    setDay(value.getUTCDate());
    setHour(value.getUTCHours());
    setMinute(value.getUTCMinutes());
  }, [visible, value]);

  const years = useMemo(() => {
    const base = new Date().getUTCFullYear();
    return [base, base + 1];
  }, []);
  const months = MONTHS_FR;
  const dim = daysInMonth(year, month1);
  const days = useMemo(
    () => Array.from({ length: dim }, (_, i) => p2(i + 1)),
    [dim],
  );
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => p2(i)), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => p2(i)), []);

  // Clamp le jour si le mois/année réduit le nombre de jours.
  const safeDay = Math.min(day, dim);

  const handleConfirm = () => {
    onConfirm(dateFromOuagaParts(year, month1, safeDay, hour, minute));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.scrim} onPress={onCancel} />
      <SafeAreaView edges={['bottom']} style={styles.sheetWrap}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel} hitSlop={10}>
              <Text style={styles.cancel}>Annuler</Text>
            </TouchableOpacity>
            <Text style={styles.title}>
              {mode === 'date' ? 'Choisir la date' : "Choisir l'heure"}
            </Text>
            <TouchableOpacity onPress={handleConfirm} hitSlop={10}>
              <Text style={styles.validate}>Valider</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.wheels}>
            {/* Bande centrale de sélection */}
            <View pointerEvents="none" style={styles.centerBand} />

            {mode === 'date' ? (
              <>
                <WheelColumn
                  a11yLabel="Jour"
                  data={days}
                  index={safeDay - 1}
                  onChange={(i) => setDay(i + 1)}
                />
                <WheelColumn
                  a11yLabel="Mois"
                  data={months}
                  index={month1 - 1}
                  onChange={(i) => setMonth1(i + 1)}
                  width={150}
                />
                <WheelColumn
                  a11yLabel="Année"
                  data={years.map(String)}
                  index={Math.max(0, years.indexOf(year))}
                  onChange={(i) => setYear(years[i])}
                  width={90}
                />
              </>
            ) : (
              <>
                <WheelColumn
                  a11yLabel="Heure"
                  data={hours}
                  index={hour}
                  onChange={setHour}
                  width={90}
                />
                <Text style={styles.colon}>:</Text>
                <WheelColumn
                  a11yLabel="Minute"
                  data={minutes}
                  index={minute}
                  onChange={setMinute}
                  width={90}
                />
              </>
            )}
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,18,12,0.45)' },
  sheetWrap: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  sheet: {
    backgroundColor: R.color.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingBottom: R.space.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: R.color.dashed,
    alignSelf: 'center',
    marginTop: R.space.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: R.space.pad,
    paddingVertical: R.space.lg,
  },
  cancel: { fontFamily: R.font.body, fontSize: 15, color: R.color.textMuted },
  title: { fontFamily: R.font.display, fontSize: 16, color: R.color.textPrimary },
  validate: { fontFamily: R.font.bodyBold, fontSize: 15, color: R.color.green },
  wheels: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: R.space.pad,
    paddingBottom: R.space.lg,
  },
  centerBand: {
    position: 'absolute',
    left: R.space.pad,
    right: R.space.pad,
    top: 2 * ITEM_H,
    height: ITEM_H,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: R.color.greenTintBd,
    backgroundColor: R.color.greenTintBg,
    borderRadius: 10,
  },
  colon: { fontFamily: R.font.mono, fontSize: 22, color: R.color.textPrimary, paddingHorizontal: 4 },
});
