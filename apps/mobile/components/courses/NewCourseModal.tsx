import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  BackHandler,
  AccessibilityInfo,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  withRepeat,
  cancelAnimation,
  runOnJS,
  interpolate,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import { T, FONT, RAD } from './theme';
import { MissionBackground } from './MissionBackground';
import { PerimeterCountdown } from './PerimeterCountdown';
import { RadarPulse } from './RadarPulse';
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

function fmtCFA(n: number) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
function fmtKm(km?: number) {
  if (km == null) return '—';
  return `${km.toFixed(1).replace('.', ',')} km`;
}

export function NewCourseModal({
  course,
  durationSec = 120,
  onAccept,
  onRefuse,
  onTimeout,
}: Props) {
  const insets = useSafeAreaInsets();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [secs, setSecs] = useState(durationSec);
  const [accepted, setAccepted] = useState(false);

  const progress = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  // Compte à rebours (périmètre + pastille). Linéaire sur la durée.
  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(
      1,
      { duration: durationSec * 1000, easing: Easing.linear },
      (finished) => {
        if (finished) runOnJS(onTimeout)();
      },
    );
    if (!reduceMotion) {
      pulse.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }), -1, false);
    }
    return () => cancelAnimation(progress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  // Pastille secondes : dérivée de progress, mise à jour 1×/seconde.
  useAnimatedReaction(
    () => Math.ceil((1 - progress.value) * durationSec),
    (cur, prev) => {
      if (cur !== prev) runOnJS(setSecs)(cur);
    },
  );

  // Bloque le retour Android tant que la demande est active.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  const handleAccept = () => {
    setAccepted(true);
    cancelAnimation(progress); // fige le compte à rebours
    onAccept();
  };

  const pulseRing = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.6, 1.8]) }],
    opacity: interpolate(pulse.value, [0, 1], [0.9, 0]),
  }));

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={styles.root}>
        <MissionBackground reduceMotion={reduceMotion} />
        <PerimeterCountdown progress={progress} />

        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: Math.max(insets.top, 14) + 6, paddingBottom: Math.max(insets.bottom, 0) + 40 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* En-tête */}
          <Animated.View entering={FadeIn.duration(350)} style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.dotWrap}>
                {!reduceMotion && <Animated.View style={[styles.pulseRing, pulseRing]} />}
                <View style={styles.dot} />
              </View>
              <Text style={styles.kicker}>NOUVELLE COURSE</Text>
            </View>
            <View
              style={styles.secsPill}
              accessibilityLabel={`${secs} secondes restantes`}
            >
              <Text style={styles.secsNum}>{secs}</Text>
              <Text style={styles.secsUnit}>s</Text>
            </View>
          </Animated.View>

          {/* Hero gain */}
          <View style={styles.hero}>
            <RadarPulse reduceMotion={reduceMotion} />
            <Text style={styles.gainLabel}>GAIN</Text>
            <View style={styles.gainRow}>
              <GainCounter value={course.gain} style={styles.gainValue} reduceMotion={reduceMotion} />
              <Text style={styles.fcfa}>FCFA</Text>
            </View>
          </View>

          {/* Carte verre */}
          <Animated.View entering={FadeIn.duration(400).delay(120)} style={styles.card}>
            {/* Chips distance / colis */}
            <View style={styles.chips}>
              <Chip icon="navigate-outline" value={fmtKm(course.distanceKm)} label="DISTANCE" />
              <Chip icon="cube-outline" value={course.colisLabel} label="COLIS" />
            </View>

            {/* Zone PRIX (valeur déclarée) + FRAGILE — affichée si l'un est défini */}
            {(course.isFragile || (course.declaredValue && course.declaredValue > 0)) && (
              <View style={styles.flags}>
                {course.isFragile && (
                  <View style={[styles.flag, styles.flagFragile]}>
                    <Ionicons name="warning" size={15} color="#3A1A00" />
                    <Text style={styles.flagFragileText}>FRAGILE</Text>
                  </View>
                )}
                {course.declaredValue && course.declaredValue > 0 ? (
                  <View style={[styles.flag, styles.flagValue]}>
                    <Ionicons name="pricetag" size={14} color={T.mint} />
                    <Text style={styles.flagValueText}>
                      Valeur ~{fmtCFA(course.declaredValue)} FCFA
                    </Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* Colis chez un tiers */}
            {course.thirdPartyName ? (
              <View style={styles.thirdParty}>
                <Ionicons name="person" size={14} color={T.mint} />
                <Text style={styles.thirdPartyText}>
                  Colis chez <Text style={styles.thirdPartyName}>{course.thirdPartyName}</Text>
                </Text>
              </View>
            ) : null}

            {/* Trajet */}
            <RouteTimeline pickup={course.pickup} dropoff={course.dropoff} />
          </Animated.View>

          {/* Glisser pour accepter */}
          <View style={styles.slideWrap}>
            <SlideToAccept
              label={accepted ? 'Course acceptée' : 'Glissez pour accepter'}
              onAccept={handleAccept}
              reduceMotion={reduceMotion}
            />
          </View>

          {/* Refuser */}
          <TouchableOpacity
            style={styles.refuse}
            onPress={onRefuse}
            disabled={accepted}
            accessibilityRole="button"
            accessibilityLabel="Refuser la course"
          >
            <Text style={styles.refuseText}>Refuser la course</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Chip({ icon, value, label }: { icon: any; value: string; label: string }) {
  return (
    <View style={styles.chip}>
      <Ionicons name={icon} size={18} color={T.vivid} />
      <View style={{ flex: 1 }}>
        <Text style={styles.chipValue} numberOfLines={1}>
          {value}
        </Text>
        <Text style={styles.chipLabel}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bgEnd },
  content: { paddingHorizontal: 24, minHeight: '100%', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dotWrap: { width: 12, height: 12, alignItems: 'center', justifyContent: 'center' },
  pulseRing: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: T.vivid,
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: T.vivid,
    shadowColor: T.vivid,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  kicker: {
    fontFamily: FONT.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.82)',
  },
  secsPill: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  secsNum: { fontFamily: FONT.disp, fontSize: 16, color: T.amber },
  secsUnit: { fontFamily: FONT.disp, fontSize: 13, color: T.white, marginLeft: 1, marginBottom: 1 },

  hero: { alignItems: 'center', marginTop: 28, marginBottom: 22, paddingVertical: 16 },
  gainLabel: { fontFamily: FONT.bodyBold, fontSize: 12, letterSpacing: 3, color: T.mint },
  gainRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 4 },
  gainValue: {
    fontFamily: FONT.disp,
    fontSize: 60,
    color: T.white,
    textShadowColor: 'rgba(0,230,118,0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
    height: 70,
    textAlign: 'center',
  },
  fcfa: { fontFamily: FONT.disp, fontSize: 22, color: T.mint, marginLeft: 8, marginBottom: 10 },

  card: {
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.cardBorder,
    borderRadius: RAD.card,
    padding: 16,
  },
  chips: { flexDirection: 'row', gap: 10 },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: RAD.chip,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  chipValue: { fontFamily: FONT.disp, fontSize: 15, color: T.white },
  chipLabel: {
    fontFamily: FONT.bodyBold,
    fontSize: 9.5,
    letterSpacing: 0.8,
    color: T.textMut,
    marginTop: 1,
  },

  flags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  flag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  flagFragile: { backgroundColor: T.amber },
  flagFragileText: {
    fontFamily: FONT.bodyBold,
    fontSize: 12,
    letterSpacing: 1,
    color: '#3A1A00',
  },
  flagValue: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(174,244,203,0.25)',
  },
  flagValueText: { fontFamily: FONT.body, fontSize: 13, color: T.mint },

  thirdParty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  thirdPartyText: { fontFamily: FONT.body, fontSize: 13, color: T.mint },
  thirdPartyName: { fontFamily: FONT.bodyBold, color: T.white },

  slideWrap: { marginTop: 22 },
  refuse: { alignItems: 'center', paddingVertical: 14, marginTop: 14 },
  refuseText: { fontFamily: FONT.bodyBold, fontSize: 14, color: '#CFE8D8' },
});
