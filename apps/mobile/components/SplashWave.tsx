import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  ClipPath,
  LinearGradient,
  Stop,
  Rect,
  G,
  Path,
  Text as SvgText,
} from 'react-native-svg';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedText = Animated.createAnimatedComponent(SvgText);

// ── Design tokens (repère de référence 390 × 844) ───────────────────────────
const GREEN = '#105133'; // = windowSplashScreenBackground (raccord invisible)
const CREAM_TOP = '#FFFDF6';
const CREAM_BOT = '#F6EEDA';
const WORD_ON_GREEN = '#FFFCF3';
const WORD_ON_CREAM = '#0B5B33';
const BASE_ON_GREEN = '#A6EFC7';
const BASE_ON_CREAM = '#3E8A61';

const WORD = 'Toolé';
const BASELINE = 'LIVRAISON PARTOUT';
const FONT_WORD = 'PlusJakartaSans_800ExtraBold';
const FONT_BASE = 'PlusJakartaSans_600SemiBold';

// Chronologie (ms) — une seule horloge `progress` (linéaire) pilote tout ;
// chaque phase applique sa propre courbe dans son worklet (source de temps
// unique -> pas de dérive). Cf. prompt §3.
const T_TOTAL = 2400;
const WAVE_START = 340;
const WAVE_END = 1720;
const BASE_START = 1180;
const BASE_END = 1700;
const FADE_START = 2100;
const FADE_END = 2400;
const FAILSAFE_MS = 4000;

// Easing de la vague (une seule source de vérité sur la courbe).
// Easing.bezier renvoie une factory -> .factory() donne la fonction (worklet).
const WAVE_EASING = Easing.bezier(0.65, 0, 0.35, 1).factory();
const FADE_EASING = Easing.out(Easing.cubic);

interface Props {
  onDone: () => void;
}

/**
 * Écran d'ouverture « La vague » (Android + iOS). Une vague crème monte du bas ;
 * en la traversant, « Toolé » s'inverse (crème sur vert / vert sur crème). À la
 * fin l'écran est crème, puis fondu de sortie et démontage.
 *
 * NE dépend d'AUCUN chargement (polices/API/stockage) : il joue, finit, se démonte.
 * La police du mot se rabat sur la police système si ExtraBold n'est pas encore
 * chargée — la séquence joue quand même.
 */
export function SplashWave({ onDone }: Props) {
  const progress = useSharedValue(0);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  useEffect(() => {
    // Le splash natif et cette vue sont du même vert : on masque SANS fondu
    // (un fondu ne ferait qu'ajouter un scintillement). Sans condition, sans
    // détection de module natif (cf. prompt §1/§5).
    SplashScreen.hideAsync().catch(() => {});

    progress.value = withTiming(
      T_TOTAL,
      { duration: T_TOTAL, easing: Easing.linear },
      (fin) => {
        'worklet';
        if (fin) runOnJS(finish)();
      },
    );

    // Filet de sécurité : un écran de démarrage qui ne se lève jamais est pire
    // qu'un écran qui se lève trop tôt.
    const failsafe = setTimeout(finish, FAILSAFE_MS);
    return () => clearTimeout(failsafe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Vague : crête translatée verticalement de 910 (hors écran bas) à -40 (hors
  // écran haut). Le `d` est reconstruit à chaque frame dans le worklet.
  const wavePathProps = useAnimatedProps(() => {
    'worklet';
    const raw = interpolate(
      progress.value,
      [WAVE_START, WAVE_END],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const e = WAVE_EASING(raw);
    const y = 910 + (-40 - 910) * e;
    return {
      d: `M0 ${y} C 60 ${y - 26}, 135 ${y + 26}, 195 ${y} C 255 ${y - 26}, 330 ${y + 26}, 390 ${y} L390 ${y + 1000} L0 ${y + 1000} Z`,
    };
  });

  // Baselines : apparition 1180 → 1700 (linéaire).
  const baselineProps = useAnimatedProps(() => {
    'worklet';
    const opacity = interpolate(
      progress.value,
      [BASE_START, BASE_END],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  // Fondu de sortie global 2100 → 2400.
  const containerStyle = useAnimatedStyle(() => {
    const raw = interpolate(
      progress.value,
      [FADE_START, FADE_END],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { opacity: 1 - FADE_EASING(raw) };
  });

  return (
    <Animated.View
      style={[styles.fill, styles.bg, containerStyle]}
      pointerEvents="none"
    >
      <Svg
        viewBox="0 0 390 844"
        preserveAspectRatio="xMidYMid slice"
        style={StyleSheet.absoluteFill}
      >
        <Defs>
          <ClipPath id="wv">
            <AnimatedPath animatedProps={wavePathProps} />
          </ClipPath>
          <LinearGradient id="cream" x1="0" y1="0" x2="0.4" y2="1">
            <Stop offset="0" stopColor={CREAM_TOP} />
            <Stop offset="1" stopColor={CREAM_BOT} />
          </LinearGradient>
        </Defs>

        {/* Couche du dessous : vert + mot crème */}
        <Rect x="0" y="0" width="390" height="844" fill={GREEN} />
        <SvgText
          x="195"
          y="424"
          fill={WORD_ON_GREEN}
          fontSize="76"
          fontFamily={FONT_WORD}
          fontWeight="800"
          letterSpacing="-2.7"
          textAnchor="middle"
        >
          {WORD}
        </SvgText>
        <AnimatedText
          x="195"
          y="500"
          fill={BASE_ON_GREEN}
          fontSize="14"
          fontFamily={FONT_BASE}
          fontWeight="600"
          letterSpacing="2.8"
          textAnchor="middle"
          animatedProps={baselineProps}
        >
          {BASELINE}
        </AnimatedText>

        {/* Couche du dessus, découpée par la vague : crème + mot vert */}
        <G clipPath="url(#wv)">
          <Rect x="0" y="0" width="390" height="844" fill="url(#cream)" />
          <SvgText
            x="195"
            y="424"
            fill={WORD_ON_CREAM}
            fontSize="76"
            fontFamily={FONT_WORD}
            fontWeight="800"
            letterSpacing="-2.7"
            textAnchor="middle"
          >
            {WORD}
          </SvgText>
          <AnimatedText
            x="195"
            y="500"
            fill={BASE_ON_CREAM}
            fontSize="14"
            fontFamily={FONT_BASE}
            fontWeight="600"
            letterSpacing="2.8"
            textAnchor="middle"
            animatedProps={baselineProps}
          >
            {BASELINE}
          </AnimatedText>
        </G>
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject, zIndex: 9999 },
  // Le fond de la vue compte : si le SVG met une frame à se peindre, on voit
  // du vert, pas du blanc.
  bg: { backgroundColor: GREEN },
});
