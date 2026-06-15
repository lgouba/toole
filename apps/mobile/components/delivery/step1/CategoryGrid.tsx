import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { recap as R, step1 as S } from '@/theme/recapTokens';
import { PackageCategory } from '@/types';
import { CATEGORIES } from './categories';

interface Props {
  value: PackageCategory | null | undefined;
  onChange: (c: PackageCategory) => void;
}

/** Grille 4 colonnes : tuile colorée + emoji (ancien design) + label court. */
export function CategoryGrid({ value, onChange }: Props) {
  return (
    <View style={styles.grid}>
      {CATEGORIES.map((cat) => {
        const selected = value === cat.key;
        return (
          <TouchableOpacity
            key={cat.key}
            style={styles.cell}
            onPress={() => onChange(cat.key)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={cat.canonical}
          >
            <View
              style={[
                styles.tile,
                { backgroundColor: cat.bg },
                selected && styles.tileSelected,
              ]}
            >
              <Text style={styles.emoji}>{cat.emoji}</Text>
              {selected && (
                <View style={styles.checkBadge}>
                  <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                </View>
              )}
            </View>
            <Text
              style={[styles.label, selected && styles.labelSelected]}
              numberOfLines={1}
            >
              {cat.short}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: R.space.sm,
  },
  cell: { width: '23%', alignItems: 'center', gap: 4 },
  tile: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: S.radius.tile,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: 'transparent',
    shadowColor: '#503C0A',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  tileSelected: { borderColor: S.green },
  emoji: { fontSize: 26 },
  checkBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: S.green,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  label: { fontFamily: R.font.body, fontSize: 12, color: S.textSec },
  labelSelected: { fontFamily: R.font.bodyBold, color: S.green },
});
