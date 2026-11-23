import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui';
import { colors, typography, spacing } from '@/theme';
import { SUPPORT_PHONE, SUPPORT_EMAIL, SUPPORT_WHATSAPP } from '@/config/support';

export default function SupportHubScreen() {
  const router = useRouter();

  // iOS renvoie souvent `canOpenURL(false)` a tort pour mailto:/tel:. On tente
  // openURL directement et on n'affiche le fallback que sur vraie erreur.
  const openUrl = async (url: string, fallbackMessage: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Action impossible', fallbackMessage);
    }
  };

  const callSupport = () => openUrl(`tel:${SUPPORT_PHONE}`, "Impossible d'ouvrir le composeur.");
  const emailSupport = () =>
    openUrl(
      // encodeURIComponent : le « é » de Toolé doit etre encode, sinon l'URL
      // mailto est invalide et l'app mail ne s'ouvre pas.
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Demande support Toolé')}`,
      "Impossible d'ouvrir l'application mail.",
    );
  const whatsappSupport = () => {
    const cleanNumber = SUPPORT_WHATSAPP.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent("Bonjour, j'ai besoin d'aide avec l'application Toolé.")}`;
    openUrl(url, "Impossible d'ouvrir WhatsApp.");
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Aide & support</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Contact direct */}
        <Text style={styles.sectionTitle}>Nous contacter</Text>
        <Card style={styles.card}>
          <TouchableOpacity style={styles.row} onPress={whatsappSupport} activeOpacity={0.6}>
            <View style={[styles.iconBubble, { backgroundColor: '#25D366' }]}>
              <Ionicons name="logo-whatsapp" size={22} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>WhatsApp</Text>
              <Text style={styles.rowValue}>{SUPPORT_WHATSAPP}</Text>
              <Text style={styles.rowHint}>Le plus rapide pour nous joindre</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity style={styles.row} onPress={callSupport} activeOpacity={0.6}>
            <View style={[styles.iconBubble, { backgroundColor: colors.primary }]}>
              <Ionicons name="call" size={22} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Téléphone</Text>
              <Text style={styles.rowValue}>{SUPPORT_PHONE}</Text>
              <Text style={styles.rowHint}>Du lundi au samedi 8h - 19h</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity style={styles.row} onPress={emailSupport} activeOpacity={0.6}>
            <View style={[styles.iconBubble, { backgroundColor: '#6366f1' }]}>
              <Ionicons name="mail" size={22} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Email</Text>
              <Text style={styles.rowValue}>{SUPPORT_EMAIL}</Text>
              <Text style={styles.rowHint}>Réponse sous 24-48h</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        </Card>

        {/* Demandes / réclamations */}
        <Text style={styles.sectionTitle}>Mes demandes</Text>
        <Card style={styles.card}>
          <TouchableOpacity
            style={styles.rowSimple}
            onPress={() => router.push('/support' as any)}
            activeOpacity={0.6}
          >
            <Ionicons name="create-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.rowSimpleLabel}>Envoyer une demande</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.rowSimple}
            onPress={() => router.push('/support-tickets' as any)}
            activeOpacity={0.6}
          >
            <Ionicons name="file-tray-full-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.rowSimpleLabel}>Suivre mes demandes</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </TouchableOpacity>
        </Card>
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
  headerTitle: { ...typography.bodyMedium, color: colors.textPrimary, fontWeight: '700' },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  sectionTitle: {
    ...typography.captionMedium,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.md,
    marginLeft: spacing.xs,
  },
  card: { padding: 0, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    ...typography.captionMedium,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rowValue: { ...typography.bodyMedium, color: colors.textPrimary, fontWeight: '700', marginTop: 2 },
  rowHint: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: 16 + 44 + 16 },
  rowSimple: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  rowSimpleLabel: { ...typography.body, color: colors.textPrimary, flex: 1 },
});
