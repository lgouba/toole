import React, { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, AccessibilityInfo } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { useHideAnimation } from 'react-native-bootsplash';
import manifest from '@/assets/bootsplash/manifest.json';

/**
 * Raccord JS du splash ANDROID (react-native-bootsplash).
 *
 * Android 12+ dessine un premier frame système = fond `#176842` + logo centré
 * (thème BootTheme, cf. plugins/withAndroidBootSplash.js). `useHideAnimation`
 * nous rend les styles EXACTS de ce logo (position/taille) : on monte une vue
 * identique au pixel près par-dessus, puis on la fait transiter vers le hero
 * plein écran — aucune rupture visible, pas de frame de vert nu.
 *
 * Ce composant n'est monté que sur Android (gate dans app/_layout.tsx). iOS
 * garde son splash natif « hero » et ne monte jamais ce composant.
 *
 * USE_MORPH : false = fondu croisé logo -> hero (sûr, choisi par défaut car non
 * vérifiable sur device ici). true = « zoom » du logo vers la position de la
 * moto dans le hero (repères mesurés sur le rendu iOS). Bascule si le morph rend
 * bien sur device.
 */
const HERO = require('@/assets/toole-hero.png');
const LOGO = require('@/assets/bootsplash/logo.png');
const USE_MORPH = false;

export function AndroidBootSplash({
  ready,
  onDone,
}: {
  ready: boolean;
  onDone: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const [visible, setVisible] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
  }, []);

  const rootOpacity = useSharedValue(1);
  const heroOpacity = useSharedValue(0);
  const logoOpacity = useSharedValue(1);
  const logoScale = useSharedValue(1);
  const logoTranslateY = useSharedValue(0);

  const finish = () => {
    setVisible(false);
    onDone();
  };

  const { container, logo } = useHideAnimation({
    manifest,
    logo: LOGO,
    ready,
    statusBarTranslucent: true,
    navigationBarTranslucent: true,
    animate: () => {
      // Reduced motion : pas d'animation, hero direct, court hold, puis app.
      if (reduceMotion) {
        heroOpacity.value = 1;
        logoOpacity.value = 0;
        rootOpacity.value = withDelay(
          400,
          withTiming(0, { duration: 1 }, (f) => {
            'worklet';
            if (f) runOnJS(finish)();
          }),
        );
        return;
      }

      if (USE_MORPH) {
        // Repères du hero (fraction d'écran), mesurés sur iOS.
        const targetScale = (0.892 * width) / manifest.logo.width;
        const targetTranslateY = (0.316 - 0.5) * height;
        const ease = Easing.out(Easing.cubic);
        logoScale.value = withTiming(targetScale, { duration: 300, easing: ease });
        logoTranslateY.value = withTiming(targetTranslateY, { duration: 300, easing: ease });
        heroOpacity.value = withDelay(120, withTiming(1, { duration: 250 }));
        logoOpacity.value = withDelay(290, withTiming(0, { duration: 80 }));
        rootOpacity.value = withDelay(
          520,
          withTiming(0, { duration: 220 }, (f) => {
            'worklet';
            if (f) runOnJS(finish)();
          }),
        );
        return;
      }

      // Fondu croisé (défaut) : logo -> hero, aucun frame de vert nu.
      heroOpacity.value = withTiming(1, { duration: 250 });
      logoOpacity.value = withTiming(0, { duration: 250 });
      rootOpacity.value = withDelay(
        480,
        withTiming(0, { duration: 220 }, (f) => {
          'worklet';
          if (f) runOnJS(finish)();
        }),
      );
    },
  });

  const rootStyle = useAnimatedStyle(() => ({ opacity: rootOpacity.value }));
  const heroStyle = useAnimatedStyle(() => ({ opacity: heroOpacity.value }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ translateY: logoTranslateY.value }, { scale: logoScale.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View onLayout={container.onLayout} style={[container.style, rootStyle]}>
      {/* Hero plein écran (sous le logo), fondu 0 -> 1 */}
      <Animated.Image
        source={HERO}
        resizeMode="cover"
        style={[StyleSheet.absoluteFill, { width, height }, heroStyle]}
      />
      {/* Logo positionné EXACTEMENT comme le natif, animé par-dessus */}
      <Animated.Image
        source={logo.source}
        fadeDuration={0}
        onLoadEnd={logo.onLoadEnd}
        resizeMode={logo.resizeMode}
        style={[logo.style, logoStyle]}
      />
    </Animated.View>
  );
}
