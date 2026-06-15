import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { recap as R, home as H } from '@/theme/recapTokens';

const STEPS: { icon: keyof typeof MaterialIcons.glyphMap; title: string; sub: string }[] = [
  { icon: 'inventory-2', title: 'Décris ton colis', sub: 'Taille et catégorie en quelques taps.' },
  { icon: 'route', title: 'Indique le trajet', sub: 'Point de récupération et de livraison.' },
  { icon: 'two-wheeler', title: "Un livreur s'en charge", sub: 'Suivi en direct jusqu’à la remise.' },
];

/** "Comment ça marche" — 3 étapes compactes. */
export function HowItWorks() {
  return (
    <View style={styles.wrap}>
      {STEPS.map((s, i) => (
        <View key={i} style={styles.row}>
          <View style={styles.iconWrap}>
            <MaterialIcons name={s.icon} size={18} color={H.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.sub}>{s.sub}</Text>
          </View>
          <Text style={styles.num}>{i + 1}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: R.space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: R.space.md },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: H.greenTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: R.font.bodyBold, fontSize: 13.5, color: H.textPrim },
  sub: { fontFamily: R.font.body, fontSize: 11.5, color: H.textMuted, marginTop: 1 },
  num: { fontFamily: R.font.mono, fontSize: 12, color: H.textMuted },
});
