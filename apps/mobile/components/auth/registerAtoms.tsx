import React, { ReactNode, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TextInputProps,
  Pressable,
  ViewStyle,
  StyleProp,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, RadialGradient, Stop, Rect } from 'react-native-svg';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/**
 * Atomes animés du flux d'inscription (modèle A « Hero animé »).
 * Palette crème + vert, polices embarquées (Bricolage = rôle Archivo/Space
 * Grotesk, monospace système = rôle Space Mono). Dégradé en react-native-svg
 * (pas de dépendance native). Toutes les animations respectent reduceMotion.
 */
export const RC = {
  bg: '#FBF8F0',
  surface: '#FFFFFF',
  ink: '#16140F',
  muted: '#938E80',
  hair: '#E8E2D6',
  gDark: '#15803D',
  gMid: '#16A34A',
  gBright: '#22C55E',
  tender: '#E7F6EC',
  lime: '#86EFAC',
  error: '#C0392B',
  gradFrom: '#0c3d20',
  gradMid: '#12642f',
  gradTo: '#16A34A',
} as const;

export const RF = {
  ui: 'Inter_400Regular',
  uiMed: 'Inter_500Medium',
  uiSemi: 'Inter_600SemiBold',
  uiBold: 'Inter_700Bold',
  display: 'BricolageGrotesque_800ExtraBold',
  num: 'BricolageGrotesque_700Bold',
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
} as const;

/** Entrée en cascade (translation + fondu, délai échelonné). */
export function Cascade({
  index = 0,
  reduceMotion,
  children,
  style,
}: {
  index?: number;
  reduceMotion?: boolean;
  children: ReactNode;
  style?: ViewStyle;
}) {
  if (reduceMotion) return <View style={style}>{children}</View>;
  return (
    <Animated.View entering={FadeInDown.duration(420).delay(80 + index * 120)} style={style}>
      {children}
    </Animated.View>
  );
}

/** Pressable avec léger enfoncement (scale .97) au press. */
export function PressScale({
  onPress,
  disabled,
  reduceMotion,
  style,
  children,
}: {
  onPress?: () => void;
  disabled?: boolean;
  reduceMotion?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => {
        if (!reduceMotion && !disabled) scale.value = withTiming(0.97, { duration: 90 });
      }}
      onPressOut={() => {
        if (!reduceMotion) scale.value = withTiming(1, { duration: 120 });
      }}
    >
      <Animated.View style={[style, aStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Hero dégradé vert : back · barre de progression animée · n/n · titre · sous-titre. */
export function RegHero({
  stepIndex,
  stepTotal,
  title,
  subtitle,
  onBack,
  reduceMotion,
}: {
  stepIndex: number;
  stepTotal: number;
  title: string;
  subtitle: string;
  onBack: () => void;
  reduceMotion?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const frac = Math.max(0, Math.min(1, stepIndex / stepTotal));
  const w = useSharedValue(frac);
  React.useEffect(() => {
    w.value = reduceMotion ? frac : withTiming(frac, { duration: 480 });
  }, [frac, reduceMotion]);
  const fillStyle = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));

  return (
    <View style={[heroStyles.hero, { paddingTop: insets.top + 8 }]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="regHood" x1="0" y1="0" x2="0.3" y2="1">
            <Stop offset="0" stopColor={RC.gradFrom} />
            <Stop offset="0.55" stopColor={RC.gradMid} />
            <Stop offset="1" stopColor={RC.gradTo} />
          </LinearGradient>
          <RadialGradient id="regHalo" cx="0.85" cy="0.1" r="0.6">
            <Stop offset="0" stopColor="#ffffff" stopOpacity="0.16" />
            <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#regHood)" />
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#regHalo)" />
      </Svg>

      <View style={heroStyles.topRow}>
        <Pressable onPress={onBack} style={heroStyles.back} hitSlop={8} accessibilityLabel="Retour">
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <View style={heroStyles.progressTrack}>
          <Animated.View style={[heroStyles.progressFill, fillStyle]} />
        </View>
        <Text style={heroStyles.stepNum}>
          {stepIndex}/{stepTotal}
        </Text>
      </View>

      <Text style={heroStyles.title} numberOfLines={2}>
        {title}
      </Text>
      <Text style={heroStyles.subtitle}>{subtitle}</Text>
    </View>
  );
}

/** Champ texte avec halo vert animé au focus. */
export function Field({
  label,
  required,
  hint,
  containerStyle,
  ...props
}: TextInputProps & {
  label?: string;
  required?: boolean;
  hint?: string;
  containerStyle?: ViewStyle;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={containerStyle}>
      {label ? (
        <Text style={fieldStyles.label}>
          {label}
          {required ? <Text style={{ color: RC.gDark }}> *</Text> : null}
        </Text>
      ) : null}
      <TextInput
        {...props}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
        placeholderTextColor={RC.muted}
        style={[fieldStyles.input, focused && fieldStyles.inputFocused, props.style]}
      />
      {hint ? <Text style={fieldStyles.hint}>{hint}</Text> : null}
    </View>
  );
}

const heroStyles = StyleSheet.create({
  hero: {
    backgroundColor: RC.gradFrom,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    paddingHorizontal: 22,
    paddingBottom: 22,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  back: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: RC.lime },
  stepNum: {
    fontFamily: RF.mono,
    fontWeight: '700',
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.5,
  },
  title: { color: '#fff', fontFamily: RF.display, fontSize: 26, lineHeight: 30 },
  subtitle: { color: 'rgba(255,255,255,0.75)', fontFamily: RF.ui, fontSize: 14, marginTop: 8, lineHeight: 19 },
});

const fieldStyles = StyleSheet.create({
  label: { color: RC.ink, fontFamily: RF.uiSemi, fontSize: 13.5, marginBottom: 7 },
  input: {
    backgroundColor: RC.surface,
    borderWidth: 1.5,
    borderColor: RC.hair,
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontFamily: RF.uiMed,
    fontSize: 15.5,
    color: RC.ink,
  },
  inputFocused: {
    borderColor: RC.gDark,
    shadowColor: RC.gMid,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  hint: { color: RC.muted, fontFamily: RF.ui, fontSize: 12, marginTop: 6 },
});

export { Animated, useAnimatedStyle, useSharedValue, withSpring, withTiming };
