import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { recap as R, shipments as S } from '@/theme/recapTokens';

/** Motif billet compact : point vert (départ) → pointillé → carré sombre (arrivée). */
export function RouteMini({ pickup, dropoff }: { pickup: string; dropoff: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <View style={styles.dot} />
        <View style={styles.dashCol}>
          {Array.from({ length: 3 }).map((_, i) => (
            <View key={i} style={styles.dash} />
          ))}
        </View>
        <View style={styles.square} />
      </View>
      <View style={styles.labels}>
        <Text style={styles.addr} numberOfLines={1}>{pickup}</Text>
        <View style={{ height: 10 }} />
        <Text style={styles.addr} numberOfLines={1}>{dropoff}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: R.space.md },
  rail: { width: 12, alignItems: 'center', paddingTop: 4 },
  dot: { width: 11, height: 11, borderRadius: 6, backgroundColor: S.routeDot },
  dashCol: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 3 },
  dash: { width: 2, height: 3, borderRadius: 1, backgroundColor: S.dash },
  square: { width: 11, height: 11, borderRadius: 3, backgroundColor: S.routeSquare },
  labels: { flex: 1 },
  addr: { fontFamily: R.font.bodyBold, fontSize: 13.5, color: S.textPrim },
});
