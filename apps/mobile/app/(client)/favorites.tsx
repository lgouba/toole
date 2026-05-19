import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '@/components/ui';
import { colors, typography, spacing, borderRadius } from '@/theme';
import {
  useAddressFavoritesStore,
  type AddressFavorite,
} from '@/stores/addressFavorites.store';

/**
 * Page de gestion des adresses favorites du client.
 *
 * Permet de voir l'integralite des favoris, supprimer, et lancer l'ajout
 * d'un nouveau (qui redirige vers address-picker en mode "save favorite").
 *
 * Les favoris sont stockes en local (AsyncStorage), pas synchronises au
 * backend pour l'instant.
 */
export default function FavoritesScreen() {
  const router = useRouter();
  const favorites = useAddressFavoritesStore((s) => s.favorites);
  const removeFavorite = useAddressFavoritesStore((s) => s.remove);

  // Tri : Maison + Bureau en premier (pinned), puis customs par date desc
  const sortedFavorites = (() => {
    const home = favorites.find((f) => f.kind === 'home');
    const work = favorites.find((f) => f.kind === 'work');
    const customs = favorites
      .filter((f) => f.kind === 'custom')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return [
      ...(home ? [home] : []),
      ...(work ? [work] : []),
      ...customs,
    ];
  })();

  const handleDelete = (fav: AddressFavorite) => {
    Alert.alert(
      'Supprimer cette adresse ?',
      `"${fav.label}" sera retirée de vos favoris.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => removeFavorite(fav.id),
        },
      ],
    );
  };

  const getIcon = (kind: AddressFavorite['kind']) => {
    if (kind === 'home') return 'home';
    if (kind === 'work') return 'business';
    return 'bookmark';
  };

  const getColor = (kind: AddressFavorite['kind']) => {
    if (kind === 'home') return colors.primary;
    if (kind === 'work') return '#6366f1';
    return colors.secondary;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mes adresses</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {sortedFavorites.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons
                name="bookmark-outline"
                size={48}
                color={colors.primary}
              />
            </View>
            <Text style={styles.emptyTitle}>Aucune adresse enregistrée</Text>
            <Text style={styles.emptyText}>
              Lorsque vous créez une livraison, vous pouvez enregistrer une
              adresse comme Maison, Bureau ou un favori personnalisé.
              Vous les retrouverez ici.
            </Text>
            <TouchableOpacity
              style={styles.ctaBtn}
              onPress={() => router.replace('/(client)/new-delivery')}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={20} color={colors.white} />
              <Text style={styles.ctaText}>Créer une livraison</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.sectionHint}>
              Sauvegardez vos adresses fréquentes pour aller plus vite lors de
              vos commandes.
            </Text>
            <Card style={styles.card}>
              {sortedFavorites.map((fav, i) => (
                <View key={fav.id}>
                  <View style={styles.row}>
                    <View
                      style={[
                        styles.iconBubble,
                        { backgroundColor: getColor(fav.kind) },
                      ]}
                    >
                      <Ionicons
                        name={getIcon(fav.kind)}
                        size={20}
                        color={colors.white}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowLabel}>{fav.label}</Text>
                      <Text style={styles.rowAddress} numberOfLines={2}>
                        {fav.address}
                      </Text>
                      {fav.details ? (
                        <Text style={styles.rowDetails}>{fav.details}</Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      onPress={() => handleDelete(fav)}
                      style={styles.deleteBtn}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={20}
                        color={colors.error}
                      />
                    </TouchableOpacity>
                  </View>
                  {i < sortedFavorites.length - 1 && (
                    <View style={styles.separator} />
                  )}
                </View>
              ))}
            </Card>

            <Text style={styles.helper}>
              💡 Pour ajouter une adresse, créez une livraison et appuyez sur
              "Enregistrer comme favori".
            </Text>
          </>
        )}
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
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  rowAddress: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rowDetails: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
    fontStyle: 'italic',
  },
  deleteBtn: {
    padding: spacing.xs,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 16 + 40 + 16,
  },
  helper: {
    ...typography.caption,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  ctaText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '700',
  },
});
