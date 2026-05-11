import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  FlatList,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import { Button } from '@/components/ui';
import { Map } from '@/components/map/Map';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { LatLng } from '@/types';
import { parseLocationUrl, isShortLocationUrl } from '@/utils/parseLocation';
import {
  reverseGeocode,
  searchAddresses,
  GeocodeSuggestion,
} from '@/utils/geocode';
import { DEFAULT_MAP_REGION } from '@/utils/geo';
import { useDeliveryStore } from '@/stores/delivery.store';
import { useLocationStore } from '@/stores/location.store';
import {
  useAddressFavoritesStore,
  AddressFavorite,
} from '@/stores/addressFavorites.store';

const DEBOUNCE_MS = 250;

/**
 * Categories de lieux populaires : la frappe d'une chip prefill la recherche
 * avec le mot-cle correspondant + bias GPS pour proposer les plus proches.
 */
const CATEGORIES: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'restaurant', label: 'Restaurant', icon: 'restaurant-outline' },
  { key: 'pharmacy', label: 'Pharmacie', icon: 'medkit-outline' },
  { key: 'bank', label: 'Banque', icon: 'card-outline' },
  { key: 'marché', label: 'Marché', icon: 'storefront-outline' },
  { key: 'école', label: 'École', icon: 'school-outline' },
  { key: 'station', label: 'Station', icon: 'car-outline' },
];

export default function AddressPickerScreen() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type: 'pickup' | 'delivery' }>();
  const isPickup = type === 'pickup';

  const { draft, setDraftField } = useDeliveryStore();
  const userLocation = useLocationStore((s) => s.current);
  const countryCode = useLocationStore((s) => s.countryCode);
  const getCenter = useLocationStore((s) => s.getCenterOrFallback);

  const favorites = useAddressFavoritesStore((s) => s.favorites);
  const upsertFavoriteByKind = useAddressFavoritesStore((s) => s.upsertByKind);
  const addFavorite = useAddressFavoritesStore((s) => s.add);

  const initialAddress = isPickup ? draft.pickupAddress : draft.deliveryAddress;
  const initialLocation = isPickup
    ? draft.pickupLocation
    : draft.deliveryLocation;
  const initialDetails = isPickup ? draft.pickupDetails : draft.deliveryDetails;

  const [query, setQuery] = useState(initialAddress ?? '');
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<null | 'gps' | 'paste'>(null);
  const [pickedLocation, setPickedLocation] = useState<LatLng | null>(
    initialLocation ?? null,
  );
  const [pickedLabel, setPickedLabel] = useState<string>(initialAddress ?? '');
  const [details, setDetails] = useState<string>(initialDetails ?? '');
  const [showDetailsField, setShowDetailsField] = useState<boolean>(
    !!initialDetails,
  );
  const [showMap, setShowMap] = useState(false);
  const [mapLocation, setMapLocation] = useState<LatLng>(
    initialLocation ?? userLocation ?? DEFAULT_MAP_REGION,
  );
  const [saveFavoriteModal, setSaveFavoriteModal] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);
  const skipNextSearchRef = useRef(false);

  // Autofocus la recherche au montage
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []);

  // Recherche autocomplete debounced
  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const q = query.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await searchAddresses(
          q,
          userLocation ?? getCenter(),
          countryCode,
        );
        setSuggestions(r);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  /** Valide la position choisie, met a jour le draft et ferme l'ecran. */
  const finalizeSelection = (
    loc: LatLng,
    label: string,
    detailsValue: string,
  ) => {
    if (isPickup) {
      setDraftField('pickupAddress', label.trim() || 'Position choisie');
      setDraftField('pickupLocation', loc);
      setDraftField('pickupDetails', detailsValue.trim() || undefined);
    } else {
      setDraftField('deliveryAddress', label.trim() || 'Position choisie');
      setDraftField('deliveryLocation', loc);
      setDraftField('deliveryDetails', detailsValue.trim() || undefined);
    }
    router.back();
  };

  /** Quand on clique sur une suggestion : on prerempli mais on attend la confirmation pour permettre la saisie d'une indication. */
  const handleSelect = (s: GeocodeSuggestion) => {
    skipNextSearchRef.current = true;
    setPickedLocation(s.location);
    setPickedLabel(s.shortName);
    setQuery(s.shortName);
    setSuggestions([]);
  };

  const handleUseGps = async () => {
    setBusy('gps');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission refusée',
          "Activez la localisation dans les paramètres.",
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      const loc = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      const readable = await reverseGeocode(loc);
      const label = readable || 'Ma position actuelle';
      skipNextSearchRef.current = true;
      setPickedLocation(loc);
      setPickedLabel(label);
      setQuery(label);
      setSuggestions([]);
    } catch {
      Alert.alert('Erreur', 'Impossible de récupérer votre position.');
    } finally {
      setBusy(null);
    }
  };

  const handlePasteWhatsApp = async () => {
    setBusy('paste');
    try {
      const text = await Clipboard.getStringAsync();
      if (!text) {
        Alert.alert(
          'Presse-papiers vide',
          "Ouvrez WhatsApp, copiez une position partagée, puis revenez ici.",
        );
        return;
      }
      if (isShortLocationUrl(text)) {
        Alert.alert(
          'Lien raccourci',
          "Ouvrez le lien dans votre navigateur puis copiez l'URL complète.",
        );
        return;
      }
      const parsed = parseLocationUrl(text);
      if (!parsed) {
        Alert.alert(
          'Lien invalide',
          "Ce lien ne contient pas de coordonnées GPS lisibles.",
        );
        return;
      }
      const readable = await reverseGeocode(parsed);
      const label = readable || 'Position partagée (WhatsApp)';
      skipNextSearchRef.current = true;
      setPickedLocation(parsed);
      setPickedLabel(label);
      setQuery(label);
      setSuggestions([]);
    } finally {
      setBusy(null);
    }
  };

  const openMap = () => {
    setMapLocation(pickedLocation || userLocation || DEFAULT_MAP_REGION);
    setShowMap(true);
  };

  const confirmMapLocation = async () => {
    setShowMap(false);
    const readable = await reverseGeocode(mapLocation);
    const label = readable || 'Position choisie sur la carte';
    skipNextSearchRef.current = true;
    setPickedLocation(mapLocation);
    setPickedLabel(label);
    setQuery(label);
    setSuggestions([]);
  };

  const handlePickFavorite = (f: AddressFavorite) => {
    skipNextSearchRef.current = true;
    setPickedLocation(f.location);
    setPickedLabel(f.label);
    setQuery(f.label);
    setSuggestions([]);
    if (f.details) {
      setDetails(f.details);
      setShowDetailsField(true);
    }
  };

  const handleCategoryPress = (cat: typeof CATEGORIES[number]) => {
    setQuery(cat.label.toLowerCase());
    inputRef.current?.focus();
  };

  const handleConfirm = () => {
    if (!pickedLocation) {
      Alert.alert(
        'Position manquante',
        "Choisissez une adresse, utilisez 'Ma position', 'Carte' ou un favori.",
      );
      return;
    }
    finalizeSelection(pickedLocation, pickedLabel || query, details);
  };

  const saveAsFavorite = (kind: 'home' | 'work' | 'custom', label?: string) => {
    if (!pickedLocation) return;
    const finalLabel =
      kind === 'home' ? 'Maison' : kind === 'work' ? 'Bureau' : label || pickedLabel;
    if (kind === 'custom') {
      addFavorite({
        kind: 'custom',
        label: finalLabel,
        address: pickedLabel,
        location: pickedLocation,
        details: details.trim() || undefined,
      });
    } else {
      upsertFavoriteByKind({
        kind,
        label: finalLabel,
        address: pickedLabel,
        location: pickedLocation,
        details: details.trim() || undefined,
      });
    }
    setSaveFavoriteModal(false);
    Alert.alert('Enregistré', `Adresse sauvegardée comme « ${finalLabel} »`);
  };

  // Tri favoris : Maison et Bureau en premier (pinned), puis customs récents
  const sortedFavorites = useMemo(() => {
    const home = favorites.find((f) => f.kind === 'home');
    const work = favorites.find((f) => f.kind === 'work');
    const customs = favorites.filter((f) => f.kind === 'custom');
    return [
      ...(home ? [home] : []),
      ...(work ? [work] : []),
      ...customs.slice(0, 4),
    ];
  }, [favorites]);

  const showSuggestions = suggestions.length > 0 || loading;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isPickup ? 'Point de récupération' : "Point de livraison"}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Bouton principal carte — la plupart des users BF preferent la carte au texte */}
        <TouchableOpacity style={styles.mapPrimaryBtn} onPress={openMap} activeOpacity={0.9}>
          <Ionicons name="map" size={22} color={colors.white} />
          <Text style={styles.mapPrimaryBtnText}>Sélectionner sur la carte</Text>
        </TouchableOpacity>

        {/* Section principale */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.sectionDot,
                { backgroundColor: isPickup ? colors.primary : colors.secondary },
              ]}
            />
            <Text style={styles.sectionTitle}>
              {isPickup ? 'Adresse de récupération' : "Adresse de livraison"}
            </Text>
          </View>

          {/* Ma position actuelle */}
          {isPickup ? (
            <Pressable
              style={({ pressed }) => [
                styles.actionCard,
                pressed && { backgroundColor: colors.background },
              ]}
              onPress={handleUseGps}
              disabled={busy === 'gps'}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.primaryLight }]}>
                {busy === 'gps' ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="locate" size={20} color={colors.primary} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionTitle}>Ma position actuelle</Text>
                <Text style={styles.actionHint}>Utiliser le GPS du téléphone</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
            </Pressable>
          ) : null}

          {/* Search input */}
          <View style={styles.inputBox}>
            <Ionicons name="search" size={18} color={colors.textTertiary} />
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Rue, quartier, lieu, boutique..."
              placeholderTextColor={colors.textTertiary}
              value={query}
              onChangeText={(t) => {
                setQuery(t);
                // Si l'utilisateur modifie le texte, on invalide la position picked
                if (pickedLocation && t !== pickedLabel) {
                  setPickedLocation(null);
                  setPickedLabel('');
                }
              }}
              autoCorrect={false}
              autoCapitalize="sentences"
              returnKeyType="search"
            />
            {loading ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : query ? (
              <TouchableOpacity
                onPress={() => {
                  setQuery('');
                  setSuggestions([]);
                  setPickedLocation(null);
                  setPickedLabel('');
                  inputRef.current?.focus();
                }}
                hitSlop={10}
              >
                <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Chips categories */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.key}
                style={styles.chip}
                onPress={() => handleCategoryPress(c)}
                activeOpacity={0.7}
              >
                <Ionicons name={c.icon} size={14} color={colors.textSecondary} />
                <Text style={styles.chipText}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Suggestions inline */}
          {showSuggestions ? (
            <View style={styles.suggestionsBox}>
              {loading ? (
                <View style={{ padding: spacing.md, alignItems: 'center' }}>
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : null}
              {suggestions.map((s, i) => (
                <Pressable
                  key={`${s.location.latitude}-${s.location.longitude}-${i}`}
                  onPress={() => handleSelect(s)}
                  style={({ pressed }) => [
                    styles.suggestionRow,
                    pressed && { backgroundColor: colors.background },
                  ]}
                >
                  <View style={styles.suggestionIcon}>
                    <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.suggestionPrimary} numberOfLines={1}>
                      {s.shortName}
                    </Text>
                    <Text style={styles.suggestionSecondary} numberOfLines={1}>
                      {s.displayName}
                    </Text>
                    {!s.isPrecise ? (
                      <View style={styles.imprecise}>
                        <Ionicons name="alert-circle" size={12} color={colors.warning} />
                        <Text style={styles.impreciseText}>Zone large — précisez si possible</Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {/* Lien WhatsApp / Coller */}
        <TouchableOpacity style={styles.inlineBtn} onPress={handlePasteWhatsApp} disabled={busy === 'paste'}>
          {busy === 'paste' ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="link-outline" size={18} color={colors.primary} />
          )}
          <Text style={styles.inlineBtnText}>Coller un lien Google Maps / WhatsApp</Text>
        </TouchableOpacity>

        {/* Indication d'accès */}
        {showDetailsField ? (
          <View style={styles.card}>
            <Text style={styles.detailsLabel}>Indication d'accès</Text>
            <TextInput
              style={styles.detailsInput}
              placeholder="Ex: Porte rouge, 2e étage, à côté du marché..."
              placeholderTextColor={colors.textTertiary}
              value={details}
              onChangeText={setDetails}
              multiline
              numberOfLines={2}
              maxLength={200}
            />
          </View>
        ) : (
          <TouchableOpacity
            style={styles.inlineBtn}
            onPress={() => setShowDetailsField(true)}
          >
            <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
            <Text style={styles.inlineBtnText}>Ajouter une indication d'accès</Text>
          </TouchableOpacity>
        )}

        {/* Mes adresses favorites */}
        {sortedFavorites.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Mes adresses</Text>
            {sortedFavorites.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => handlePickFavorite(f)}
                style={({ pressed }) => [
                  styles.favRow,
                  pressed && { backgroundColor: colors.background },
                ]}
              >
                <View style={styles.favIcon}>
                  <Ionicons
                    name={
                      f.kind === 'home'
                        ? 'home-outline'
                        : f.kind === 'work'
                          ? 'briefcase-outline'
                          : 'bookmark-outline'
                    }
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.favLabel}>{f.label}</Text>
                  <Text style={styles.favAddress} numberOfLines={1}>
                    {f.address}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {/* Sauver comme favori (si position picked) */}
        {pickedLocation ? (
          <TouchableOpacity
            style={styles.inlineBtn}
            onPress={() => setSaveFavoriteModal(true)}
          >
            <Ionicons name="bookmark-outline" size={18} color={colors.primary} />
            <Text style={styles.inlineBtnText}>Enregistrer cette adresse</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      {/* Footer confirm */}
      <View style={styles.footer}>
        <Button
          title="Confirmer cette adresse"
          onPress={handleConfirm}
          disabled={!pickedLocation}
        />
      </View>

      {/* Modal carte */}
      <Modal visible={showMap} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowMap(false)} hitSlop={10}>
              <Ionicons name="close" size={26} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Pointer sur la carte</Text>
            <View style={{ width: 26 }} />
          </View>
          <Text style={styles.modalHint}>Tapez sur la carte pour placer le repère</Text>
          <Map
            center={mapLocation}
            zoom={14}
            markers={[
              {
                id: 'target',
                coordinate: mapLocation,
                icon: isPickup ? 'pickup' : 'delivery',
              },
            ]}
            onPress={(coord) => setMapLocation(coord)}
            style={styles.map}
          />
          <View style={styles.modalFooter}>
            <Button title="Confirmer cette position" onPress={confirmMapLocation} />
          </View>
        </View>
      </Modal>

      {/* Modal "Enregistrer comme..." */}
      <Modal visible={saveFavoriteModal} transparent animationType="fade">
        <Pressable
          style={styles.saveOverlay}
          onPress={() => setSaveFavoriteModal(false)}
        >
          <Pressable style={styles.saveSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.saveTitle}>Enregistrer comme</Text>
            <SaveOption icon="home-outline" label="Maison" onPress={() => saveAsFavorite('home')} />
            <SaveOption icon="briefcase-outline" label="Bureau" onPress={() => saveAsFavorite('work')} />
            <SaveOption
              icon="bookmark-outline"
              label="Autre..."
              onPress={() => {
                Alert.prompt?.(
                  'Nom du favori',
                  'Ex: Mama, Salle de sport, École des enfants',
                  (text) => {
                    if (text?.trim()) saveAsFavorite('custom', text.trim());
                  },
                ) ?? saveAsFavorite('custom', pickedLabel);
              }}
            />
            <Button
              title="Annuler"
              variant="outline"
              onPress={() => setSaveFavoriteModal(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function SaveOption({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.saveOption,
        pressed && { backgroundColor: colors.background },
      ]}
    >
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.saveOptionText}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </Pressable>
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
  },
  headerBtn: { padding: 4 },
  headerTitle: { ...typography.bodyMedium, color: colors.textPrimary, fontWeight: '700' },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },

  mapPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.secondary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    shadowColor: colors.secondary,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  mapPrimaryBtnText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },

  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },

  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight + '40',
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: { ...typography.bodyMedium, color: colors.textPrimary, fontWeight: '600' },
  actionHint: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    height: 44,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  input: { flex: 1, ...typography.body, color: colors.textPrimary, padding: 0 },

  chipsRow: { gap: spacing.xs, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipText: { ...typography.caption, color: colors.textPrimary, fontWeight: '600' },

  suggestionsBox: {
    marginTop: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  suggestionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  suggestionPrimary: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  suggestionSecondary: { ...typography.caption, color: colors.textSecondary },
  imprecise: { flexDirection: 'row', gap: 4, alignItems: 'center', marginTop: 4 },
  impreciseText: { ...typography.caption, color: colors.warning, fontSize: 11 },

  inlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
  },
  inlineBtnText: { ...typography.bodySmall, color: colors.primary, fontWeight: '600' },

  detailsLabel: { ...typography.bodySmall, color: colors.textPrimary, fontWeight: '600' },
  detailsInput: {
    ...typography.body,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    minHeight: 60,
    textAlignVertical: 'top',
    backgroundColor: colors.background,
  },

  favRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  favIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favLabel: { ...typography.bodyMedium, color: colors.textPrimary, fontWeight: '600' },
  favAddress: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },

  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },

  modalContainer: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  modalTitle: { ...typography.bodyMedium, color: colors.textPrimary, fontWeight: '700' },
  modalHint: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center' },
  map: { flex: 1, marginTop: spacing.sm },
  modalFooter: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },

  saveOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  saveSheet: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    gap: spacing.sm,
  },
  saveTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  saveOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
  },
  saveOptionText: { ...typography.bodyMedium, color: colors.textPrimary, flex: 1, fontWeight: '600' },
});
