import React, { useEffect, useRef, useState } from 'react';
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
import { DEFAULT_MAP_REGION, OUAGADOUGOU_CENTER } from '@/utils/geo';
import { useDeliveryStore } from '@/stores/delivery.store';

const DEBOUNCE_MS = 250;

/**
 * Ecran plein ecran pour choisir une adresse (style Uber / Yango).
 *
 * Params:
 *   type = 'pickup' | 'delivery'
 *
 * Le composant lit le draft courant dans le store, propose les raccourcis
 * (ma position, WhatsApp, carte) et une recherche autocomplete. A la validation,
 * il met a jour le draft et revient au formulaire parent.
 */
export default function AddressPickerScreen() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type: 'pickup' | 'delivery' }>();
  const isPickup = type === 'pickup';

  const { draft, setDraftField } = useDeliveryStore();

  const initialAddress = isPickup ? draft.pickupAddress : draft.deliveryAddress;
  const initialLocation = isPickup
    ? draft.pickupLocation
    : draft.deliveryLocation;

  const [query, setQuery] = useState(initialAddress ?? '');
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<null | 'gps' | 'paste'>(null);
  const [pickedLocation, setPickedLocation] = useState<LatLng | null>(
    initialLocation ?? null,
  );
  const [showMap, setShowMap] = useState(false);
  const [mapLocation, setMapLocation] = useState<LatLng>(
    initialLocation ?? DEFAULT_MAP_REGION,
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);
  // Flag qui bloque la prochaine recherche automatique quand l'utilisateur
  // vient de choisir une suggestion / GPS / WhatsApp / carte.
  const skipNextSearchRef = useRef(false);

  // Autofocus au montage
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []);

  // Recherche autocomplete
  useEffect(() => {
    // Si on vient de choisir une valeur programmée, on ne relance pas une search
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
        const r = await searchAddresses(q, OUAGADOUGOU_CENTER);
        setSuggestions(r);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  /**
   * Valide une position choisie, met a jour le draft et ferme l'ecran.
   * Utilise partout ou l'utilisateur a fait un choix explicite
   * (suggestion tappee, GPS, WhatsApp, carte).
   */
  const finalizeSelection = (loc: LatLng, label: string) => {
    if (isPickup) {
      setDraftField('pickupAddress', label.trim() || 'Position choisie');
      setDraftField('pickupLocation', loc);
    } else {
      setDraftField('deliveryAddress', label.trim() || 'Position choisie');
      setDraftField('deliveryLocation', loc);
    }
    router.back();
  };

  const handleSelect = (s: GeocodeSuggestion) => {
    finalizeSelection(s.location, s.shortName);
  };

  const handleUseGps = async () => {
    setBusy('gps');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Activez la localisation dans les paramètres.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      const readable = await reverseGeocode(loc);
      finalizeSelection(loc, readable || 'Ma position actuelle');
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
      finalizeSelection(parsed, readable || 'Position partagée (WhatsApp)');
    } finally {
      setBusy(null);
    }
  };

  const openMap = () => {
    setMapLocation(pickedLocation || DEFAULT_MAP_REGION);
    setShowMap(true);
  };

  const confirmMapLocation = async () => {
    setShowMap(false);
    const readable = await reverseGeocode(mapLocation);
    finalizeSelection(mapLocation, readable || 'Position choisie sur la carte');
  };

  const handleConfirm = () => {
    if (!pickedLocation) {
      Alert.alert(
        'Position manquante',
        "Choisissez une adresse dans la liste, utilisez 'Ma position', 'WhatsApp' ou 'Carte'.",
      );
      return;
    }
    if (isPickup) {
      setDraftField('pickupAddress', query.trim() || 'Position choisie');
      setDraftField('pickupLocation', pickedLocation);
    } else {
      setDraftField('deliveryAddress', query.trim() || 'Position choisie');
      setDraftField('deliveryLocation', pickedLocation);
    }
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isPickup ? 'Point de départ' : "Point d'arrivée"}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Input */}
      <View style={styles.searchBar}>
        <View
          style={[
            styles.inputBox,
            { borderColor: isPickup ? colors.primary : colors.secondary },
          ]}
        >
          <View
            style={[
              styles.dot,
              { backgroundColor: isPickup ? colors.primary : colors.secondary },
            ]}
          />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={
              isPickup ? 'Tapez une adresse de départ' : "Tapez une adresse d'arrivée"
            }
            placeholderTextColor={colors.textTertiary}
            value={query}
            onChangeText={setQuery}
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
                inputRef.current?.focus();
              }}
              hitSlop={10}
            >
              <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Quick actions */}
      <View style={styles.quickRow}>
        {isPickup ? (
          <QuickAction
            icon="locate"
            label="Ma position"
            color={colors.primary}
            busy={busy === 'gps'}
            onPress={handleUseGps}
          />
        ) : null}
        <QuickAction
          icon="logo-whatsapp"
          label="Lien WhatsApp"
          color="#25D366"
          busy={busy === 'paste'}
          onPress={handlePasteWhatsApp}
        />
        <QuickAction
          icon="map-outline"
          label="Sur la carte"
          color={colors.textPrimary}
          onPress={openMap}
        />
      </View>

      {/* Position confirmée */}
      {pickedLocation ? (
        <View style={styles.pickedBanner}>
          <Ionicons
            name="checkmark-circle"
            size={18}
            color={colors.primary}
          />
          <Text style={styles.pickedText} numberOfLines={1}>
            Position enregistrée
          </Text>
        </View>
      ) : null}

      {/* Suggestions */}
      <FlatList
        data={suggestions}
        keyExtractor={(s, i) => `${s.location.latitude}-${s.location.longitude}-${i}`}
        keyboardShouldPersistTaps="always"
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: spacing.md }}
        ListEmptyComponent={
          loading ? null : query.trim().length >= 2 ? (
            <Text style={styles.empty}>Aucun résultat</Text>
          ) : (
            <View style={styles.emptyHelp}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name="search"
                  size={32}
                  color={colors.textTertiary}
                />
              </View>
              <Text style={styles.emptyTitle}>Commencez à taper</Text>
              <Text style={styles.emptyHint}>
                Ou utilisez un des raccourcis ci-dessus pour choisir rapidement.
              </Text>
              <View style={styles.tipsBox}>
                <View style={styles.tip}>
                  <Ionicons
                    name="bulb-outline"
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={styles.tipText}>
                    Soyez précis : "Marché de Dassasgho" plutôt que "Ouagadougou"
                  </Text>
                </View>
                <View style={styles.tip}>
                  <Ionicons
                    name="pin-outline"
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={styles.tipText}>
                    Un nom de lieu connu (école, pharmacie, marché) marche mieux
                    qu'une adresse postale classique.
                  </Text>
                </View>
              </View>
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() => handleSelect(item)}
            style={({ pressed }) => [
              styles.suggestionRow,
              pressed && { backgroundColor: colors.background },
              index === 0 && { marginTop: spacing.sm },
            ]}
          >
            <View style={styles.suggestionIcon}>
              <Ionicons
                name="location-outline"
                size={18}
                color={colors.textSecondary}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.suggestionPrimary} numberOfLines={1}>
                {item.shortName}
              </Text>
              <Text style={styles.suggestionSecondary} numberOfLines={1}>
                {item.displayName}
              </Text>
              {!item.isPrecise ? (
                <View style={styles.imprecise}>
                  <Ionicons
                    name="alert-circle"
                    size={12}
                    color={colors.warning}
                  />
                  <Text style={styles.impreciseText}>
                    Zone large — pensez a preciser la rue
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        )}
      />

      {/* Footer confirm */}
      <View style={styles.footer}>
        <Button
          title="Confirmer cette adresse"
          onPress={handleConfirm}
          disabled={!pickedLocation}
        />
      </View>

      {/* Map picker modal */}
      <Modal visible={showMap} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowMap(false)} hitSlop={10}>
              <Ionicons name="close" size={26} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Pointer sur la carte</Text>
            <View style={{ width: 26 }} />
          </View>
          <Text style={styles.modalHint}>
            Tapez sur la carte pour placer le repère
          </Text>
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
    </SafeAreaView>
  );
}

function QuickAction({
  icon,
  label,
  color,
  busy,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  busy?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.quickAction,
        pressed && { backgroundColor: colors.background },
      ]}
      onPress={onPress}
      disabled={busy}
    >
      <View style={[styles.quickIcon, { backgroundColor: color + '1a' }]}>
        {busy ? (
          <ActivityIndicator size="small" color={color} />
        ) : (
          <Ionicons name={icon} size={18} color={color} />
        )}
      </View>
      <Text style={styles.quickLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
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
  headerBtn: { padding: 4 },
  headerTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  searchBar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 56,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    backgroundColor: colors.white,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    padding: 0,
  },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  quickAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    padding: spacing.sm,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
    flex: 1,
    minWidth: 0,
  },
  pickedBanner: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  pickedText: {
    ...typography.bodySmall,
    color: colors.primaryDark,
    fontWeight: '600',
    flex: 1,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: borderRadius.md,
    marginBottom: 2,
  },
  suggestionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionPrimary: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  suggestionSecondary: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  imprecise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  impreciseText: {
    ...typography.caption,
    color: colors.warning,
    fontSize: 11,
  },
  empty: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  emptyHelp: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  emptyHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  tipsBox: {
    marginTop: spacing.lg,
    gap: spacing.sm,
    width: '100%',
  },
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
  },
  tipText: {
    ...typography.caption,
    color: colors.primaryDark,
    flex: 1,
    lineHeight: 18,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.sm,
  },
  modalTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  modalHint: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  map: { flex: 1 },
  modalFooter: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
});
