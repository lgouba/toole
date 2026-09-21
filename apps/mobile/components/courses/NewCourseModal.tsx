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
import Svg, { Path, Circle, Rect as SvgRect } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useDerivedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withTiming,
  withRepeat,
  cancelAnimation,
  runOnJS,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { FONT } from './theme';
import { GoldenHourBackground } from './GoldenHourBackground';
import { GoldenSlider } from './GoldenSlider';
import { GainCounter } from './GainCounter';

export type Course = {
  gain: number; // net livreur — INCHANGÉ
  distanceKm?: number; // trajet récup → livraison
  retraitKm?: number | null; // livreur → récup (calcul client), null si GPS indispo
  price: number; // prix total (affiché en petit, seulement si cash)
  paymentMethod?: 'cash' | 'orange_money' | 'moov_money';
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
function kmText(km: number) {
  return `${(Math.round(km * 10) / 10).toFixed(1).replace('.', ',')} km`;
}
function mText(km: number) {
  return `${Math.round((km * 1000) / 50) * 50} m`;
}
// Retrait (estimé, vol d'oiseau) : « Sur place » < 100 m, mètres < 1 km, sinon km.
function formatRetrait(km?: number | null): { t: string; approx: boolean } | null {
  if (km == null || !Number.isFinite(km)) return null;
  if (km < 0.1) return { t: 'Sur place', approx: false };
  if (km < 1) return { t: mText(km), approx: true };
  return { t: kmText(km), approx: true };
}
// Trajet (serveur, pas d'estimation → pas de tilde).
function formatTrajet(km?: number | null): string {
  if (km == null || !Number.isFinite(km)) return '—';
  if (km < 1) return mText(km);
  return kmText(km);
}
function mmss(total: number) {
  const s = Math.max(0, total);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

export function NewCourseModal({ course, durationSec = 120, onAccept, onRefuse, onTimeout }: Props) {
  const insets = useSafeAreaInsets();
  const { height: H, width: W, fontScale } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [secs, setSecs] = useState(durationSec);
  const [accepted, setAccepted] = useState(false);

  const progress = useSharedValue(0); // 0 = plein temps, 1 = expiré (INCHANGÉ)

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

  // ---- Lumière : p = temps restant (1→0), u = 0 jour → 1 nuit ----
  // progress = 0 au départ → 1 à l'expiration. p = restant = 1 - progress.
  // u = (1 - p)^1.35 = progress^1.35 : 0 = PLEIN JOUR, 1 = nuit.
  const p = useDerivedValue(() => 1 - progress.value);
  const u = useDerivedValue(() => Math.pow(progress.value, 1.35));
  // Le SOL a sa propre progression, décalée et plus brève (reste crème tant
  // qu'il reste plus de la moitié du temps, puis bascule franchement).
  const uSol = useDerivedValue(() => {
    const s = Math.min(Math.max((u.value - 0.38) / 0.45, 0), 1);
    return Math.pow(s, 1.1);
  });
  // Bascule NUIT de la carte EN MÊME TEMPS que le sol (uSol > 0.55), 0.7 s.
  const night = useSharedValue(0);
  useAnimatedReaction(
    () => uSol.value > 0.55,
    (isNight, prev) => {
      if (isNight !== prev) night.value = withTiming(isNight ? 1 : 0, { duration: 700 });
    },
  );

  // ---- Géométrie : facteur k, ancrée depuis le BAS ----
  const k = clamp(H / 844, 0.84, 1.13);
  const g = W >= 400 ? 24 : 20;
  const useSerre = fontScale >= 1.4;

  const refusH = 46 * k;
  const refusTop = H - insets.bottom - 6 - refusH;
  const boutonH = 78 * k;
  const boutonTop = refusTop - 12 * k - boutonH;
  const carteBas = boutonTop - 26 * k;
  const cardH = 152 * k;
  const carteTop = carteBas - cardH;
  const horizon = carteTop;

  const enteteTop = insets.top + 14 * k;
  // + de garde sous l'eyebrow : le grand chiffre (mono/display) déborde vers le
  // haut de sa boîte, il chevauchait « NOUVELLE COURSE ».
  const montantTop = enteteTop + 56 * k;
  const gainSize = (useSerre ? 82 : 104) * k;
  const pastilleTop = montantTop + gainSize * 0.9 + 12 * k;
  // L'arc se pose juste sous la pastille (30 = hauteur pastille, 84 = place des
  // étiquettes de distance). Le soleil descend dans le COULOIR libre entre l'arc
  // et l'horizon, et sa taille est bornée par ce couloir → il ne croise jamais
  // l'arc, sur n'importe quel écran.
  const arcY = pastilleTop + 30 * k + 84 * k;
  const couloir = Math.max(44, carteTop - (arcY + 26 * k));
  const sunSize = Math.min(126 * k, couloir * 1.15);
  const sunTop = arcY + 26 * k;
  const sunBottom = carteTop + sunSize * 0.45;

  // ---- Montant (net) : largeur fixe → FCFA reste sur la ligne de base ----
  const gainStr = fmtCFA(course.gain);
  const gainW = Math.ceil(gainStr.length * gainSize * 0.6);

  // ---- Paiement ----
  const pm = course.paymentMethod ?? 'cash';
  const estCash = pm === 'cash';
  const colisUp = course.colisLabel.toUpperCase();
  const pastilleText = estCash
    ? `${colisUp} · ${fmtCFA(course.price)} FCFA EN ESPÈCES`
    : `${colisUp} · DÉJÀ PAYÉ`;
  const payDot = pm === 'moov_money' ? '#1B6BB8' : pm === 'orange_money' ? '#FF7900' : '#FFD27A';
  const subLabel = estCash
    ? `${fmtCFA(course.price)} FCFA à encaisser en espèces`
    : pm === 'orange_money'
      ? 'déjà payé · Orange Money'
      : 'déjà payé · Moov Money';

  // ---- Arc du trajet ----
  const trajet = course.distanceKm ?? 0;
  const retraitInfo = formatRetrait(course.retraitKm);
  const showRetrait = retraitInfo != null;
  const retraitText = retraitInfo ? (retraitInfo.approx ? `~${retraitInfo.t}` : retraitInfo.t) : '';
  const trajetText = formatTrajet(course.distanceKm);
  const x0 = g + 10;
  const x1 = W - g - 10;
  // Proportion réelle ; plancher 0.20. Sous ce seuil (livreur ~sur place) on
  // masque le libellé VOUS (il chevaucherait RÉCUPÉRATION), le cercle reste.
  let fBrut = 0;
  const retraitKm = course.retraitKm ?? 0;
  if (showRetrait && retraitKm + trajet > 0) fBrut = retraitKm / (retraitKm + trajet);
  const f = Math.max(0.2, fBrut);
  const showVous = showRetrait && fBrut >= 0.2;
  const xRecup = showRetrait ? x0 + f * (x1 - x0) : x0;
  const amp1 = 46 * k * 0.42;
  const amp2 = 46 * k;
  const mid1 = (x0 + xRecup) / 2;
  const mid2 = (xRecup + x1) / 2;
  // Coords LOCALES du SVG (hauteur 60, ligne de base à y=26).
  const baseY = 26;
  const retraitPath = `M${x0} ${baseY} Q ${mid1} ${baseY - amp1} ${xRecup} ${baseY}`;
  const mainPath = `M${xRecup} ${baseY} Q ${mid2} ${baseY - amp2} ${x1} ${baseY}`;

  // ---- Styles animés (jour/nuit) ----
  const cardBg = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(night.value, [0, 1], ['#FFFFFF', '#1A1F1D']),
  }));
  const railBg = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(night.value, [0, 1], ['#E5E0D2', 'rgba(255,255,255,0.16)']),
  }));
  const dropBg = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(night.value, [0, 1], ['#17241C', '#F0EBE0']),
  }));
  const labelCol = useAnimatedStyle(() => ({
    color: interpolateColor(night.value, [0, 1], ['#9A9384', 'rgba(150,140,120,0.8)']),
  }));
  const addrCol = useAnimatedStyle(() => ({
    color: interpolateColor(night.value, [0, 1], ['#17241C', '#F4EFE4']),
  }));
  const refuseCol = useAnimatedStyle(() => ({
    // s'éclaircit AVEC le sol (uSol), reste lisible sur le sable/brun.
    color: interpolateColor(uSol.value, [0, 1], ['#9A8C74', 'rgba(240,228,212,0.82)']),
  }));
  const haloRed = useAnimatedStyle(() => {
    // Inline (pas d'appel de fonction JS dans un worklet).
    const t = Math.min(Math.max((u.value - 0.6) / 0.4, 0), 1);
    return { opacity: t * 0.55 };
  });

  const livDotTop = cardH - 46 * k;
  const addrSize = (useSerre ? 15 : 17.2) * k;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => {}}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.root}>
          <GoldenHourBackground
            u={u}
            uSol={uSol}
            p={p}
            horizon={horizon}
            sunTop={sunTop}
            sunBottom={sunBottom}
            sunSize={sunSize}
            width={W}
            height={H}
            reduceMotion={reduceMotion}
          />

          {/* En-tête */}
          <View style={[styles.band, { top: enteteTop, paddingHorizontal: 26 }]}>
            <Text maxFontSizeMultiplier={1.8} style={[styles.kicker, { fontSize: 10.5 * k }]}>
              NOUVELLE COURSE
            </Text>
            <Text
              maxFontSizeMultiplier={1.2}
              style={[styles.timer, { fontSize: 20 * k }]}
              accessibilityLabel={`${secs} secondes restantes`}
            >
              {mmss(secs)}
            </Text>
          </View>

          {/* Montant net */}
          <View style={[styles.gainRow, { top: montantTop, left: 26 }]}>
            <GainCounter
              value={course.gain}
              reduceMotion={reduceMotion}
              style={{
                fontFamily: FONT.disp,
                color: '#FFFFFF',
                fontSize: gainSize,
                lineHeight: gainSize * 0.9,
                height: gainSize * 0.94,
                width: gainW,
                letterSpacing: -gainSize * 0.07,
                textAlign: 'right',
                padding: 0,
                includeFontPadding: false,
              }}
            />
            <Text maxFontSizeMultiplier={1.2} style={[styles.fcfa, { fontSize: gainSize * 0.24 }]}>
              FCFA
            </Text>
          </View>

          {/* Pastille colis + paiement */}
          <View style={[styles.pastille, { top: pastilleTop, left: 26 }]}>
            <View style={[styles.payDot, { backgroundColor: payDot }]} />
            <Text maxFontSizeMultiplier={1.4} style={styles.pastilleText} numberOfLines={1}>
              {pastilleText}
            </Text>
          </View>

          {/* Arc du trajet (remplace les tuiles) */}
          <View style={[styles.arc, { top: arcY - 26, height: 60 }]} pointerEvents="none">
            <Svg width={W} height={60} style={StyleSheet.absoluteFill}>
              {showRetrait ? (
                <Path d={retraitPath} stroke="rgba(255,238,206,0.72)" strokeWidth={2} strokeDasharray="5 7" fill="none" />
              ) : null}
              <Path d={mainPath} stroke="rgba(255,250,238,0.96)" strokeWidth={2.6} fill="none" />
              {showRetrait ? (
                <Circle cx={x0} cy={baseY} r={4} stroke="rgba(255,238,206,0.9)" strokeWidth={2} fill="none" />
              ) : null}
              <Circle cx={xRecup} cy={baseY} r={5.5} fill="rgba(255,250,238,0.98)" />
              <SvgRect x={x1 - 5} y={baseY - 5} width={10} height={10} rx={2.5} fill="rgba(255,250,238,0.98)" />
            </Svg>
            {/* distances + libellés (Text RN par-dessus, avec ombre) */}
            {showRetrait ? (
              <Text style={[styles.arcKm, { left: x0, width: Math.max(30, xRecup - x0), top: 0 }]} numberOfLines={1}>
                {retraitText}
              </Text>
            ) : null}
            <Text style={[styles.arcKmMain, { left: xRecup, width: x1 - xRecup, top: 0 }]} numberOfLines={1}>
              {trajetText}
            </Text>
            {showVous ? <Text style={[styles.arcLabel, { left: x0, top: 40 }]}>VOUS</Text> : null}
            <Text style={[styles.arcLabel, { left: xRecup - 9, top: 40 }]}>RÉCUPÉRATION</Text>
            <Text style={[styles.arcLabel, styles.arcLabelRight, { right: W - x1, top: 40 }]}>LIVRAISON</Text>
          </View>

          {/* Carte des adresses (jour → nuit) */}
          <Animated.View
            style={[
              styles.card,
              cardBg,
              { left: g, right: g, top: carteTop, height: cardH, borderRadius: 26 * k },
            ]}
          >
            <Animated.View style={[styles.rail, railBg, { left: 29 * k, top: 42 * k, height: livDotTop - 42 * k }]} />
            <View style={[styles.pickupHalo, { left: 17 * k, top: 22 * k }]}>
              <View style={styles.pickupDot} />
            </View>
            <Animated.View style={[styles.dropDot, dropBg, { left: 23 * k, top: livDotTop }]} />

            <View style={[styles.routeText, { paddingLeft: 54 * k, paddingRight: 21 * k, paddingVertical: 21 * k }]}>
              <Animated.Text maxFontSizeMultiplier={1.8} style={[styles.routeLabel, labelCol]}>
                RÉCUPÉRATION
              </Animated.Text>
              <Animated.Text
                maxFontSizeMultiplier={1.4}
                style={[styles.addr, addrCol, { fontSize: addrSize, lineHeight: addrSize * 1.16 }]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {course.pickup}
              </Animated.Text>
              <View style={{ height: 14 * k }} />
              <Animated.Text maxFontSizeMultiplier={1.8} style={[styles.routeLabel, labelCol]}>
                LIVRAISON
              </Animated.Text>
              <Animated.Text
                maxFontSizeMultiplier={1.4}
                style={[styles.addr, addrCol, { fontSize: addrSize, lineHeight: addrSize * 1.16 }]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {course.dropoff}
              </Animated.Text>
            </View>
          </Animated.View>

          {/* Bouton (halo rouge + slider or→braise) */}
          <View style={{ position: 'absolute', left: g, right: g, top: boutonTop }}>
            <Animated.View
              pointerEvents="none"
              style={[styles.redHalo, haloRed, { top: -10, bottom: -10, left: -10, right: -10, borderRadius: 30 }]}
            />
            <GoldenSlider
              label={accepted ? 'Course acceptée' : 'Glissez pour accepter'}
              subLabel={subLabel}
              onAccept={handleAccept}
              reduceMotion={reduceMotion}
              u={u}
              height={boutonH}
            />
          </View>

          {/* Refuser */}
          <TouchableOpacity
            style={{ position: 'absolute', left: g, right: g, top: refusTop, height: refusH, alignItems: 'center', justifyContent: 'center' }}
            onPress={onRefuse}
            disabled={accepted}
            accessibilityRole="button"
            accessibilityLabel="Refuser la course"
          >
            <Animated.Text maxFontSizeMultiplier={1.4} style={[styles.refuseText, refuseCol, { fontSize: 15 * k }]}>
              Refuser la course
            </Animated.Text>
          </TouchableOpacity>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const ARC_SHADOW = {
  textShadowColor: 'rgba(24,48,26,0.75)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 8,
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#03140E' },

  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: { fontFamily: FONT.disp, letterSpacing: 2, color: 'rgba(255,255,255,0.8)' },
  timer: { fontFamily: MONO, fontWeight: '700', color: '#FFFFFF', letterSpacing: 1 },

  gainRow: { position: 'absolute', flexDirection: 'row', alignItems: 'flex-end' },
  fcfa: { fontFamily: FONT.disp, color: 'rgba(255,255,255,0.8)', marginLeft: 8, marginBottom: 8 },

  pastille: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 30,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.34)',
  },
  payDot: { width: 7, height: 7, borderRadius: 4 },
  pastilleText: { fontFamily: FONT.disp, fontSize: 11, letterSpacing: 0.9, color: 'rgba(255,250,240,0.95)' },

  arc: { position: 'absolute', left: 0, right: 0 },
  arcKm: { position: 'absolute', textAlign: 'center', fontFamily: FONT.disp, fontSize: 11, color: '#FFF3DC', ...ARC_SHADOW },
  arcKmMain: { position: 'absolute', textAlign: 'center', fontFamily: FONT.disp, fontSize: 12, color: '#FFFAF0', ...ARC_SHADOW },
  arcLabel: { position: 'absolute', fontFamily: FONT.disp, fontSize: 9.5, letterSpacing: 1.2, color: 'rgba(255,250,240,0.92)', ...ARC_SHADOW },
  arcLabelRight: { textAlign: 'right' },

  card: {
    position: 'absolute',
    overflow: 'hidden',
    shadowColor: 'rgba(24,40,20,1)',
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 22 },
    elevation: 12,
  },
  rail: { position: 'absolute', width: 2 },
  pickupHalo: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,122,68,0.14)',
  },
  pickupDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#0E7A44' },
  dropDot: { position: 'absolute', width: 14, height: 14, borderRadius: 4 },
  routeText: { flex: 1, justifyContent: 'center' },
  routeLabel: { fontFamily: FONT.disp, fontSize: 9.5, letterSpacing: 1.7, marginBottom: 4 },
  addr: { fontFamily: FONT.disp, letterSpacing: -0.44 },

  redHalo: { position: 'absolute', backgroundColor: 'rgba(255,90,40,0.55)' },
  refuseText: { fontFamily: FONT.dispBold },
});
