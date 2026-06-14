import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts';
import { colors, typography, spacing, borderRadius } from '@/theme';

interface Item {
  id: string;
  name: string;
  phone: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick: (contact: { name: string; phone: string }) => void;
  title?: string;
}

/**
 * Modal plein écran qui liste les contacts du téléphone avec recherche.
 * Fonctionne sur iOS + Android (pas de dependance au picker natif iOS qui
 * varie selon version).
 */
export function ContactPickerModal({
  visible,
  onClose,
  onPick,
  title = 'Choisir un contact',
}: Props) {
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<Item[]>([]);
  const [query, setQuery] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setPermissionDenied(false);
      try {
        const { status } = await Contacts.requestPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) {
            setPermissionDenied(true);
            setLoading(false);
          }
          return;
        }
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
        });
        const items: Item[] = data
          .filter((c) => (c.phoneNumbers ?? []).length > 0)
          .map((c) => {
            const phones = c.phoneNumbers ?? [];
            const mobile = phones.find((p) => /mobile|cell/i.test(p.label ?? ''));
            const raw =
              mobile?.number ?? phones[0]?.number ?? '';
            return {
              id: c.id ?? Math.random().toString(36),
              name: c.name ?? c.firstName ?? '(sans nom)',
              phone: cleanPhone(raw),
            };
          })
          .filter((c) => c.phone.length >= 6)
          // Trie alphabétique
          .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
        if (!cancelled) setContacts(items);
      } catch (err) {
        console.warn('[ContactPickerModal] fetch failed', err);
        if (!cancelled) {
          Alert.alert('Erreur', 'Impossible de lire les contacts.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.phone.includes(q),
    );
  }, [contacts, query]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      {/* SafeAreaProvider OBLIGATOIRE ici : un Modal RN s'affiche hors de l'arbre
          React, donc le SafeAreaProvider racine n'est pas accessible → sans lui,
          SafeAreaView ne reçoit aucun inset et l'en-tête (avec la croix) passe
          SOUS la barre de statut/encoche → croix intappable. */}
      <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 24 }}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={26} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>{title}</Text>
          <View style={{ width: 26 }} />
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            placeholder="Rechercher un contact..."
            placeholderTextColor={colors.textTertiary}
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
            autoCorrect={false}
            autoFocus
          />
          {query ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}>
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {permissionDenied ? (
          <View style={styles.empty}>
            <Ionicons name="lock-closed-outline" size={48} color={colors.textTertiary} />
            <Text style={styles.emptyTitle}>Accès refusé</Text>
            <Text style={styles.emptyHint}>
              Autorisez l'accès aux contacts dans les paramètres du téléphone pour
              utiliser cette fonctionnalité.
            </Text>
            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={() => Linking.openSettings()}
            >
              <Ionicons name="settings-outline" size={18} color={colors.primary} />
              <Text style={styles.settingsBtnText}>Ouvrir les réglages</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.closeLink}
              onPress={onClose}
              hitSlop={10}
            >
              <Text style={styles.closeLinkText}>Saisir le numéro manuellement</Text>
            </TouchableOpacity>
          </View>
        ) : loading ? (
          <View style={styles.empty}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.xl }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={48} color={colors.textTertiary} />
                <Text style={styles.emptyTitle}>Aucun contact</Text>
                <Text style={styles.emptyHint}>
                  {query ? "Aucun résultat pour cette recherche." : "Votre carnet est vide."}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => onPick({ name: item.name, phone: item.phone })}
                style={styles.row}
                activeOpacity={0.7}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowName}>{item.name}</Text>
                  <Text style={styles.rowPhone}>{formatPhone(item.phone)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

function cleanPhone(raw: string): string {
  return raw.replace(/[^0-9+]/g, '');
}

function formatPhone(raw: string): string {
  // Affichage simple par paires : +226 70 12 34 56 → fonctionne sur tout numéro
  const digits = raw.replace(/\D/g, '');
  if (!digits) return raw;
  let formatted = raw.startsWith('+') ? '+' : '';
  // Si commence par 226/233/etc on extrait le pays
  if (digits.length > 8) {
    const country = digits.slice(0, digits.length - 8);
    const local = digits.slice(digits.length - 8);
    formatted += country + ' ' + local.match(/.{1,2}/g)?.join(' ');
  } else {
    formatted += digits.match(/.{1,2}/g)?.join(' ') ?? digits;
  }
  return formatted;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  closeBtn: { padding: 4 },
  title: { ...typography.bodyMedium, color: colors.textPrimary, fontWeight: '700' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    paddingHorizontal: spacing.sm,
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.textPrimary, padding: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '700',
  },
  rowName: { ...typography.bodyMedium, color: colors.textPrimary, fontWeight: '600' },
  rowPhone: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  empty: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    gap: spacing.sm,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  emptyHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    marginTop: spacing.md,
  },
  settingsBtnText: { ...typography.bodyMedium, color: colors.primary, fontWeight: '700' },
  closeLink: { paddingVertical: spacing.sm, marginTop: spacing.xs },
  closeLinkText: { ...typography.bodySmall, color: colors.textSecondary, textDecorationLine: 'underline' },
});
