import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  BackHandler,
  Modal,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeIn,
  FadeInDown,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { typography, spacing, borderRadius } from '@/theme';
import { useColors, type ThemeColors } from '@/theme/useColors';
import { useDriverStore } from '@/stores/driver.store';
import { useCountdown } from '@/hooks/useCountdown';
import { alertConfirmSuccess, alertRejection, stopAlert } from '@/utils/alerts';
import { formatCFA, formatDistance } from '@/utils/format';
import { PACKAGE_LABELS, PackageType } from '@/types';

const TIMEOUT_SECONDS = 120;

const PACKAGE_ICONS: Record<PackageType, keyof typeof Ionicons.glyphMap> = {
  envelope: 'mail',
  small: 'cube',
  large: 'archive',
};

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Modal globale de demande de course pour le livreur.
 *
 * **Architecture** : monte dans le layout driver, s'affiche AUTOMATIQUEMENT
 * des que `currentRequest != null` dans le store. C'est un vrai composant
 * `<Modal>` natif RN avec `transparent={true}` et `onRequestClose` qui ne
 * fait rien. Cela garantit :
 *   - Aucun touch en-dehors des boutons ne peut la fermer
 *   - Le bouton retour Android est intercepté
 *   - Aucun gesture de swipe-back n'est possible
 *
 * Plus de routing vers /(driver)/new-request : la modal apparait par-dessus
 * l'ecran actuel. Le livreur DOIT explicitement accepter ou refuser, sinon
 * le timer 2 min decline auto.
 */
export function NewRequestModal() {
  const router = useRouter();
  const colors = useColors();
  // ⚠️ SafeAreaView a l'interieur d'un <Modal> RN ne recoit pas toujours
  // les bons insets sur iOS (le Modal monte dans une window native separee).
  // useSafeAreaInsets() lit le context React qui traverse correctement les
  // portails de modal. On applique le top inset manuellement sur le header
  // pour eviter le chevauchement avec le Dynamic Island / encoche.
  const insets = useSafeAreaInsets();
  // Recalcul des styles a chaque changement de couleur primaire/secondaire
  // (admin peut changer la palette en live). useMemo sur primary+secondary
  // permet d'eviter le recompute a chaque render mais de bien reagir aux
  // changements de theme.
  const styles = useMemo(
    () => createStyles(colors),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colors.primary, colors.primaryDark, colors.secondary, colors.background, colors.surface],
  );
  const { currentRequest, acceptRequest, rejectRequest } = useDriverStore();

  const { remaining, start } = useCountdown(TIMEOUT_SECONDS, () => {
    rejectRequest();
  });

  useEffect(() => {
    if (currentRequest) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRequest?.id]);

  // Bloque le bouton "retour" Android tant qu'une demande est en cours.
  useEffect(() => {
    if (!currentRequest) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [currentRequest]);

  // ⚠️ PAS DE POLLING ICI.
  //
  // Tentation precedente : poller GET /deliveries/:id toutes les 5s pour
  // detecter si la course a ete annulee/expiree/prise. PROBLEME : l'endpoint
  // renvoie 403 tant que le livreur n'est ni sender ni driver de la course,
  // ce qui est le cas tant qu'il n'a pas accepte. getDeliveryById catch
  // l'erreur et retourne null -> le polling croit que la course n'existe
  // plus -> il ferme la modal. BUG.
  //
  // On compte donc UNIQUEMENT sur :
  //   - socket 'delivery:invalidated' (acceptee par un autre, annulee client)
  //   - socket 'delivery:expired' (expiration cote serveur)
  //   - le timer local de 2 minutes (rejet auto en dernier recours)

  const handleAccept = async () => {
    stopAlert();
    alertConfirmSuccess();
    await acceptRequest();
    router.replace('/(driver)/pickup-navigation');
  };

  const handleReject = () => {
    stopAlert();
    alertRejection();
    rejectRequest();
    // Pas besoin de naviguer : la modal disparait quand currentRequest = null
  };

  const visible = !!currentRequest;
  if (!currentRequest) {
    // Modal pas montree quand il n'y a pas de demande. On retourne quand
    // meme un <Modal visible={false}> pour faire les transitions propres,
    // mais en pratique avec visible=false rien n'est rendu.
    return <Modal visible={false} transparent />;
  }

  const progress = remaining / TIMEOUT_SECONDS;
  const isThirdParty = !!currentRequest.senderContactName;
  const gain = currentRequest.driverCommission || currentRequest.price;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      // onRequestClose est appele par le bouton hardware back Android.
      // On le no-op pour que la modal soit imperdable par un tap accidentel.
      onRequestClose={() => {}}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Backdrop opaque qui couvre tout l'ecran et absorbe TOUS les touchs */}
        <View style={styles.backdrop} pointerEvents="auto" />

        <SafeAreaView style={styles.safeArea} pointerEvents="box-none">
          {/* Header : titre + timer rond. paddingTop dynamique base sur les
              vrais safe area insets — gere notch iPhone, Dynamic Island,
              status bar Android translucide, etc. Minimum 12px pour les
              ecrans sans encoche. */}
          <Animated.View
            entering={FadeIn.duration(400)}
            style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 8 }]}
            pointerEvents="box-none"
          >
            <View style={styles.headerLeft}>
              <View style={styles.bikeBadge}>
                <Ionicons name="bicycle" size={22} color={colors.white} />
              </View>
              <View>
                <Text style={styles.kicker}>NOUVELLE COURSE</Text>
                <Text style={styles.title}>Une demande pour vous</Text>
              </View>
            </View>
            <TimerRing seconds={remaining} progress={progress} />
          </Animated.View>

          {/* Decoration au milieu : remplit l'espace vide entre le header
              et la sheet, donne du caractere a la modale. */}
          <View style={styles.heroDecorWrap} pointerEvents="none">
            <Animated.View
              entering={FadeIn.duration(600).delay(200)}
              style={styles.heroDecor}
            >
              <Text style={styles.heroEmoji}>🛵💨</Text>
              <Text style={styles.heroTagline}>Une course t'attend !</Text>
            </Animated.View>
          </View>

          {/* Card principale */}
          <Animated.View
            entering={SlideInDown.duration(450).springify().damping(18)}
            style={styles.sheet}
          >
            {/* BANNIERE FRAGILE — bien visible pour que le livreur puisse
                decider de refuser s'il ne peut pas garantir un transport
                sans casse. Apparait avant tout le reste. */}
            {currentRequest.isFragile && (
              <Animated.View
                entering={FadeIn.duration(300)}
                style={styles.fragileBanner}
              >
                <View style={styles.fragileBannerIcon}>
                  <Text style={styles.fragileBannerEmoji}>⚠️</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fragileBannerTitle}>COLIS FRAGILE</Text>
                  <Text style={styles.fragileBannerSubtitle}>
                    Manipulation délicate requise — refusez si vous ne pouvez pas
                    garantir un transport sans casse.
                  </Text>
                </View>
              </Animated.View>
            )}

            {/* Hero gain */}
            <View style={styles.gainHero}>
              <Text style={styles.gainLabel}>Votre gain</Text>
              <Text style={styles.gainValue}>{formatCFA(gain)}</Text>
              <View style={styles.gainMeta}>
                <Stat
                  icon="navigate-outline"
                  value={
                    currentRequest.estimatedDistanceKm
                      ? formatDistance(currentRequest.estimatedDistanceKm)
                      : '—'
                  }
                  label="Distance"
                />
                <View style={styles.statDivider} />
                <Stat
                  icon={PACKAGE_ICONS[currentRequest.packageType]}
                  value={PACKAGE_LABELS[currentRequest.packageType]}
                  label="Colis"
                />
              </View>
            </View>

            {isThirdParty ? (
              <Animated.View
                entering={FadeInDown.duration(350).delay(150)}
                style={styles.thirdPartyBadge}
              >
                <Ionicons name="person" size={16} color={colors.primaryDark} />
                <Text style={styles.thirdPartyText}>
                  Colis chez{' '}
                  <Text style={styles.thirdPartyName}>
                    {currentRequest.senderContactName}
                  </Text>
                </Text>
              </Animated.View>
            ) : null}

            {currentRequest.declaredValue ? (
              <Animated.View
                entering={FadeInDown.duration(350).delay(170)}
                style={styles.colisInfoRow}
              >
                <View style={styles.colisInfoChip}>
                  <Text style={styles.colisInfoChipText}>
                    Valeur ~{formatCFA(currentRequest.declaredValue)}
                  </Text>
                </View>
              </Animated.View>
            ) : null}

            {/* Trajet */}
            <Animated.View
              entering={FadeInDown.duration(350).delay(200)}
              style={styles.routeBox}
            >
              <RoutePoint
                dotColor={colors.primary}
                label="RÉCUPÉRATION"
                address={currentRequest.pickupAddress}
                details={currentRequest.pickupDetails}
              />
              <View style={styles.routeConnector}>
                <View style={styles.routeDash} />
                <View style={styles.routeDash} />
                <View style={styles.routeDash} />
              </View>
              <RoutePoint
                dotColor={colors.secondary}
                label="LIVRAISON"
                address={currentRequest.deliveryAddress}
                details={currentRequest.deliveryDetails}
                isLast
              />
            </Animated.View>

            {/* Boutons */}
            <View style={styles.actions}>
              <Pressable
                onPress={handleReject}
                style={({ pressed }) => [
                  styles.rejectBtn,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
                <Text style={styles.rejectText}>Refuser</Text>
              </Pressable>

              <View style={styles.acceptBtnWrap}>
                <Pressable
                  onPress={handleAccept}
                  style={({ pressed }) => [
                    styles.acceptBtn,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text
                    style={styles.acceptText}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    Accepter la course
                  </Text>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function TimerRing({ seconds, progress }: { seconds: number; progress: number }) {
  const colors = useColors();
  const styles = useMemo(
    () => createStyles(colors),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colors.primary, colors.primaryDark, colors.secondary, colors.background, colors.surface],
  );
  const SIZE = 56;
  const STROKE = 5;
  const RADIUS = (SIZE - STROKE) / 2;
  const CIRC = 2 * Math.PI * RADIUS;
  const dashOffset = CIRC * (1 - progress);
  const isUrgent = seconds <= 20;

  return (
    <View style={{ width: SIZE, height: SIZE }}>
      <Svg width={SIZE} height={SIZE}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={colors.border}
          strokeWidth={STROKE}
          fill="none"
        />
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={isUrgent ? colors.error : colors.primary}
          strokeWidth={STROKE}
          fill="none"
          strokeDasharray={CIRC}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>
      <View style={styles.timerCenter}>
        <Text style={[styles.timerNum, isUrgent && { color: colors.error }]}>
          {seconds}
        </Text>
      </View>
    </View>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
}) {
  const colors = useColors();
  const styles = useMemo(
    () => createStyles(colors),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colors.primary, colors.primaryDark, colors.secondary, colors.background, colors.surface],
  );
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color={colors.white} style={{ opacity: 0.8 }} />
      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

function RoutePoint({
  dotColor,
  label,
  address,
  details,
  isLast,
}: {
  dotColor: string;
  label: string;
  address: string;
  details?: string | null;
  isLast?: boolean;
}) {
  const colors = useColors();
  const styles = useMemo(
    () => createStyles(colors),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colors.primary, colors.primaryDark, colors.secondary, colors.background, colors.surface],
  );
  return (
    <View style={styles.routePoint}>
      <View style={[styles.routeDot, { backgroundColor: dotColor }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.routeLabel}>{label}</Text>
        <Text style={styles.routeAddress} numberOfLines={2}>
          {address}
        </Text>
        {details ? (
          <Text style={styles.routeDetails} numberOfLines={1}>
            {details}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primaryDark,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.primaryDark,
  },
  safeArea: {
    flex: 1,
    // Layout : header en haut (safe area), decor au milieu (espace flexible),
    // sheet en bas. Le decor remplit l'espace vide pour eviter une zone
    // verte deserte sur grand ecran.
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  bikeBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  title: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '700',
    marginTop: 2,
  },
  timerCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerNum: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  // Wrapper flexible qui prend tout l'espace entre le header et la sheet
  heroDecorWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  heroDecor: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroEmoji: {
    fontSize: 70,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 6 },
    textShadowRadius: 12,
  },
  heroTagline: {
    ...typography.bodyMedium,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  fragileBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: '#FEF2F2',
    borderWidth: 2,
    borderColor: '#DC2626',
    shadowColor: '#DC2626',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fragileBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fragileBannerEmoji: {
    fontSize: 24,
  },
  fragileBannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#991B1B',
    letterSpacing: 1.5,
  },
  fragileBannerSubtitle: {
    ...typography.caption,
    color: '#B91C1C',
    marginTop: 2,
    lineHeight: 16,
  },
  gainHero: {
    backgroundColor: colors.primary,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  gainLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  gainValue: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.white,
    marginTop: 4,
    letterSpacing: -0.5,
  },
  gainMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    width: '100%',
    justifyContent: 'center',
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  statValue: {
    ...typography.bodySmall,
    color: colors.white,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  thirdPartyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    backgroundColor: colors.primaryLight,
    alignSelf: 'center',
  },
  thirdPartyText: {
    ...typography.bodySmall,
    color: colors.primaryDark,
  },
  thirdPartyName: {
    fontWeight: '700',
  },
  colisInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  colisInfoChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  colisInfoChipText: {
    ...typography.captionMedium,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  routeBox: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    gap: 4,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  routeLabel: {
    fontSize: 10,
    color: colors.textTertiary,
    fontWeight: '700',
    letterSpacing: 1,
  },
  routeAddress: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '600',
    marginTop: 2,
    lineHeight: 18,
  },
  routeDetails: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  routeConnector: {
    marginLeft: 5,
    paddingVertical: 6,
    gap: 3,
  },
  routeDash: {
    width: 2,
    height: 3,
    backgroundColor: colors.border,
    borderRadius: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  rejectBtn: {
    width: 64,
    height: 56,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  rejectText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  acceptBtnWrap: {
    flex: 1,
  },
  acceptBtn: {
    height: 56,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  acceptText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '800',
    fontSize: 16,
    textAlign: 'center',
  },
});

