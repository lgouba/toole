import React, { useRef, useState, useEffect } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
  AccessibilityInfo,
} from 'react-native';
import { recap as R } from '@/theme/recapTokens';

export const ITEM_H = 40;
const VISIBLE = 5; // nombre d'items visibles (impair → un centré)
const PAD = Math.floor(VISIBLE / 2);

interface Props {
  data: string[];
  index: number;
  onChange: (index: number) => void;
  width?: number;
  /** label accessibilité de la colonne (ex: "Heure"). */
  a11yLabel?: string;
}

/**
 * Colonne de molette : ScrollView vertical à snap (pur JS, identique iOS/Android).
 * L'item centré dans la bande médiane est "sélectionné". Pas de module natif.
 */
export function WheelColumn({ data, index, onChange, width, a11yLabel }: Props) {
  const ref = useRef<ScrollView>(null);
  const [center, setCenter] = useState(index);
  const reduceMotion = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => (reduceMotion.current = v));
  }, []);

  // Positionne au bon index au montage / quand l'index externe change.
  useEffect(() => {
    setCenter(index);
    const t = setTimeout(() => {
      ref.current?.scrollTo({ y: index * ITEM_H, animated: false });
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, data.length]);

  const clamp = (i: number) => Math.max(0, Math.min(data.length - 1, i));

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = clamp(Math.round(e.nativeEvent.contentOffset.y / ITEM_H));
    if (i !== center) setCenter(i);
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = clamp(Math.round(e.nativeEvent.contentOffset.y / ITEM_H));
    // recale pile sur l'item
    ref.current?.scrollTo({ y: i * ITEM_H, animated: !reduceMotion.current });
    setCenter(i);
    if (i !== index) onChange(i);
  };

  return (
    <View style={[styles.col, width ? { width } : { flex: 1 }]} accessibilityLabel={a11yLabel}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScroll={onScroll}
        onMomentumScrollEnd={onMomentumEnd}
        contentContainerStyle={{ paddingVertical: PAD * ITEM_H }}
      >
        {data.map((d, i) => {
          const selected = i === center;
          return (
            <View key={i} style={styles.item}>
              <Text style={[styles.itemText, selected && styles.itemTextSel]} numberOfLines={1}>
                {d}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  col: { height: ITEM_H * VISIBLE },
  item: { height: ITEM_H, alignItems: 'center', justifyContent: 'center' },
  itemText: { fontFamily: R.font.mono, fontSize: 18, color: R.color.textMuted },
  itemTextSel: { color: R.color.green, fontSize: 22, fontFamily: R.font.mono },
});
