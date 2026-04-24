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
import { api, unwrap } from '@/services/api.client';
import { uploadImage, resolveUploadUrl } from '@/services/upload.service';
import { formatPhone } from '@/utils/format';

export default function ProfileEditScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuthStore();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  if (!user) return null;

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Autorisez l\'acces a la galerie.');
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
      Alert.alert('Erreur', 'Upload de l\'avatar echoue.');
    }
  };

  const handleSave = async () => {
    if (fullName.trim().length < 2) {
      Alert.alert('Nom invalide', 'Le nom doit faire au moins 2 caracteres.');
      return;
    }
    setSaving(true);
    try {
      await api.put('/users/me', {
        fullName: fullName.trim(),
        email: email.trim() || null,
        avatarUrl: avatarUrl ?? null,
      });
      await refreshUser();
      Alert.alert('Profil enregistre', undefined, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? 'Échec de l\'enregistrement.';
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
            <Avatar name={fullName || user.fullName} uri={resolvedAvatar ?? undefined} size="xl" />
          )}
          <View style={styles.cameraBadge}>
            <Ionicons name="camera" size={18} color={colors.white} />
          </View>
        </TouchableOpacity>

        <Text style={styles.phoneDisplay}>{formatPhone(user.phone)}</Text>
        <Text style={styles.phoneHint}>Le numéro de téléphone ne peut pas etre modifie</Text>

        <View style={{ height: spacing.lg }} />

        <Input
          label="Nom complet"
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
          containerStyle={{ marginBottom: spacing.md }}
        />
        <Input
          label="Email (optionnel)"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="vous@exemple.com"
        />

        <View style={{ height: spacing.xl }} />
        <Button title="Enregistrer" onPress={handleSave} loading={saving} />
      </ScrollView>
    </SafeAreaView>
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
  headerTitle: { ...typography.bodyMedium, color: colors.textPrimary },
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
  phoneDisplay: {
    ...typography.body,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  phoneHint: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 2,
  },
});
