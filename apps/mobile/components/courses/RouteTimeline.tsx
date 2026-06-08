import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { T, FONT } from './theme';

const RIDER = require('@/assets/images/rider/rider-avatar.png');

/**
 * Timeline récupération → livraison.
 * Colonne gauche : avatar livreur (nœud départ) · ligne pointillée · point d'arrivée.
 * Colonne droite : libellés + adresses.
 */
export function RouteTimeline({
  pickup,
  dropoff,
}: {
  pickup: string;
  dropoff: string;
}) {
  return (
    <View style={styles.row}>
      {/* timeline */}
      <View style={styles.timeline}>
        <View style={styles.avatarRing}>
          <Image source={RIDER} style={styles.avatar} />
        </View>
        <View style={styles.dashes}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={i} style={styles.dash} />
          ))}
        </View>
        <View style={styles.endDot} />
      </View>

      {/* textes */}
      <View style={styles.texts}>
        <Text style={styles.label}>RÉCUPÉRATION</Text>
        <Text style={styles.addr} numberOfLines={2}>
          {pickup}
        </Text>
        <View style={{ height: 14 }} />
        <Text style={styles.label}>LIVRAISON</Text>
        <Text style={styles.addr} numberOfLines={2}>
          {dropoff}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', marginTop: 16 },
  timeline: { width: 30, alignItems: 'center' },
  avatarRing: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: T.vivid,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.2)',
    shadowColor: T.vivid,
    shadowOpacity: 0.7,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  avatar: { width: 26, height: 26 },
  dashes: { flex: 1, alignItems: 'center', paddingVertical: 4, gap: 5 },
  dash: {
    width: 2,
    height: 4,
    borderRadius: 1,
    backgroundColor: 'rgba(0,230,118,0.6)',
  },
  endDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: T.white,
    shadowColor: T.white,
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  texts: { flex: 1, marginLeft: 12, justifyContent: 'space-between' },
  label: {
    fontFamily: FONT.bodyBold,
    fontSize: 10,
    letterSpacing: 1,
    color: T.routeMut,
    marginBottom: 3,
  },
  addr: { fontFamily: FONT.body, fontSize: 15, color: T.white, lineHeight: 19 },
});
