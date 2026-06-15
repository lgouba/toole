import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Clipboard from 'expo-clipboard';
import { recap as R, step2 as T } from '@/theme/recapTokens';
import { LatLng } from '@/types';
import {
  searchAddresses,
  reverseGeocode,
  bboxAround,
  GeocodeSuggestion,
} from '@/utils/geocode';
import { parseLocationUrl, isShortLocationUrl } from '@/utils/parseLocation';
import { useLocationStore } from '@/stores/location.store';
import { useAddressFavoritesStore } from '@/stores/addressFavorites.store';
import { useRecentPlacesStore } from '@/stores/recentPlaces.store';
import { Step2Place, Which } from './tripTypes';

interface Props {
  active: Which;
  onPick: (place: Step2Place) => void;
}

const DEBOUNCE = 280;

export function AddressSource({ active, onPick }: Props) {
  const userLocation = useLocationStore((s) => s.current);
  const countryCode = useLocationStore((s) => s.countryCode);
  const cityBbox = useLocationStore((s) => s.cityBbox);
  const getCenter = useLocationStore((s) => s.getCenterOrFallback);
  const home = useAddressFavoritesStore((s) => s.favorites.find((f) => f.kind === 'home'));
  const work = useAddressFavoritesStore((s) => s.favorites.find((f) => f.kind === 'work'));
  const recents = useRecentPlacesStore((s) => s.recents);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<null | 'gps' | 'paste'>(null);
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Réinitialise la recherche quand on change de ligne active.
  useEffect(() => {
    setQuery('');
    setSuggestions([]);
  }, [active]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const center = userLocation ?? getCenter();
        const bbox = cityBbox ?? bboxAround(center);
        const r = await searchAddresses(q, center, countryCode, bbox);
        setSuggestions(r);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE);
    return () => {
      if (debRef.current) clearTimeout(debRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const placeholder =
    active === 'pickup' ? 'Adresse de récupération…' : 'Adresse de livraison…';

  const pickSuggestion = (s: GeocodeSuggestion) => {
    onPick({ label: s.shortName, address: s.displayName, location: s.location, source: 'search' });
    setQuery('');
    setSuggestions([]);
  };

  const useGps = async () => {
    setBusy('gps');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Localisation refusée',
          'Active la localisation dans les réglages, ou saisis l’adresse à la main.',
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
      });
      const loc: LatLng = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      const label = (await reverseGeocode(loc)) || 'Ma position actuelle';
      onPick({ label, address: label, location: loc, source: 'gps' });
    } catch {
      Alert.alert('Erreur', 'Impossible de récupérer votre position.');
    } finally {
      setBusy(null);
    }
  };

  const pasteLink = async () => {
    setBusy('paste');
    try {
      const text = (await Clipboard.getStringAsync())?.trim();
      if (!text) {
        Alert.alert('Presse-papiers vide', 'Copie une position partagée puis reviens ici.');
        return;
      }
      if (isShortLocationUrl(text)) {
        Alert.alert(
          'Lien raccourci',
          "Ouvre le lien dans ton navigateur puis copie l'URL complète.",
        );
        return;
      }
      const loc = parseLocationUrl(text);
      if (!loc) {
        Alert.alert('Lien non reconnu', "Ce lien ne contient pas de coordonnées GPS lisibles.");
        return;
      }
      const label = (await reverseGeocode(loc)) || 'Position partagée';
      onPick({ label, address: label, location: loc, source: 'pasted_link' });
    } finally {
      setBusy(null);
    }
  };

  const showSuggestions = query.trim().length >= 3;

  return (
    <View style={styles.wrap}>
      {/* Recherche */}
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={T.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          placeholderTextColor={T.textMuted}
          style={styles.searchInput}
          autoCorrect={false}
        />
        {loading ? <ActivityIndicator size="small" color={T.green} /> : null}
      </View>

      {showSuggestions ? (
        <View style={styles.list}>
          {suggestions.map((s, i) => (
            <TouchableOpacity
              key={`${s.location.latitude}-${s.location.longitude}-${i}`}
              style={styles.recentRow}
              onPress={() => pickSuggestion(s)}
              activeOpacity={0.8}
            >
              <View style={styles.recentIcon}>
                <Ionicons name="location-outline" size={18} color={T.textSec} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.recentName} numberOfLines={1}>{s.shortName}</Text>
                <Text style={styles.recentSub} numberOfLines={1}>{s.displayName}</Text>
              </View>
            </TouchableOpacity>
          ))}
          {!loading && suggestions.length === 0 ? (
            <Text style={styles.empty}>Aucun résultat dans ta zone.</Text>
          ) : null}
        </View>
      ) : (
        <>
          {/* Raccourcis */}
          <View style={styles.shortcuts}>
            {active === 'pickup' && (
              <Shortcut
                icon="my-location"
                tint={T.green}
                title="Ma position"
                sub="GPS du téléphone"
                loading={busy === 'gps'}
                onPress={useGps}
              />
            )}
            {home && (
              <Shortcut
                icon="home"
                tint="#2C7CC2"
                title={home.label}
                sub={home.address}
                onPress={() =>
                  onPick({ label: home.label, address: home.address, location: home.location, source: 'saved' })
                }
              />
            )}
            {work && (
              <Shortcut
                icon="work"
                tint="#C5961A"
                title={work.label}
                sub={work.address}
                onPress={() =>
                  onPick({ label: work.label, address: work.address, location: work.location, source: 'saved' })
                }
              />
            )}
          </View>

          {/* Récents (cascade à chaque bascule) */}
          {recents.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>TRAJETS & LIEUX RÉCENTS</Text>
              <View style={styles.list} key={active /* remount → re-anime les lignes */}>
                {recents.map((r, i) => (
                  <Animated.View key={`${r.location.latitude}-${i}`} entering={FadeInDown.delay(i * 55).duration(260)}>
                    <TouchableOpacity
                      style={styles.recentRow}
                      activeOpacity={0.8}
                      onPress={() =>
                        onPick({ label: r.label, address: r.address, location: r.location, source: 'recent' })
                      }
                    >
                      <View style={styles.recentIcon}>
                        <Ionicons name="time-outline" size={18} color={T.textSec} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.recentName} numberOfLines={1}>{r.label}</Text>
                        {r.address ? (
                          <Text style={styles.recentSub} numberOfLines={1}>{r.address}</Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </View>
            </>
          )}

          {/* Coller un lien */}
          <TouchableOpacity style={styles.linkAction} onPress={pasteLink} activeOpacity={0.85}>
            {busy === 'paste' ? (
              <ActivityIndicator size="small" color={T.green} />
            ) : (
              <MaterialIcons name="link" size={20} color={T.green} />
            )}
            <Text style={styles.linkText}>Coller un lien Google Maps / WhatsApp</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

function Shortcut({
  icon,
  tint,
  title,
  sub,
  loading,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  tint: string;
  title: string;
  sub?: string;
  loading?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.shortcut} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.shortcutIcon, { backgroundColor: tint + '1A' }]}>
        {loading ? (
          <ActivityIndicator size="small" color={tint} />
        ) : (
          <MaterialIcons name={icon} size={20} color={tint} />
        )}
      </View>
      <Text style={styles.shortcutTitle} numberOfLines={1}>{title}</Text>
      {sub ? <Text style={styles.shortcutSub} numberOfLines={1}>{sub}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: R.space.md },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: R.space.sm,
    height: 50,
    paddingHorizontal: R.space.lg,
    borderRadius: T.radius.field,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
  },
  searchInput: { flex: 1, fontFamily: R.font.body, fontSize: 14.5, color: T.textPrim, padding: 0 },
  shortcuts: { flexDirection: 'row', gap: R.space.md },
  shortcut: {
    flex: 1,
    backgroundColor: T.surface,
    borderRadius: T.radius.tile,
    borderWidth: 1,
    borderColor: T.border,
    padding: R.space.md,
    gap: 4,
  },
  shortcutIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  shortcutTitle: { fontFamily: R.font.bodyBold, fontSize: 13, color: T.textPrim },
  shortcutSub: { fontFamily: R.font.body, fontSize: 11, color: T.textMuted },
  sectionLabel: {
    fontFamily: R.font.mono,
    fontSize: 9.5,
    letterSpacing: 1.4,
    color: T.textMuted,
    marginTop: R.space.xs,
  },
  list: {
    backgroundColor: T.surface,
    borderRadius: T.radius.tile,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: R.space.md,
    paddingVertical: R.space.md,
    paddingHorizontal: R.space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
  },
  recentIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1EFE8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentName: { fontFamily: R.font.bodyBold, fontSize: 13.5, color: T.textPrim },
  recentSub: { fontFamily: R.font.body, fontSize: 12, color: T.textMuted, marginTop: 1 },
  empty: { fontFamily: R.font.body, fontSize: 13, color: T.textMuted, padding: R.space.lg },
  linkAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: R.space.sm,
    height: 48,
    borderRadius: T.radius.field,
    backgroundColor: T.linkBg,
    borderWidth: 1,
    borderColor: T.linkBorder,
  },
  linkText: { fontFamily: R.font.bodyBold, fontSize: 13.5, color: T.green },
});
