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
} from 'react-native-reanimated';
import { FONT } from './theme';
import { LiquidBackground } from './LiquidBackground';
import { GainCounter } from './GainCounter';
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
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

type Palier = 'confort' | 'compact' | 'serre';
function tokens(p: Palier) {
  switch (p) {
    case 'serre':
      return { gain: 70, addr: 15, tileVal: 14, cardH: 136, tileMode: 'line' as const };
    case 'compact':
      return { gain: 86, addr: 16, tileVal: 15.5, cardH: 146, tileMode: 'tiles' as const };
    default:
      return { gain: 104, addr: 17.5, tileVal: 17, cardH: 156, tileMode: 'tiles' as const };
  }
}

const REFUS_H = 46;
const CURSEUR_H = 64; // hauteur réelle de SlideToAccept

export function NewCourseModal({ course, durationSec = 120, onAccept, onRefuse, onTimeout }: Props) {
  const insets = useSafeAreaInsets();
  const { height: H, width: W, fontScale } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [secs, setSecs] = useState(durationSec);
  const [accepted, setAccepted] = useState(false);

  const progress = useSharedValue(0); // 0 = plein, 1 = expiré (INCHANGÉ)

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

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
    cancelAnimation(progress);
    onAccept();
  };

  // ---- Palier + géométrie (dérivée, ancrée sur le bas) ----
  let palier: Palier = H >= 800 ? 'confort' : H >= 640 ? 'compact' : 'serre';
  if (fontScale >= 1.4) palier = 'serre';
  const tk = tokens(palier);
  const gutter = W >= 400 ? 24 : 20;

  // --- Haut (ancré en haut) ---
  const enteteTop = insets.top + 16;
  // FRAGILE / valeur déclarée : info conservée (dont sécurité). Petits chips dans
  // la bande verte du haut ; le gain descend seulement quand ils sont présents.
  const hasFlags = course.isFragile || (course.declaredValue != null && course.declaredValue > 0);
  const gainTop = enteteTop + 40 + (hasFlags ? 28 : 0);
  const gainH = tk.gain * 0.9;
  const tilesTop = gainTop + gainH + 14;
  const tilesH = tk.tileMode === 'tiles' ? 58 : 34;
  const tilesBottom = tilesTop + tilesH;

  // --- Bas positionné DE HAUT EN BAS (écart vert fixe façon maquette) : évite
  // que la hauteur en trop des grands écrans se transforme en vide vert au
  // milieu. L'excédent part en crème SOUS « Refuser », pas au centre en vert.
  const GREEN_ZONE = 138; // zone de retrait du liquide (tuiles → carte)
  let cardTop = tilesBottom + GREEN_ZONE;
  let curseurTop = cardTop + tk.cardH + 32;
  let refusTop = curseurTop + CURSEUR_H + 12;
  // Petits écrans : si ça dépasse le bas sûr, on remonte le bloc bas d'un bloc.
  const bottomLimit = H - insets.bottom - 4 - REFUS_H;
  if (refusTop > bottomLimit) {
    const shift = refusTop - bottomLimit;
    cardTop -= shift;
    curseurTop -= shift;
    refusTop -= shift;
    if (cardTop < tilesBottom + 20) cardTop = tilesBottom + 20;
  }

  const plafond = cardTop;
  const plancher = Math.min(tilesBottom + 8, cardTop - 8);

  // Gain : largeur fixe pour que FCFA reste collé sur la ligne de base (nowrap).
  const gainStr = fmtCFA(course.gain);
  const digits = String(Math.round(course.gain)).length;
  const gainFont = Math.max(40, tk.gain - Math.max(0, digits - 4) * 8);
  const gainW = Math.ceil(gainStr.length * gainFont * 0.6);

  const livDotTop = tk.cardH - 46;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.root}>
          <LiquidBackground
            progress={progress}
            reduceMotion={reduceMotion}
            plancher={plancher}
            plafond={plafond}
            width={W}
          />

          {/* En-tête */}
          <View style={[styles.band, { top: enteteTop, paddingHorizontal: 26 }]}>
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

          {/* FRAGILE / valeur déclarée (conservés, zone verte lisible) */}
          {hasFlags ? (
            <View style={[styles.flags, { top: enteteTop + 22, left: 26 }]}>
              {course.isFragile ? (
                <View style={[styles.flag, styles.flagFragile]}>
                  <Ionicons name="warning" size={12} color="#3A1A00" />
                  <Text maxFontSizeMultiplier={1.4} style={styles.flagFragileText}>
                    FRAGILE
                  </Text>
                </View>
              ) : null}
              {course.declaredValue != null && course.declaredValue > 0 ? (
                <View style={[styles.flag, styles.flagValue]}>
                  <Text maxFontSizeMultiplier={1.4} style={styles.flagValueText}>
                    Valeur ~{fmtCFA(course.declaredValue)} FCFA
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Gain */}
          <View style={[styles.gainRow, { top: gainTop, left: 26 }]}>
            <GainCounter
              value={course.gain}
              reduceMotion={reduceMotion}
              style={{
                fontFamily: FONT.disp,
                color: '#FFFFFF',
                fontSize: gainFont,
                lineHeight: gainFont * 0.9,
                height: gainFont * 0.92,
                width: gainW,
                letterSpacing: -gainFont * 0.07,
                textAlign: 'right',
                padding: 0,
                includeFontPadding: false,
              }}
            />
            <Text maxFontSizeMultiplier={1.2} style={styles.fcfa}>
              FCFA
            </Text>
          </View>

          {/* Tuiles */}
          <View style={[styles.tiles, { top: tilesTop, left: gutter, right: gutter }]}>
            {tk.tileMode === 'tiles' ? (
              <>
                <Tile value={fmtKm(course.distanceKm)} label="DISTANCE" valSize={tk.tileVal} />
                <Tile value={course.colisLabel} label="COLIS" valSize={tk.tileVal} />
              </>
            ) : (
              <View style={styles.tileLineWrap}>
                <Text maxFontSizeMultiplier={1.4} style={styles.tileLine} numberOfLines={1}>
                  {fmtKm(course.distanceKm)} · {course.colisLabel}
                </Text>
              </View>
            )}
          </View>

          {/* Carte blanche — HAUTEUR FIXE, repères en absolu */}
          <View
            style={[
              styles.card,
              { left: gutter, right: gutter, top: cardTop, height: tk.cardH },
            ]}
          >
            {/* repères + trait (absolus → jamais désalignés) */}
            <View style={[styles.link, { height: livDotTop - 42 }]} />
            <View style={styles.pickupHalo}>
              <View style={styles.pickupDot} />
            </View>
            <View style={[styles.dropDot, { top: livDotTop }]} />

            <View style={styles.routeText}>
              <Text maxFontSizeMultiplier={1.8} style={styles.routeLabel}>
                RÉCUPÉRATION
              </Text>
              <Text
                maxFontSizeMultiplier={1.4}
                style={[styles.addr, { fontSize: tk.addr, lineHeight: tk.addr * 1.16 }]}
                numberOfLines={course.thirdPartyName ? 1 : 2}
                ellipsizeMode="tail"
              >
                {course.pickup}
              </Text>
              {course.thirdPartyName ? (
                <Text maxFontSizeMultiplier={1.4} style={styles.holder} numberOfLines={1}>
                  Colis chez {course.thirdPartyName}
                </Text>
              ) : null}
              <View style={{ height: 16 }} />
              <Text maxFontSizeMultiplier={1.8} style={styles.routeLabel}>
                LIVRAISON
              </Text>
              <Text
                maxFontSizeMultiplier={1.4}
                style={[styles.addr, { fontSize: tk.addr, lineHeight: tk.addr * 1.16 }]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {course.dropoff}
              </Text>
            </View>
          </View>

          {/* Curseur (bande propre, sous la carte, sans recouvrement) */}
          <View style={{ position: 'absolute', left: gutter, right: gutter, top: curseurTop }}>
            <SlideToAccept
              label={accepted ? 'Course acceptée' : 'Glissez pour accepter'}
              onAccept={handleAccept}
              reduceMotion={reduceMotion}
            />
          </View>

          {/* Refus (toujours sur le crème) */}
          <TouchableOpacity
            style={{ position: 'absolute', left: gutter, right: gutter, top: refusTop, height: REFUS_H, alignItems: 'center', justifyContent: 'center' }}
            onPress={onRefuse}
            disabled={accepted}
            accessibilityRole="button"
            accessibilityLabel="Refuser la course"
          >
            <Text maxFontSizeMultiplier={1.4} style={styles.refuseText}>
              Refuser la course
            </Text>
          </TouchableOpacity>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

function Tile({ value, label, valSize }: { value: string; label: string; valSize: number }) {
  return (
    <View style={styles.tile}>
      <Text maxFontSizeMultiplier={1.4} style={[styles.tileValue, { fontSize: valSize }]} numberOfLines={1}>
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
  kicker: { fontFamily: FONT.disp, fontSize: 11, letterSpacing: 2.4, color: 'rgba(255,255,255,0.82)' },
  timer: { fontFamily: MONO, fontWeight: '700', fontSize: 20, color: '#FFFFFF', letterSpacing: 1 },

  flags: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 8 },
  flag: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 4 },
  flagFragile: { backgroundColor: '#FFD54F' },
  flagFragileText: { fontFamily: FONT.bodyBold, fontSize: 11, letterSpacing: 0.8, color: '#3A1A00' },
  flagValue: { backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  flagValueText: { fontFamily: FONT.body, fontSize: 11.5, color: '#EAFBF0' },
  holder: { fontFamily: FONT.body, fontSize: 12, color: '#6B8C79', marginTop: 3 },

  gainRow: { position: 'absolute', flexDirection: 'row', alignItems: 'flex-end' },
  fcfa: { fontFamily: FONT.disp, fontSize: 25, color: 'rgba(255,255,255,0.78)', marginLeft: 11, marginBottom: 8, letterSpacing: -0.25 },

  tiles: { position: 'absolute', flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 13,
    paddingHorizontal: 15,
    backgroundColor: 'rgba(255,255,255,0.93)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: 'rgba(6,50,28,1)',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  tileValue: { fontFamily: FONT.disp, letterSpacing: -0.42, color: '#0B4A2A' },
  tileLabel: { fontFamily: FONT.disp, fontSize: 9, letterSpacing: 1.44, color: '#6B8C79', marginTop: 3 },
  tileLineWrap: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 11,
    paddingHorizontal: 15,
    backgroundColor: 'rgba(255,255,255,0.93)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  tileLine: { fontFamily: FONT.bodyBold, fontSize: 13, color: '#0B4A2A' },

  card: {
    position: 'absolute',
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    paddingTop: 24,
    paddingRight: 22,
    paddingBottom: 24,
    paddingLeft: 54,
    shadowColor: 'rgba(8,48,28,1)',
    shadowOpacity: 0.2,
    shadowRadius: 23,
    shadowOffset: { width: 0, height: 22 },
    elevation: 12,
  },
  link: { position: 'absolute', left: 29, top: 42, width: 2, backgroundColor: '#E5E0D2' },
  pickupHalo: {
    position: 'absolute',
    left: 17,
    top: 22,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,122,68,0.14)',
  },
  pickupDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#0E7A44' },
  dropDot: { position: 'absolute', left: 23, width: 14, height: 14, borderRadius: 4, backgroundColor: '#17241C' },
  routeText: { flex: 1, justifyContent: 'center' },
  routeLabel: { fontFamily: FONT.disp, fontSize: 9.5, letterSpacing: 1.7, color: '#9A9384', marginBottom: 4 },
  addr: { fontFamily: FONT.disp, letterSpacing: -0.44, color: '#17241C' },

  refuseText: { fontFamily: FONT.bodyBold, fontSize: 15, color: '#8A8477' },
});
