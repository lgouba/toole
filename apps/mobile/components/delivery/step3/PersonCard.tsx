import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { recap as R, step3 as S } from '@/theme/recapTokens';
import { ContactsButton } from './ContactsButton';
import { PhoneField } from './PhoneField';

interface Props {
  variant: 'recipient' | 'holder';
  roleLabel: string;
  titleLabel: string;
  name: string;
  phone: string;
  onNameChange: (t: string) => void;
  onPhoneChange: (national: string) => void;
  onPickContact: () => void;
  namePlaceholder: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Carte "personne" réutilisable (destinataire / détenteur via variant). */
export function PersonCard({
  variant,
  roleLabel,
  titleLabel,
  name,
  phone,
  onNameChange,
  onPhoneChange,
  onPickContact,
  namePlaceholder,
}: Props) {
  const av = variant === 'recipient' ? S.avatarRecipient : S.avatarHolder;
  const ini = initials(name);
  const [nameFocus, setNameFocus] = useState(false);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: av.bg }]}>
          {ini ? (
            <Text style={[styles.initials, { color: av.fg }]}>{ini}</Text>
          ) : (
            <MaterialIcons
              name={variant === 'recipient' ? 'person' : 'inventory-2'}
              size={22}
              color={av.fg}
            />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.role, { color: av.fg }]}>{roleLabel}</Text>
          <Text style={styles.title}>{titleLabel}</Text>
        </View>
      </View>

      <ContactsButton onPress={onPickContact} />

      <Text style={styles.fieldLabel}>NOM</Text>
      <TextInput
        value={name}
        onChangeText={onNameChange}
        placeholder={namePlaceholder}
        placeholderTextColor={S.textMuted}
        style={[styles.input, nameFocus && styles.inputFocus]}
        onFocus={() => setNameFocus(true)}
        onBlur={() => setNameFocus(false)}
      />

      <Text style={styles.fieldLabel}>TÉLÉPHONE</Text>
      <PhoneField value={phone} onChange={onPhoneChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: S.surface,
    borderRadius: S.radius.card,
    borderWidth: 1,
    borderColor: S.border,
    padding: R.space.gut,
    gap: R.space.sm,
    ...R.shadow.card,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: R.space.md, marginBottom: R.space.xs },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: S.radius.avatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontFamily: R.font.displayXBold, fontSize: 17 },
  role: { fontFamily: R.font.mono, fontSize: 10, letterSpacing: 1.4 },
  title: { fontFamily: R.font.display, fontSize: 15, color: S.textPrim, marginTop: 1 },
  fieldLabel: {
    fontFamily: R.font.mono,
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: S.textMuted,
    marginTop: R.space.xs,
  },
  input: {
    height: 50,
    borderRadius: S.radius.field,
    borderWidth: 1.5,
    borderColor: S.border,
    backgroundColor: S.fieldBg,
    paddingHorizontal: R.space.lg,
    fontFamily: R.font.body,
    fontSize: 15,
    color: S.textPrim,
  },
  inputFocus: { borderColor: S.fieldFocus, backgroundColor: '#FFFFFF' },
});
