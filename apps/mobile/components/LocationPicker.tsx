import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
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

interface LocationPickerProps {
  label: string;
  placeholder?: string;
  iconColor?: string;
  address: string;
  onAddressChange: (address: string) => void;
  location: LatLng | null;
  onLocationChange: (location: LatLng | null) => void;
  showUseMyPosition?: boolean;
}

export function LocationPicker({
  label,
  placeholder,
  iconColor = colors.primary,
  address,
  onAddressChange,
  location,
  onLocationChange,
  showUseMyPosition = false,
}: LocationPickerProps) {
  const [showMap, setShowMap] = useState(false);
  const [mapLocation, setMapLocation] = useState<LatLng>(location || DEFAULT_MAP_REGION);
  const [busy, setBusy] = useState<null | 'paste' | 'gps' | 'geocode'>(null);
  const [showHelp, setShowHelp] = useState(false);

  const lastGeocodedAddressRef = useRef<string>('');
  useEffect(() => {
    const trimmed = address.trim();
    if (!trimmed || trimmed.length < 4) return;
    if (location) return;
    if (lastGeocodedAddressRef.current === trimmed) return;

    const handle = setTimeout(async () => {
      lastGeocodedAddressRef.current = trimmed;
      setBusy('geocode');
      try {
        const result = await geocodeAddress(trimmed);
        if (result) onLocationChange(result.location);
      } finally {
        setBusy(null);
      }
    }, 1200);

    return () => clearTimeout(handle);
  }, [address, location, onLocationChange]);

  const handlePasteLink = async () => {
    setBusy('paste');
    try {
      const text = await Clipboard.getStringAsync();
      if (!text) {
        Alert.alert(
          'Presse-papiers vide',
          'Ouvrez WhatsApp, copiez une position partagee, puis revenez ici.',
        );
        return;
      }
      if (isShortLocationUrl(text)) {
        Alert.alert(
          'Lien raccourci',
          'Ouvrez le lien dans votre navigateur puis copiez l\'URL complete.',
        );
        return;
      }
      const parsed = parseLocationUrl(text);
      if (!parsed) {
        Alert.alert('Lien invalide', 'Ce lien ne contient pas de coordonnees GPS lisibles.');
        return;
      }
      onLocationChange(parsed);
      const readable = await reverseGeocode(parsed);
      onAddressChange(readable || 'Position partagee (WhatsApp)');
    } finally {
      setBusy(null);
    }
  };

  const handleUseGps = async () => {
    setBusy('gps');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusee', 'Activez la localisation dans les parametres.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      onLocationChange(loc);
      onAddressChange('Ma position actuelle');
    } catch {
      Alert.alert('Erreur', 'Impossible de recuperer votre position.');
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
      <View style={styles.labelRow}>
        <AddressAutocomplete
          label={label}
          placeholder={placeholder}
          value={address}
          onChangeText={handleTextChange}
          onSelect={(s) => {
            onAddressChange(s.shortName);
            onLocationChange(s.location);
            lastGeocodedAddressRef.current = s.shortName;
          }}
          iconColor={iconColor}
        />
      </View>

      {/* Separateur OU */}
      <View style={styles.orDivider}>
        <View style={styles.orLine} />
        <Text style={styles.orText}>OU choisir autrement</Text>
        <View style={styles.orLine} />
      </View>

      {/* Actions detaillees (listes verticalement) */}
      <View style={styles.actionsList}>
        <TouchableOpacity
          style={styles.actionRow}
          onPress={handlePasteLink}
          activeOpacity={0.6}
          disabled={busy !== null}
        >
          <View style={[styles.actionIconBox, { backgroundColor: '#25D36620' }]}>
            {busy === 'paste' ? (
              <ActivityIndicator size="small" color="#25D366" />
            ) : (
              <Ionicons name="logo-whatsapp" size={22} color="#25D366" />
            )}
          </View>
          <View style={styles.actionTexts}>
            <Text style={styles.actionTitle}>Coller un lien WhatsApp</Text>
            <Text style={styles.actionDesc}>
              Depuis WhatsApp, partagez une position, copiez le lien, puis appuyez ici
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>

        {showUseMyPosition && (
          <TouchableOpacity
            style={styles.actionRow}
            onPress={handleUseGps}
            activeOpacity={0.6}
            disabled={busy !== null}
          >
            <View style={[styles.actionIconBox, { backgroundColor: colors.primaryLight }]}>
              {busy === 'gps' ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Ionicons name="locate" size={22} color={colors.primary} />
              )}
            </View>
            <View style={styles.actionTexts}>
              <Text style={styles.actionTitle}>Utiliser ma position GPS</Text>
              <Text style={styles.actionDesc}>
                Je suis a cet endroit maintenant
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.actionRow}
          onPress={openMap}
          activeOpacity={0.6}
          disabled={busy !== null}
        >
          <View style={[styles.actionIconBox, { backgroundColor: colors.secondaryLight }]}>
            <Ionicons name="map-outline" size={22} color={colors.secondary} />
          </View>
          <View style={styles.actionTexts}>
            <Text style={styles.actionTitle}>Pointer sur la carte</Text>
            <Text style={styles.actionDesc}>
              Si vous connaissez l'endroit exact sans adresse precise
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>

        {/* Lien aide */}
        <TouchableOpacity
          style={styles.helpBtn}
          onPress={() => setShowHelp(true)}
          activeOpacity={0.6}
        >
          <Ionicons name="help-circle-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.helpText}>Comment partager une position WhatsApp ?</Text>
        </TouchableOpacity>
      </View>

      {/* Status */}
      {busy === 'geocode' && (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color={colors.textSecondary} />
          <Text style={styles.statusText}>Localisation de l'adresse...</Text>
        </View>
      )}
      {location && busy !== 'geocode' && (
        <View style={styles.statusRow}>
          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
          <Text style={styles.statusTextOk}>Position enregistree</Text>
        </View>
      )}
      {!location && !busy && address.trim().length >= 3 && (
        <View style={styles.statusRow}>
          <Ionicons name="alert-circle" size={16} color={colors.warning} />
          <Text style={styles.statusTextWarn}>
            Position non trouvee. Utilisez une des options ci-dessus.
          </Text>
        </View>
      )}

      {/* Map picker modal */}
      <Modal visible={showMap} animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowMap(false)}>
              <Ionicons name="close" size={26} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Pointer sur la carte</Text>
            <View style={{ width: 26 }} />
          </View>
          <Text style={styles.modalHint}>Tapez sur la carte pour placer le repere</Text>
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

      {/* Help modal */}
      <Modal visible={showHelp} animationType="slide" transparent>
        <View style={styles.helpBackdrop}>
          <View style={styles.helpCard}>
            <View style={styles.helpHeader}>
              <Text style={styles.helpTitle}>Partager une position WhatsApp</Text>
              <TouchableOpacity onPress={() => setShowHelp(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.helpStep}>
              <View style={styles.helpNumber}>
                <Text style={styles.helpNumberText}>1</Text>
              </View>
              <Text style={styles.helpStepText}>
                Sur WhatsApp, ouvrez une discussion et appuyez sur <Text style={styles.bold}>+</Text>, puis <Text style={styles.bold}>Position</Text>.
              </Text>
            </View>
            <View style={styles.helpStep}>
              <View style={styles.helpNumber}>
                <Text style={styles.helpNumberText}>2</Text>
              </View>
              <Text style={styles.helpStepText}>
                Choisissez <Text style={styles.bold}>Envoyer votre position actuelle</Text> ou selectionnez un lieu sur la carte.
              </Text>
            </View>
            <View style={styles.helpStep}>
              <View style={styles.helpNumber}>
                <Text style={styles.helpNumberText}>3</Text>
              </View>
              <Text style={styles.helpStepText}>
                Appuyez longuement sur la position envoyee, puis <Text style={styles.bold}>Copier le lien</Text>.
              </Text>
            </View>
            <View style={styles.helpStep}>
              <View style={styles.helpNumber}>
                <Text style={styles.helpNumberText}>4</Text>
              </View>
              <Text style={styles.helpStepText}>
                Revenez sur Tolle et appuyez sur <Text style={styles.bold}>Coller un lien WhatsApp</Text>.
              </Text>
            </View>

            <Button title="J'ai compris" onPress={() => setShowHelp(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  labelRow: {
    // container for input
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  orText: {
    ...typography.caption,
    color: colors.textTertiary,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  actionsList: {
    gap: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm + 4,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    gap: spacing.sm,
  },
  actionIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTexts: {
    flex: 1,
    gap: 2,
  },
  actionTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  actionDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.xs,
    marginTop: spacing.xs,
  },
  helpText: {
    ...typography.caption,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  statusTextOk: {
    ...typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  statusTextWarn: {
    ...typography.bodySmall,
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
  // Help modal
  helpBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  helpCard: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  helpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  helpTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  helpStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  helpNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpNumberText: {
    ...typography.bodySmall,
    color: colors.white,
    fontWeight: '700',
  },
  helpStepText: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    flex: 1,
    lineHeight: 20,
  },
  bold: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
