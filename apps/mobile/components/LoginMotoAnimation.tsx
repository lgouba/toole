import React, { useEffect, useRef } from 'react';
import {
  View,
  Animated,
  Easing,
  Text,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';

/**
 * Scène animée de l'écran de login : un livreur à moto qui roule vers sa
 * destination (📍), en boucle. Plus vivant qu'un emoji statique.
 *
 * 100% Animated (core RN) → compatible OTA, aucun module natif requis.
 *
 * L'emoji 🛵 regarde naturellement vers la GAUCHE : la moto entre donc par la
 * droite et roule vers le point de livraison placé à gauche. Les traînées de
 * vitesse sont derrière elle (à droite).
 */
export function LoginMotoAnimation() {
  const drive = useRef(new Animated.Value(0)).current; // progression 0 → 1
  const bob = useRef(new Animated.Value(0)).current; // petit rebond vertical
  const pinPop = useRef(new Animated.Value(0)).current; // "pop" à l'arrivée
  const width = useRef(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w && w !== width.current) {
      width.current = w;
    }
  };

  useEffect(() => {
    // Rebond vertical continu (effet route cahoteuse)
    const bobLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: -6,
          duration: 320,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 320,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    // Cycle principal : la moto roule vers le pin, le pin "pop", reset, répète.
    const driveLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drive, {
          toValue: 1,
          duration: 2600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        // Le point de destination tressaute (colis reçu)
        Animated.sequence([
          Animated.timing(pinPop, {
            toValue: 1,
            duration: 200,
            easing: Easing.out(Easing.back(2.5)),
            useNativeDriver: true,
          }),
          Animated.timing(pinPop, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(450),
        // Reset instantané hors écran à droite
        Animated.timing(drive, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(350),
      ]),
    );

    bobLoop.start();
    driveLoop.start();
    return () => {
      bobLoop.stop();
      driveLoop.stop();
    };
  }, [drive, bob, pinPop]);

  // La moto part de la droite (hors écran) et s'arrête près du pin à gauche.
  const translateX = drive.interpolate({
    inputRange: [0, 1],
    outputRange: [320, 70], // valeurs en px ; large pour couvrir l'écran
  });

  // Traînées visibles seulement quand la moto roule.
  const speedOpacity = drive.interpolate({
    inputRange: [0, 0.08, 0.92, 1],
    outputRange: [0, 1, 1, 0],
  });

  const pinScale = pinPop.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.45],
  });
  const pinLift = pinPop.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  return (
    <View style={styles.scene} onLayout={onLayout}>
      {/* Décor : nuages / accents */}
      <Text style={styles.cloud}>☁️</Text>

      {/* Destination */}
      <Animated.Text
        style={[
          styles.pin,
          { transform: [{ scale: pinScale }, { translateY: pinLift }] },
        ]}
      >
        📍
      </Animated.Text>

      {/* Moto + traînées de vitesse (qui la suivent à droite) */}
      <Animated.View
        style={[
          styles.motoRow,
          { transform: [{ translateX }, { translateY: bob }] },
        ]}
      >
        <Text style={styles.moto}>🛵</Text>
        <Animated.View style={[styles.speedLines, { opacity: speedOpacity }]}>
          <View style={[styles.line, { width: 30 }]} />
          <View style={[styles.line, { width: 22 }]} />
          <View style={[styles.line, { width: 14 }]} />
        </Animated.View>
      </Animated.View>

      {/* Route */}
      <View style={styles.road} />
    </View>
  );
}

const styles = StyleSheet.create({
  scene: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  cloud: {
    position: 'absolute',
    top: 30,
    left: 40,
    fontSize: 34,
    opacity: 0.65,
  },
  pin: {
    position: 'absolute',
    left: 34,
    bottom: 88,
    fontSize: 44,
  },
  motoRow: {
    position: 'absolute',
    bottom: 70,
    left: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  moto: {
    fontSize: 96,
    textShadowColor: 'rgba(0,0,0,0.22)',
    textShadowOffset: { width: 0, height: 6 },
    textShadowRadius: 12,
  },
  speedLines: {
    marginLeft: 2,
    gap: 7,
    alignItems: 'flex-start',
  },
  line: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  road: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 64,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
});
