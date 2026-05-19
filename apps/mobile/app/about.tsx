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
import Constants from 'expo-constants';
import { Card } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';

// Coordonnees support : a centraliser ici, partage par toute l'app via
// import { SUPPORT_PHONE, SUPPORT_EMAIL, SUPPORT_WHATSAPP } from '@/app/about';
export const SUPPORT_PHONE = '+22670000000'; // TODO: remplacer par le vrai numero
export const SUPPORT_EMAIL = 'support@tolle.bf'; // TODO: vraie adresse
export const SUPPORT_WHATSAPP = '+22670000000'; // TODO: numero WhatsApp Business
export const PRIVACY_URL = 'https://tolle.qalitylabs.fr/privacy'; // TODO: vraie URL
export const TERMS_URL = 'https://tolle.qalitylabs.fr/terms'; // TODO: vraie URL

export default function AboutScreen() {
  const router = useRouter();

  const appVersion =
    Constants.expoConfig?.version ??
    (Constants.manifest as any)?.version ??
    '1.0.0';

  // Diagnostic OTA : ID du bundle JS actuellement charge + branche.
  // Permet de verifier si une OTA a bien ete appliquee (le `updateId` change
  // a chaque update). Un tap long sur la version copie ces infos dans le clipboard.
  const updates = (Constants.expoConfig as any)?.updates ?? {};
  const otaInfo = (() => {
    try {
      // expo-updates expose ces infos a runtime
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Updates = require('expo-updates') as typeof import('expo-updates');
      return {
        updateId: Updates.updateId ?? 'embedded',
        channel: Updates.channel ?? 'unknown',
        runtimeVersion: Updates.runtimeVersion ?? '?',
      };
    } catch {
      return { updateId: 'embedded', channel: 'dev', runtimeVersion: '?' };
    }
  })();

  const openUrl = async (url: string, fallbackMessage: string) => {
    try {
      const can = await Linking.canOpenURL(url);
      if (can) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Action impossible', fallbackMessage);
      }
    } catch {
      Alert.alert('Action impossible', fallbackMessage);
    }
  };

  const callSupport = () => openUrl(`tel:${SUPPORT_PHONE}`, 'Impossible d\'ouvrir le composeur.');
  const emailSupport = () =>
    openUrl(
      `mailto:${SUPPORT_EMAIL}?subject=Demande%20support%20Tollé`,
      "Impossible d'ouvrir l'application mail.",
    );
  const whatsappSupport = () => {
    const cleanNumber = SUPPORT_WHATSAPP.replace(/[^0-9]/g, '');
    const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent('Bonjour, j\'ai besoin d\'aide avec l\'application Tollé.')}`;
    openUrl(url, "Impossible d'ouvrir WhatsApp.");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>À propos</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>T</Text>
          </View>
          <Text style={styles.appName}>Tollé</Text>
          <Text style={styles.version}>Version {appVersion}</Text>
          <Text style={styles.tagline}>
            Service de livraison à domicile au Burkina Faso
          </Text>
        </View>

        {/* Support / Contact */}
        <Text style={styles.sectionTitle}>Besoin d'aide ?</Text>
        <Card style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={whatsappSupport}
            activeOpacity={0.6}
          >
            <View style={[styles.iconBubble, { backgroundColor: '#25D366' }]}>
              <Ionicons name="logo-whatsapp" size={22} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>WhatsApp</Text>
              <Text style={styles.rowValue}>{SUPPORT_WHATSAPP}</Text>
              <Text style={styles.rowHint}>
                Le plus rapide pour nous joindre
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textTertiary}
            />
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.row}
            onPress={callSupport}
            activeOpacity={0.6}
          >
            <View style={[styles.iconBubble, { backgroundColor: colors.primary }]}>
              <Ionicons name="call" size={22} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Téléphone</Text>
              <Text style={styles.rowValue}>{SUPPORT_PHONE}</Text>
              <Text style={styles.rowHint}>Du lundi au samedi 8h - 19h</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textTertiary}
            />
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.row}
            onPress={emailSupport}
            activeOpacity={0.6}
          >
            <View style={[styles.iconBubble, { backgroundColor: '#6366f1' }]}>
              <Ionicons name="mail" size={22} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Email</Text>
              <Text style={styles.rowValue}>{SUPPORT_EMAIL}</Text>
              <Text style={styles.rowHint}>Réponse sous 24-48h</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
        </Card>

        {/* Légal */}
        <Text style={styles.sectionTitle}>Informations légales</Text>
        <Card style={styles.card}>
          <TouchableOpacity
            style={styles.rowSimple}
            onPress={() => openUrl(TERMS_URL, 'Page indisponible.')}
            activeOpacity={0.6}
          >
            <Ionicons
              name="document-text-outline"
              size={20}
              color={colors.textSecondary}
            />
            <Text style={styles.rowSimpleLabel}>
              Conditions générales d'utilisation
            </Text>
            <Ionicons
              name="open-outline"
              size={16}
              color={colors.textTertiary}
            />
          </TouchableOpacity>

          <View style={styles.separator} />

          <TouchableOpacity
            style={styles.rowSimple}
            onPress={() => openUrl(PRIVACY_URL, 'Page indisponible.')}
            activeOpacity={0.6}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color={colors.textSecondary}
            />
            <Text style={styles.rowSimpleLabel}>
              Politique de confidentialité
            </Text>
            <Ionicons
              name="open-outline"
              size={16}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
        </Card>

        <View style={styles.footer}>
          <Text style={styles.footerText}>© 2026 Tollé · Tous droits réservés</Text>
          <Text style={styles.footerText}>Fait avec ❤️ au Burkina Faso</Text>
          {/* Diagnostic technique - en bas, discret. Utile pour verifier
              qu'une OTA s'est bien appliquee (l'updateId change a chaque update). */}
          <View style={styles.debugBlock}>
            <Text style={styles.debugLine}>
              Channel : {otaInfo.channel} · RT : {otaInfo.runtimeVersion}
            </Text>
            <Text style={styles.debugLine} numberOfLines={1}>
              Bundle : {otaInfo.updateId.slice(0, 16)}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.xs,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  logoText: {
    fontSize: 44,
    fontWeight: '900',
    color: colors.white,
  },
  appName: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  version: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  tagline: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 280,
  },
  sectionTitle: {
    ...typography.captionMedium,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.md,
    marginLeft: spacing.xs,
  },
  card: {
    padding: 0,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
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
  rowValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
    marginTop: 2,
  },
  rowHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 16 + 44 + 16, // align with text after the icon bubble
  },
  rowSimple: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  rowSimpleLabel: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.xl,
    gap: 4,
  },
  footerText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  debugBlock: {
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    gap: 2,
  },
  debugLine: {
    fontSize: 10,
    color: colors.textTertiary,
    fontFamily: 'monospace',
  },
});
