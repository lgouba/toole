import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { recap as R, step1 as S } from '@/theme/recapTokens';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  description: string;
  onDescriptionChange: (t: string) => void;
  value: number | undefined;
  onValueChange: (n: number | undefined) => void;
  fragile: boolean;
  onFragileChange: (b: boolean) => void;
}

/** Bloc "Détails du colis · optionnel" repliable (fermé par défaut). */
export function OptionalDetails({
  description,
  onDescriptionChange,
  value,
  onValueChange,
  fragile,
  onFragileChange,
}: Props) {
  const [open, setOpen] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.header}
        onPress={toggle}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <MaterialIcons name="edit-note" size={22} color={S.green} />
        <Text style={styles.headerTitle}>Détails du colis</Text>
        <Text style={styles.headerOpt}> · optionnel</Text>
        <View style={{ flex: 1 }} />
        <MaterialIcons
          name={open ? 'expand-less' : 'expand-more'}
          size={24}
          color={S.textMuted}
        />
      </TouchableOpacity>

      {open && (
        <View style={styles.body}>
          {/* Description */}
          <Text style={styles.fieldLabel}>DESCRIPTION</Text>
          <TextInput
            value={description}
            onChangeText={onDescriptionChange}
            placeholder="Ex : téléphone portable"
            placeholderTextColor={S.textMuted}
            style={styles.input}
          />

          {/* Valeur estimée */}
          <Text style={[styles.fieldLabel, { marginTop: R.space.lg }]}>
            VALEUR ESTIMÉE (OPTIONNEL)
          </Text>
          <View style={styles.valueRow}>
            <TextInput
              value={value ? String(value) : ''}
              onChangeText={(v) => {
                const n = parseInt(v.replace(/\D/g, ''), 10);
                onValueChange(isNaN(n) ? undefined : n);
              }}
              placeholder="Ex : 25 000"
              placeholderTextColor={S.textMuted}
              keyboardType="numeric"
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
            />
            <Text style={styles.suffix}>FCFA</Text>
          </View>
          <Text style={styles.helper}>
            Aide le livreur à prendre soin du colis. Aucun paiement supplémentaire.
          </Text>

          {/* Fragile */}
          <View style={[styles.fragileCard, fragile && styles.fragileCardOn]}>
            <View style={[styles.fragileIcon, fragile && styles.fragileIconOn]}>
              <MaterialIcons
                name="warning"
                size={18}
                color={fragile ? '#FFFFFF' : '#D97706'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fragileTitle}>Colis fragile</Text>
              <Text style={styles.fragileSub}>
                Manipulation délicate — le livreur en sera averti.
              </Text>
            </View>
            <Switch
              value={fragile}
              onValueChange={onFragileChange}
              trackColor={{ false: S.border, true: S.green }}
              thumbColor="#FFFFFF"
              accessibilityRole="switch"
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: S.surface,
    borderRadius: S.radius.card,
    borderWidth: 1,
    borderColor: S.border,
    paddingHorizontal: R.space.gut,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: R.space.sm, paddingVertical: R.space.md },
  headerTitle: { fontFamily: R.font.bodyBold, fontSize: 14.5, color: S.textPrim },
  headerOpt: { fontFamily: R.font.body, fontSize: 13, color: S.textMuted },
  body: { paddingBottom: R.space.gut },
  fieldLabel: {
    fontFamily: R.font.mono,
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: S.textMuted,
    marginBottom: R.space.xs,
  },
  input: {
    height: 46,
    borderRadius: S.radius.field,
    borderWidth: 1,
    borderColor: S.border,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: R.space.lg,
    fontFamily: R.font.body,
    fontSize: 14.5,
    color: S.textPrim,
  },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: R.space.md },
  suffix: { fontFamily: R.font.mono, fontSize: 13, color: S.textSec },
  helper: { fontFamily: R.font.body, fontSize: 12, color: S.textMuted, marginTop: R.space.sm },
  fragileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: R.space.md,
    marginTop: R.space.lg,
    padding: R.space.lg,
    borderRadius: S.radius.field,
    borderWidth: 1,
    borderColor: S.border,
    backgroundColor: '#FFFDF8',
  },
  fragileCardOn: { borderColor: S.green, backgroundColor: '#F1F8F3' },
  fragileIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fragileIconOn: { backgroundColor: S.green },
  fragileTitle: { fontFamily: R.font.bodyBold, fontSize: 14, color: S.textPrim },
  fragileSub: { fontFamily: R.font.body, fontSize: 12, color: S.textSec, marginTop: 1 },
});
