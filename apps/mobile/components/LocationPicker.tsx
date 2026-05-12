import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import { Button } from '@/components/ui';
import { Map } from '@/components/map/Map';
import { AddressAutocomplete } from '@/components/AddressAutocomplete';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { LatLng } from '@/types';
import { parseLocationUrl, isShortLocationUrl } from '@/utils/parseLocation';
import { reverseGeocode, geocodeAddress } from '@/utils/geocode';
import { DEFAULT_MAP_REGION } from '@/utils/geo';

export type LocationPickerVariant = 'pickup' | 'delivery';

interface LocationPickerProps {
  variant: LocationPickerVariant;
  address: string;
  onAddressChange: (address: string) => void;
  location: LatLng | null;
  onLocationChange: (location: LatLng | null) => void;
  /** Si true, auto-detecte la position GPS au montage (mode "Depuis ma position"). */
  autoUseGpsOnMount?: boolean;
}

/**
 * Picker d'adresse beau et rapide.
 *
 * Design:
 *  - Input autocomplete principal, très visible
 *  - 2 chips compactes en dessous : "Lien WhatsApp" et "Carte"
 *  - (pickup seulement) : au premier montage, si autoUseGpsOnMount=true,
 *    on essaye la position GPS automatiquement. Sinon l'utilisateur fait
 *    "Utiliser ma position" via un bouton discret.
 */
export function LocationPicker({
  variant,
  address,
  onAddressChange,
  location,
  onLocationChange,
  autoUseGpsOnMount = false,
}: LocationPickerProps) {
  const isPickup = variant === 'pickup';
  const iconColor = isPickup ? colors.primary : colors.secondary;
  const placeholder = isPickup
    ? 'Où récupérer le colis ?'
    : 'Où livrer le colis ?';

  const [showMap, setShowMap] = useState(false);
  const [mapLocation, setMapLocation] = useState<LatLng>(location || DEFAULT_MAP_REGION);
  const [busy, setBusy] = useState<null | 'paste' | 'gps' | 'geocode'>(null);

  const autoGpsTriedRef = useRef(false);

  // Auto GPS au premier rendu si demande
  useEffect(() => {
    if (!autoUseGpsOnMount) return;
    if (autoGpsTriedRef.current) return;
    if (location) return;
    autoGpsTriedRef.current = true;
    void handleUseGps(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePasteLink = async () => {
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
        Alert.alert('Lien invalide', 'Ce lien ne contient pas de coordonnées GPS lisibles.');
        return;
      }
      onLocationChange(parsed);
      const readable = await reverseGeocode(parsed);
      onAddressChange(readable || 'Position partagée (WhatsApp)');
    } finally {
      setBusy(null);
    }
  };

  const handleUseGps = async (silent = false) => {
    setBusy('gps');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!silent) {
          Alert.alert('Permission refusée', 'Activez la localisation dans les paramètres.');
        }
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      onLocationChange(loc);
      // Reverse geocode pour afficher un nom
      const readable = await reverseGeocode(loc);
      onAddressChange(readable || 'Ma position actuelle');
    } catch {
      if (!silent) {
        Alert.alert('Erreur', 'Impossible de récupérer votre position.');
      }
    } finally {
      setBusy(null);
    }
  };

  const openMap = () => {
    setMapLocation(location || DEFAULT_MAP_REGION);
    setShowMap(true);
  };

  const confirmMapLocation = async () => {
    onLocationChange(mapLocation);
    setShowMap(false);
    const readable = await reverseGeocode(mapLocation);
    onAddressChange(readable || 'Position choisie sur la carte');
  };

  const handleTextChange = (text: string) => {
    onAddressChange(text);
    if (location && address !== text) {
      onLocationChange(null);
    }
  };

  return (
    <View style={styles.container}>
      <AddressAutocomplete
        placeholder={placeholder}
        value={address}
        onChangeText={handleTextChange}
        onSelect={(s) => {
          onAddressChange(s.shortName);
          onLocationChange(s.location);
        }}
        iconColor={iconColor}
        hasConfirmedLocation={location != null}
      />

      {/* Chips d'alternatives */}
      <View style={styles.chipsRow}>
        <Chip
          icon="logo-whatsapp"
          iconColor="#25D366"
          label="WhatsApp"
          busy={busy === 'paste'}
          onPress={handlePasteLink}
          disabled={busy !== null}
        />
        {isPickup ? (
          <Chip
            icon="locate"
            iconColor={colors.primary}
            label="Ma position"
            busy={busy === 'gps'}
            onPress={() => handleUseGps(false)}
            disabled={busy !== null}
          />
        ) : null}
        <Chip
          icon="map-outline"
          iconColor={colors.textSecondary}
          label="Sur la carte"
          onPress={openMap}
          disabled={busy !== null}
        />
      </View>

      {/* Status discret */}
      {location && busy !== 'geocode' ? (
        <View style={styles.statusRow}>
          <Ionicons name="checkmark-circle" size={15} color={colors.primary} />
          <Text style={styles.statusOk} numberOfLines={1}>
            Position confirmée
          </Text>
        </View>
      ) : !location && !busy && address.trim().length >= 3 ? (
        <View style={styles.statusRow}>
          <Ionicons name="alert-circle" size={15} color={colors.warning} />
          <Text style={styles.statusWarn} numberOfLines={2}>
            Position non trouvée — choisissez dans la liste, partagez un lien ou pointez sur la carte.
          </Text>
        </View>
      ) : null}

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
            markers={[{ id: 'target', coordinate: mapLocation, icon: 'default' }]}
            onPress={(coord) => setMapLocation(coord)}
            style={styles.map}
          />
          <View style={styles.modalFooter}>
            <Button title="Confirmer cette position" onPress={confirmMapLocation} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// --- Chip ---

function Chip({
  icon,
  iconColor,
  label,
  busy,
  onPress,
  disabled,
}: {
  icon: keyof typeof import('@expo/vector-icons/build/Ionicons').default.glyphMap;
  iconColor: string;
  label: string;
  busy?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        chipStyles.chip,
        pressed && !disabled && chipStyles.chipPressed,
        disabled && chipStyles.chipDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      {busy ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : (
        <Ionicons name={icon} size={16} color={iconColor} />
      )}
      <Text style={chipStyles.chipLabel}>{label}</Text>
    </Pressable>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 8,
    backgroundColor: colors.white,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipPressed: {
    backgroundColor: colors.background,
  },
  chipDisabled: {
    opacity: 0.5,
  },
  chipLabel: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm + 2,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  statusOk: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  statusWarn: {
    ...typography.caption,
    color: colors.warning,
    flex: 1,
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
  map: {
    flex: 1,
  },
  modalFooter: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
});
