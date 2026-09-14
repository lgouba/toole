import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  BackHandler,
  AccessibilityInfo,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedReaction,
  withTiming,
  cancelAnimation,
  runOnJS,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { FONT } from './theme';
import { LiquidBackground } from './LiquidBackground';
import { GainCounter } from './GainCounter';
import { RouteTimeline } from './RouteTimeline';
import { SlideToAccept } from './SlideToAccept';

export type Course = {
  gain: number;
  distanceKm?: number;
  colisLabel: string;
  pickup: string;
  dropoff: string;
  isFragile?: boolean;
  declaredValue?: number | null;
  thirdPartyName?: string | null;
};

type Props = {
  course: Course;
  durationSec?: number;
  onAccept: () => void;
  onRefuse: () => void;
  onTimeout: () => void;
};

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })!;

function fmtCFA(n: number) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
function fmtKm(km?: number) {
  if (km == null) return '—';
  return `${km.toFixed(1).replace('.', ',')} km`;
}
function mmss(total: number) {
  const s = Math.max(0, total);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

type Palier = 'confort' | 'compact' | 'serre';

/** Tokens de palier (le liquide/fond restent plein écran ; seuls 3 blocs bougent). */
function palierTokens(p: Palier) {
  switch (p) {
    case 'serre':
      return { gain: 76, floor: 220, cardTop: 248, cardBottom: 126, addr: 15.5, slider: 64, tileMode: 'line' as const };
    case 'compact':
      return { gain: 92, floor: 260, cardTop: 300, cardBottom: 138, addr: 16.5, slider: 72, tileMode: 'tiles' as const };
    default:
      return { gain: 114, floor: 300, cardTop: 352, cardBottom: 150, addr: 18, slider: 72, tileMode: 'tiles' as const };
  }
}

export function NewCourseModal({ course, durationSec = 120, onAccept, onRefuse, onTimeout }: Props) {
  const insets = useSafeAreaInsets();
  const { height, width, fontScale } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [secs, setSecs] = useState(durationSec);
  const [accepted, setAccepted] = useState(false);

  const progress = useSharedValue(0); // 0 = plein, 1 = expiré (INCHANGÉ)

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  // Compte à rebours — LINÉAIRE sur la durée, callback timeout INCHANGÉ.
  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(
      1,
      { duration: durationSec * 1000, easing: Easing.linear },
      (finished) => {
        if (finished) runOnJS(onTimeout)();
      },
    );
    return () => cancelAnimation(progress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Secondes affichées : dérivées de progress, maj 1×/s (texte, pas animation).
  useAnimatedReaction(
    () => Math.ceil((1 - progress.value) * durationSec),
    (cur, prev) => {
      if (cur !== prev) runOnJS(setSecs)(cur);
    },
  );

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const handleAccept = () => {
    setAccepted(true);
    cancelAnimation(progress); // fige le niveau
    onAccept();
  };

  // Palier (bascule serré d'office au-delà de fontScale 1.4).
  let palier: Palier = height >= 800 ? 'confort' : height >= 640 ? 'compact' : 'serre';
  if (fontScale >= 1.4) palier = 'serre';
  const tk = palierTokens(palier);
  const gutter = width >= 400 ? 24 : 20;
  const bandTop = Math.max(insets.top + 6, 24);

  const hasFlags = course.isFragile || (course.declaredValue != null && course.declaredValue > 0);

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      {/* Android : le contenu d'un <Modal> RN est une fenêtre native séparée, non
          couverte par le GestureHandlerRootView racine → on ré-enveloppe ici,
          sinon le geste "Glissez pour accepter" ne reçoit aucune touche. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.root}>
          {/* Fond : liquide vert qui se retire, piloté par progress */}
          <LiquidBackground
            progress={progress}
            reduceMotion={reduceMotion}
            floor={tk.floor}
            height={height}
            width={width}
          />

          {/* Bandeau haut : NOUVELLE COURSE + mm:ss */}
          <View style={[styles.band, { top: bandTop, paddingHorizontal: gutter }]}>
            <Text maxFontSizeMultiplier={1.8} style={styles.kicker}>
              NOUVELLE COURSE
            </Text>
            <Text
              maxFontSizeMultiplier={1.2}
              style={styles.timer}
              accessibilityLabel={`${secs} secondes restantes`}
            >
              {mmss(secs)}
            </Text>
          </View>

          {/* Gain + tuiles */}
          <View style={[styles.top, { top: bandTop + 40, paddingHorizontal: gutter }]}>
            <View style={styles.gainRow}>
              <GainCounter
                value={course.gain}
                reduceMotion={reduceMotion}
                style={[styles.gain, { fontSize: tk.gain, height: tk.gain * 0.96, lineHeight: tk.gain * 0.88 }]}
              />
              <Text maxFontSizeMultiplier={1.2} style={styles.fcfa}>
                FCFA
              </Text>
            </View>

            {tk.tileMode === 'tiles' ? (
              <View style={styles.tiles}>
                <Tile value={fmtKm(course.distanceKm)} label="DISTANCE" />
                <Tile value={course.colisLabel} label="COLIS" />
              </View>
            ) : (
              <Text maxFontSizeMultiplier={1.5} style={styles.tileLine}>
                {fmtKm(course.distanceKm)} · {course.colisLabel}
              </Text>
            )}

            {/* Badges FRAGILE / valeur déclarée — conservés (donnée métier) */}
            {hasFlags ? (
              <View style={styles.flags}>
                {course.isFragile ? (
                  <View style={[styles.flag, styles.flagFragile]}>
                    <Ionicons name="warning" size={13} color="#3A1A00" />
                    <Text maxFontSizeMultiplier={1.5} style={styles.flagFragileText}>
                      FRAGILE
                    </Text>
                  </View>
                ) : null}
                {course.declaredValue != null && course.declaredValue > 0 ? (
                  <View style={[styles.flag, styles.flagValue]}>
                    <Ionicons name="pricetag" size={12} color="#0B4A2A" />
                    <Text maxFontSizeMultiplier={1.5} style={styles.flagValueText}>
                      Valeur ~{fmtCFA(course.declaredValue)} FCFA
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* Carte blanche (position FIXE, ne bouge pas pendant que le liquide descend) */}
          <Animated.View
            entering={FadeIn.duration(400).delay(120)}
            style={[
              styles.card,
              { left: gutter, right: gutter, top: tk.cardTop, bottom: tk.cardBottom },
            ]}
          >
            {course.thirdPartyName ? (
              <View style={styles.thirdParty}>
                <View style={styles.holderDot}>
                  <Ionicons name="person" size={16} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text maxFontSizeMultiplier={1.8} style={styles.holderKicker}>
                    COLIS CHEZ
                  </Text>
                  <Text maxFontSizeMultiplier={1.5} style={styles.holderName} numberOfLines={1}>
                    {course.thirdPartyName}
                  </Text>
                </View>
              </View>
            ) : null}
            <View style={styles.routeWrap}>
              <RouteTimeline pickup={course.pickup} dropoff={course.dropoff} addrSize={tk.addr} />
            </View>
          </Animated.View>

          {/* Glisser pour accepter (logique inchangée) + Refuser */}
          <View style={[styles.footer, { left: gutter, right: gutter, bottom: Math.max(insets.bottom, 0) + 34 }]}>
            <SlideToAccept
              label={accepted ? 'Course acceptée' : 'Glissez pour accepter'}
              onAccept={handleAccept}
              reduceMotion={reduceMotion}
            />
            <TouchableOpacity
              style={styles.refuse}
              onPress={onRefuse}
              disabled={accepted}
              accessibilityRole="button"
              accessibilityLabel="Refuser la course"
            >
              <Text maxFontSizeMultiplier={1.5} style={styles.refuseText}>
                Refuser la course
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function Tile({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.tile}>
      <Text maxFontSizeMultiplier={1.5} style={styles.tileValue} numberOfLines={1}>
        {value}
      </Text>
      <Text maxFontSizeMultiplier={1.8} style={styles.tileLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3EFE3' },

  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: { fontFamily: FONT.disp, fontSize: 11, letterSpacing: 2.4, color: 'rgba(255,255,255,0.8)' },
  timer: { fontFamily: MONO, fontWeight: '700', fontSize: 20, color: '#FFFFFF', letterSpacing: 1 },

  top: { position: 'absolute', left: 0, right: 0 },
  gainRow: { flexDirection: 'row', alignItems: 'flex-end' },
  gain: {
    fontFamily: FONT.disp,
    color: '#FFFFFF',
    letterSpacing: -6,
    textAlign: 'left',
  },
  fcfa: { fontFamily: FONT.disp, fontSize: 24, color: 'rgba(255,255,255,0.75)', marginLeft: 8, marginBottom: 12 },

  tiles: { flexDirection: 'row', gap: 8, marginTop: 16 },
  tile: {
    flex: 1,
    borderRadius: 17,
    paddingVertical: 12,
    paddingHorizontal: 13,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  tileValue: { fontFamily: FONT.disp, fontSize: 16.5, letterSpacing: -0.4, color: '#0B4A2A' },
  tileLabel: { fontFamily: FONT.disp, fontSize: 9, letterSpacing: 1.35, color: '#6B8C79', marginTop: 3 },
  tileLine: { fontFamily: FONT.bodyBold, fontSize: 13, color: '#0B4A2A', marginTop: 12 },

  flags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  flag: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  flagFragile: { backgroundColor: '#FFD54F' },
  flagFragileText: { fontFamily: FONT.bodyBold, fontSize: 11.5, letterSpacing: 1, color: '#3A1A00' },
  flagValue: { backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  flagValueText: { fontFamily: FONT.body, fontSize: 12.5, color: '#0B4A2A' },

  card: {
    position: 'absolute',
    borderRadius: 28,
    padding: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#0A321E',
    shadowOpacity: 0.22,
    shadowRadius: 27,
    shadowOffset: { width: 0, height: 26 },
    elevation: 12,
  },
  thirdParty: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  holderDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0E7A44',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  holderKicker: { fontFamily: FONT.disp, fontSize: 9.5, letterSpacing: 1.7, color: '#9A9384' },
  holderName: { fontFamily: FONT.disp, fontSize: 15.5, color: '#17241C', marginTop: 2 },
  routeWrap: { flex: 1, justifyContent: 'center' },

  footer: { position: 'absolute' },
  refuse: { alignItems: 'center', paddingVertical: 12, marginTop: 13 },
  refuseText: { fontFamily: FONT.bodyBold, fontSize: 14.5, color: '#8A8477' },
});
