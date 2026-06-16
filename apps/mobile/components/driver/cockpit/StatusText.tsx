import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';
import { recap as R, driverHome as D } from '@/theme/recapTokens';

export function StatusText({ online }: { online: boolean }) {
  const blink = useSharedValue(0);
  useEffect(() => {
    if (online) blink.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [online, blink]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: 0.3 + blink.value * 0.7 }));

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>{online ? 'EN SERVICE' : 'TOOLÉ DRIVER'}</Text>
      <Text style={[styles.title, online && styles.titleOn]}>
        {online ? 'EN LIGNE' : 'HORS LIGNE'}
      </Text>
      <View style={styles.subRow}>
        {online && <Animated.View style={[styles.dot, dotStyle]} />}
        <Text style={styles.sub}>
          {online ? "À l'écoute des courses…" : 'Appuie pour démarrer ta journée'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 5, marginTop: R.space.gut },
  eyebrow: { fontFamily: R.font.mono, fontSize: 10, letterSpacing: 2, color: D.textMuted },
  title: {
    fontFamily: R.font.displayXBold,
    fontSize: 26,
    letterSpacing: 2,
    color: D.textPrim,
  },
  titleOn: { color: D.green },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: D.greenMid },
  sub: { fontFamily: R.font.body, fontSize: 13, color: D.textSec },
});
