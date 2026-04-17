import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import { Input, Button } from '@/components/ui';
import { Map } from '@/components/map/Map';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { LatLng } from '@/types';
import { parseLocationUrl, isShortLocationUrl } from '@/utils/parseLocation';
import { DEFAULT_MAP_REGION } from '@/utils/geo';

interface LocationPickerProps {
  label: string;
  iconColor?: string;
  address: string;
  onAddressChange: (address: string) => void;
  location: LatLng | null;
  onLocationChange: (location: LatLng) => void;
}

export function LocationPicker({
  label,
  iconColor = colors.primary,
  address,
  onAddressChange,
  location,
  onLocationChange,
}: LocationPickerProps) {
  const [showMap, setShowMap] = useState(false);
  const [mapLocation, setMapLocation] = useState<LatLng>(location || DEFAULT_MAP_REGION);
  const [loadingGps, setLoadingGps] = useState(false);

  const handlePasteLink = async () => {
    const text = await Clipboard.getStringAsync();
    if (!text) {
      Alert.alert('Presse-papiers vide', 'Copiez d\'abord un lien WhatsApp ou Google Maps');
      return;
    }

    if (isShortLocationUrl(text)) {
      Alert.alert(
        'Lien raccourci detecte',
        'Ouvrez le lien dans votre navigateur pour obtenir le lien complet, puis copiez-le a nouveau. Ou choisissez sur la carte.'
      );
      return;
    }

    const parsed = parseLocationUrl(text);
    if (parsed) {
      onLocationChange(parsed);
      if (!address) {
        onAddressChange(`${parsed.latitude.toFixed(4)}, ${parsed.longitude.toFixed(4)}`);
      }
      Alert.alert('Position enregistree', 'Localisation ajoutee avec succes');
    } else {
      Alert.alert(
        'Lien invalide',
        'Impossible d\'extraire une position GPS. Copiez un lien WhatsApp, Google Maps ou Apple Maps valide.'
      );
    }
  };

  const handleUseGps = async () => {
    setLoadingGps(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusee', 'Activez la localisation dans les parametres');
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const loc = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      onLocationChange(loc);
      if (!address) {
        onAddressChange('Ma position actuelle');
      }
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de recuperer votre position');
    } finally {
      setLoadingGps(false);
    }
  };

  const handleMapPress = (coord: LatLng) => {
    setMapLocation(coord);
  };

  const confirmMapLocation = () => {
    onLocationChange(mapLocation);
    if (!address) {
      onAddressChange(`${mapLocation.latitude.toFixed(4)}, ${mapLocation.longitude.toFixed(4)}`);
    }
    setShowMap(false);
  };

  const openMapPicker = () => {
    setMapLocation(location || DEFAULT_MAP_REGION);
    setShowMap(true);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handlePasteLink}
          activeOpacity={0.7}
        >
          <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
          <Text style={styles.actionText}>Coller lien</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={handleUseGps}
          activeOpacity={0.7}
          disabled={loadingGps}
        >
          <Ionicons name="locate" size={18} color={colors.primary} />
          <Text style={styles.actionText}>
            {loadingGps ? 'Localisation...' : 'Ma position'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionBtn}
          onPress={openMapPicker}
          activeOpacity={0.7}
        >
          <Ionicons name="map" size={18} color={colors.secondary} />
          <Text style={styles.actionText}>Sur la carte</Text>
        </TouchableOpacity>
      </View>

      {/* Location confirmation */}
      {location && (
        <View style={styles.confirmBadge}>
          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
          <Text style={styles.confirmText}>
            Position GPS : {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
          </Text>
        </View>
      )}

      {/* Optional address input */}
      <Input
        placeholder="Nom du lieu (optionnel)"
        value={address}
        onChangeText={onAddressChange}
        leftIcon={<Ionicons name="location-outline" size={16} color={iconColor} />}
      />

      {/* Map picker modal */}
      <Modal visible={showMap} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowMap(false)}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Choisir sur la carte</Text>
            <View style={{ width: 24 }} />
          </View>

          <Text style={styles.modalHint}>
            Appuyez sur la carte pour placer le marqueur
          </Text>

          <Map
            center={mapLocation}
            zoom={13}
            markers={[{ id: 'target', coordinate: mapLocation, icon: 'default' }]}
            onPress={handleMapPress}
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

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  label: {
    ...typography.bodySmall,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  actionText: {
    ...typography.caption,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  confirmBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.sm,
  },
  confirmText: {
    ...typography.caption,
    color: colors.primaryDark,
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
