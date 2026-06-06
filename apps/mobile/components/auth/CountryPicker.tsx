import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authColors as C, authFonts as F, authRadius as R } from '@/theme/auth';

export interface Country {
  code: string; // ISO
  name: string;
  dial: string; // sans le +
  flag: string;
}

export const COUNTRIES: Country[] = [
  { code: 'BF', name: 'Burkina Faso', dial: '226', flag: '🇧🇫' },
  { code: 'CI', name: "Côte d'Ivoire", dial: '225', flag: '🇨🇮' },
  { code: 'FR', name: 'France', dial: '33', flag: '🇫🇷' },
  { code: 'SN', name: 'Sénégal', dial: '221', flag: '🇸🇳' },
  { code: 'ML', name: 'Mali', dial: '223', flag: '🇲🇱' },
  { code: 'TG', name: 'Togo', dial: '228', flag: '🇹🇬' },
];

export function CountryPicker({
  value,
  onChange,
}: {
  value: Country;
  onChange: (c: Country) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Indicatif pays : ${value.name} +${value.dial}`}
      >
        <Text style={styles.flag}>{value.flag}</Text>
        <Text style={styles.dial}>+{value.dial}</Text>
        <Ionicons name="chevron-down" size={16} color={C.muted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Choisir un pays</Text>
            <FlatList
              data={COUNTRIES}
              keyExtractor={(c) => c.code}
              renderItem={({ item }) => {
                const active = item.code === value.code;
                return (
                  <TouchableOpacity
                    style={[styles.row, active && styles.rowActive]}
                    onPress={() => {
                      onChange(item);
                      setOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.rowFlag}>{item.flag}</Text>
                    <Text style={styles.rowName}>{item.name}</Text>
                    <Text style={styles.rowDial}>+{item.dial}</Text>
                    {active && (
                      <Ionicons name="checkmark-circle" size={20} color={C.primary} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  flag: { fontSize: 20 },
  dial: { fontFamily: F.bodyBold, fontSize: 16, color: C.text },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: C.line,
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: F.displayBold,
    fontSize: 18,
    color: C.text,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: R.field,
  },
  rowActive: { backgroundColor: C.pillBg },
  rowFlag: { fontSize: 24 },
  rowName: { flex: 1, fontFamily: F.bodySemi, fontSize: 15, color: C.text },
  rowDial: { fontFamily: F.bodyMedium, fontSize: 15, color: C.muted },
});
