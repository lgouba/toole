import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { recap as R, step3 as S } from '@/theme/recapTokens';

/** Bouton "Choisir depuis mes contacts" (ouvre le picker au niveau de l'écran). */
export function ContactsButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.btn} onPress={onPress} activeOpacity={0.85} accessibilityRole="button">
      <MaterialIcons name="contacts" size={18} color={S.contactsBtn.fg} />
      <Text style={styles.text}>Choisir depuis mes contacts</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: R.space.sm,
    height: 46,
    borderRadius: S.radius.field,
    backgroundColor: S.contactsBtn.bg,
    borderWidth: 1,
    borderColor: S.contactsBtn.border,
  },
  text: { fontFamily: R.font.bodyBold, fontSize: 13.5, color: S.contactsBtn.fg },
});
