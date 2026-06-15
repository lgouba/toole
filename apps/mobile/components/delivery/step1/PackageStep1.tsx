import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { recap as R, step1 as S } from '@/theme/recapTokens';
import { PackageCategory, PackageSize } from '@/types';
import { SizeStage } from './SizeStage';
import { CategoryGrid } from './CategoryGrid';
import { OptionalDetails } from './OptionalDetails';

interface Props {
  size: PackageSize;
  onSizeChange: (s: PackageSize) => void;
  category: PackageCategory | null | undefined;
  onCategoryChange: (c: PackageCategory) => void;
  description: string;
  onDescriptionChange: (t: string) => void;
  declaredValue: number | undefined;
  onDeclaredValueChange: (n: number | undefined) => void;
  fragile: boolean;
  onFragileChange: (b: boolean) => void;
}

/** Étape 1 (colis) refondue : scène taille + grille catégories + détails repliables. */
export function PackageStep1({
  size,
  onSizeChange,
  category,
  onCategoryChange,
  description,
  onDescriptionChange,
  declaredValue,
  onDeclaredValueChange,
  fragile,
  onFragileChange,
}: Props) {
  return (
    <View style={styles.wrap}>
      <SizeStage value={size} onChange={onSizeChange} />

      <View>
        <Text style={styles.title}>Que transportez-vous ?</Text>
        <Text style={styles.subtitle}>Choisissez la catégorie qui correspond le mieux.</Text>
      </View>

      <CategoryGrid value={category} onChange={onCategoryChange} />

      <OptionalDetails
        description={description}
        onDescriptionChange={onDescriptionChange}
        value={declaredValue}
        onValueChange={onDeclaredValueChange}
        fragile={fragile}
        onFragileChange={onFragileChange}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: R.space.sm, paddingTop: 2 },
  title: { fontFamily: R.font.display, fontSize: 18, color: S.textPrim },
  subtitle: { fontFamily: R.font.body, fontSize: 13, color: S.textMuted, marginTop: 2 },
});
