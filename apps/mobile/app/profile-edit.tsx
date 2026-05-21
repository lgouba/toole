import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Avatar, Button, Input } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/services/api.client';
import { uploadImage, resolveUploadUrl } from '@/services/upload.service';
import { formatPhone } from '@/utils/format';

/**
 * Formate une date ISO (YYYY-MM-DD ou ISO complete) en JJ/MM/AAAA pour
 * affichage humain. Renvoie '-' si la date est invalide ou absente.
 */
function formatDateOfBirth(iso?: string | null): string {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day} / ${month} / ${year}`;
}

export default function ProfileEditScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuthStore();
  const [email, setEmail] = useState(user?.email ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  if (!user) return null;

  // Le nom complet a afficher : prend firstName + lastName si dispo, sinon
  // fallback sur le fullName historique.
  const displayName =
    user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.fullName;

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', "Autorisez l'accès à la galerie.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (res.canceled || !res.assets[0]) return;

    setUploadingAvatar(true);
    const uploaded = await uploadImage(res.assets[0].uri, 'avatars');
    setUploadingAvatar(false);
    if (uploaded) {
      setAvatarUrl(uploaded.url);
    } else {
      Alert.alert('Erreur', "Upload de l'avatar échoué.");
    }
  };

  const handleSave = async () => {
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      Alert.alert('Email invalide', 'Entrez une adresse email valide.');
      return;
    }
    setSaving(true);
    try {
      // Seuls email + avatar sont modifiables ici. Prenom/Nom/DDN/Tel
      // sont figes : modifier ces infos necessite de contacter le support
      // (validation manuelle, evite usurpation).
      await api.put('/users/me', {
        email: email.trim() || null,
        avatarUrl: avatarUrl ?? null,
      });
      await refreshUser();
      Alert.alert('Profil enregistré', undefined, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? "Échec de l'enregistrement.";
      Alert.alert('Erreur', msg);
    } finally {
      setSaving(false);
    }
  };

  const resolvedAvatar = resolveUploadUrl(avatarUrl);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Modifier le profil</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.avatarWrap} onPress={pickAvatar} activeOpacity={0.7}>
          {uploadingAvatar ? (
            <View style={styles.avatarLoader}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <Avatar name={displayName} uri={resolvedAvatar ?? undefined} size="xl" />
          )}
          <View style={styles.cameraBadge}>
            <Ionicons name="camera" size={18} color={colors.white} />
          </View>
        </TouchableOpacity>

        <Text style={styles.nameDisplay}>{displayName}</Text>
        <Text style={styles.phoneDisplay}>{formatPhone(user.phone)}</Text>
        <Text style={styles.phoneHint}>
          Ces informations ne peuvent pas être modifiées
        </Text>

        <View style={{ height: spacing.lg }} />

        {/* Bloc INFOS PERSONNELLES (read-only) */}
        <View style={styles.readOnlyCard}>
          <ReadOnlyRow
            icon="person-outline"
            label="Prénom"
            value={user.firstName ?? '-'}
          />
          <View style={styles.divider} />
          <ReadOnlyRow
            icon="person-outline"
            label="Nom"
            value={user.lastName ?? '-'}
          />
          <View style={styles.divider} />
          <ReadOnlyRow
            icon="calendar-outline"
            label="Date de naissance"
            value={formatDateOfBirth(user.dateOfBirth)}
          />
          <View style={styles.divider} />
          <ReadOnlyRow
            icon="call-outline"
            label="Téléphone"
            value={formatPhone(user.phone)}
          />
        </View>

        <Text style={styles.sectionLabel}>
          Email (modifiable) *
        </Text>
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="vous@exemple.com"
        />
        <Text style={styles.emailHint}>
          Cet email peut être utilisé pour recevoir le code de connexion à la
          place du téléphone.
        </Text>

        <View style={{ height: spacing.xl }} />
        <Button title="Enregistrer" onPress={handleSave} loading={saving} />

        <Text style={styles.supportHint}>
          Besoin de modifier d'autres informations (nom, téléphone) ? Contactez
          le support depuis la page À propos.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ReadOnlyRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.readOnlyRow}>
      <Ionicons name={icon} size={20} color={colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.readOnlyLabel}>{label}</Text>
        <Text style={styles.readOnlyValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.bodyMedium, color: colors.textPrimary, fontWeight: '700' },
  content: { padding: spacing.lg },
  avatarWrap: {
    alignSelf: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  avatarLoader: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  nameDisplay: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontWeight: '800',
  },
  phoneDisplay: {
    ...typography.body,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: 2,
    fontWeight: '600',
  },
  phoneHint: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 4,
  },
  // ============== Read-only infos ==============
  readOnlyCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  readOnlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  readOnlyLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  readOnlyValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionLabel: {
    ...typography.captionMedium,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  emailHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  supportHint: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    lineHeight: 18,
  },
});
