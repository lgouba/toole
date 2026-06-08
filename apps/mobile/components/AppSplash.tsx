import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

/**
 * Splash plein écran géré en JS.
 *
 * Pourquoi : sur Android 12+, l'écran de lancement NATIF ne sait pas afficher
 * une image plein écran (resizeMode "cover" ignoré) — il force un petit logo
 * centré. Pour avoir le MÊME splash full-bleed sur iOS ET Android, on monte ce
 * composant par-dessus l'app au démarrage : il affiche l'artwork en cover, puis
 * se fond (fade) une fois l'app prête.
 */
const SPLASH = require('@/assets/images/toole-splash.png');

export function AppSplash({
  hide,
  onHidden,
}: {
  hide: boolean;
  onHidden: () => void;
}) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (hide) {
      opacity.value = withTiming(
        0,
        { duration: 450, easing: Easing.out(Easing.ease) },
        (finished) => {
          if (finished) runOnJS(onHidden)();
        },
      );
    }
  }, [hide]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.container, style]}>
      <Image source={SPLASH} style={StyleSheet.absoluteFill} resizeMode="cover" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0E3B26',
    zIndex: 9999,
  },
});
