import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FONT } from './theme';

/**
 * Timeline récupération → livraison, sur la carte BLANCHE (texte sombre).
 * Colonne gauche : pastille ronde verte (récup) · trait vertical · pastille
 * carrée sombre (livraison). Colonne droite : libellés + adresses.
 * Données (pickup/dropoff) inchangées ; seul le rendu change.
 */
export function RouteTimeline({
  pickup,
  dropoff,
  addrSize = 18,
}: {
  pickup: string;
  dropoff: string;
  addrSize?: number;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.timeline}>
        <View style={styles.pickupHalo}>
          <View style={styles.pickupDot} />
        </View>
        <View style={styles.line} />
        <View style={styles.dropDot} />
      </View>

      <View style={styles.texts}>
        <View>
          <Text maxFontSizeMultiplier={1.8} style={styles.label}>
            RÉCUPÉRATION
          </Text>
          <Text
            maxFontSizeMultiplier={1.5}
            style={[styles.addr, { fontSize: addrSize, lineHeight: addrSize * 1.14 }]}
            numberOfLines={2}
          >
            {pickup}
          </Text>
        </View>
        <View style={{ height: 17 }} />
        <View>
          <Text maxFontSizeMultiplier={1.8} style={styles.label}>
            LIVRAISON
          </Text>
          <Text
            maxFontSizeMultiplier={1.5}
            style={[styles.addr, { fontSize: addrSize, lineHeight: addrSize * 1.14 }]}
            numberOfLines={2}
          >
            {dropoff}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  timeline: { width: 16, alignItems: 'center', paddingTop: 3 },
  pickupHalo: {
    width: 23,
    height: 23,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(14,122,68,0.15)',
  },
  pickupDot: { width: 15, height: 15, borderRadius: 8, backgroundColor: '#0E7A44' },
  line: { flex: 1, width: 2, backgroundColor: '#E5E0D2', marginVertical: 4, minHeight: 18 },
  dropDot: { width: 15, height: 15, borderRadius: 4, backgroundColor: '#17241C' },
  texts: { flex: 1, marginLeft: 14, justifyContent: 'center' },
  label: {
    fontFamily: FONT.disp,
    fontSize: 9.5,
    letterSpacing: 1.7,
    color: '#9A9384',
    marginBottom: 4,
  },
  addr: { fontFamily: FONT.disp, letterSpacing: -0.45, color: '#17241C' },
});
