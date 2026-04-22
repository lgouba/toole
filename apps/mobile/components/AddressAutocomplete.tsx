import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius } from '@/theme';
import { LatLng } from '@/types';
import { searchAddresses, GeocodeSuggestion } from '@/utils/geocode';
import { OUAGADOUGOU_CENTER } from '@/utils/geo';

interface AddressAutocompleteProps {
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (suggestion: GeocodeSuggestion) => void;
  iconColor?: string;
  biasLocation?: LatLng;
  autoFocus?: boolean;
  /** Passer true quand la position est deja resolue (via GPS / WhatsApp / carte)
   *  pour ne pas re-chercher cette adresse comme une requete texte. */
  hasConfirmedLocation?: boolean;
}

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2; // on cherche des 2 caracteres

// Cache en memoire des recherches deja effectuees, limite a 30 entrees.
const searchCache = new Map<string, GeocodeSuggestion[]>();
const MAX_CACHE_SIZE = 30;

function cacheGet(key: string): GeocodeSuggestion[] | undefined {
  return searchCache.get(key.toLowerCase().trim());
}

function cacheSet(key: string, value: GeocodeSuggestion[]) {
  const k = key.toLowerCase().trim();
  if (searchCache.size >= MAX_CACHE_SIZE) {
    const firstKey = searchCache.keys().next().value;
    if (firstKey) searchCache.delete(firstKey);
  }
  searchCache.set(k, value);
}

/** Deduit un pictogramme contextuel depuis le texte de suggestion. */
function iconForSuggestion(s: GeocodeSuggestion): keyof typeof Ionicons.glyphMap {
  const t = (s.displayName + ' ' + s.shortName).toLowerCase();
  if (/(restaurant|resto|food|cafe|caf\u00e9|bar)/.test(t)) return 'restaurant-outline';
  if (/(hopital|hospital|clinique|pharmacie)/.test(t)) return 'medkit-outline';
  if (/(ecole|lycee|universite|college)/.test(t)) return 'school-outline';
  if (/(banque|bank)/.test(t)) return 'card-outline';
  if (/(marche|market|boutique|shop|magasin)/.test(t)) return 'storefront-outline';
  if (/(station|essence|fuel)/.test(t)) return 'car-outline';
  if (/(eglise|church|mosquee|mosque)/.test(t)) return 'business-outline';
  if (/(hotel|auberge)/.test(t)) return 'bed-outline';
  return 'location-outline';
}

export function AddressAutocomplete({
  placeholder = 'Chercher une adresse...',
  value,
  onChangeText,
  onSelect,
  iconColor = colors.primary,
  biasLocation = OUAGADOUGOU_CENTER,
  autoFocus = false,
  hasConfirmedLocation = false,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  // Indique que l'utilisateur vient de selectionner / effacer -> on cache la dropdown
  // meme si le champ reste focus.
  const [dismissedDropdown, setDismissedDropdown] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const q = value.trim();

    // Des que l'utilisateur tape, on reactive la dropdown
    // (sauf s'il vient juste de selectionner exactement la meme valeur)
    if (q.length < MIN_CHARS) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    // Si la position est deja confirmee (GPS, WhatsApp, carte, ou suggestion
    // selectionnee), on ne re-cherche pas cette adresse.
    if (hasConfirmedLocation) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    if (dismissedDropdown) return;

    // Cache hit instantane
    const cached = cacheGet(q);
    if (cached) {
      setSuggestions(cached);
      setLoading(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchAddresses(q, biasLocation);
        cacheSet(q, results);
        setSuggestions(results);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleTextChange = (text: string) => {
    // L'utilisateur retape -> on reouvre la dropdown
    if (dismissedDropdown) setDismissedDropdown(false);
    onChangeText(text);
  };

  const handleSelect = (s: GeocodeSuggestion) => {
    onChangeText(s.shortName);
    onSelect(s);
    setSuggestions([]);
    setDismissedDropdown(true);
    Keyboard.dismiss();
  };

  // La dropdown s'affiche quand :
  //  - le champ est focus
  //  - l'utilisateur n'a pas explicitement selectionne
  //  - il y a du texte >= MIN_CHARS
  const showDropdown =
    focused &&
    !dismissedDropdown &&
    value.trim().length >= MIN_CHARS &&
    (loading || suggestions.length > 0 || !loading);

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => inputRef.current?.focus()}
        style={[styles.inputBox, focused && styles.inputBoxFocused]}
      >
        <View
          style={[
            styles.iconPill,
            { backgroundColor: iconColor + '20' },
          ]}
        >
          <Ionicons name="location" size={16} color={iconColor} />
        </View>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          value={value}
          onChangeText={handleTextChange}
          onFocus={() => {
            setFocused(true);
            setDismissedDropdown(false);
          }}
          onBlur={() => setFocused(false)}
          autoCorrect={false}
          autoCapitalize="sentences"
          autoFocus={autoFocus}
          returnKeyType="search"
          blurOnSubmit={false}
        />
        {loading ? (
          <ActivityIndicator size="small" color={colors.textSecondary} />
        ) : value ? (
          <TouchableOpacity
            onPress={() => {
              onChangeText('');
              setSuggestions([]);
              inputRef.current?.focus();
            }}
            hitSlop={10}
          >
            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        ) : null}
      </Pressable>

      {showDropdown ? (
        <View style={styles.dropdown}>
          {loading && suggestions.length === 0 ? (
            <View style={styles.emptyRow}>
              <ActivityIndicator size="small" color={colors.textSecondary} />
              <Text style={styles.emptyText}>Recherche...</Text>
            </View>
          ) : suggestions.length === 0 && value.trim().length >= MIN_CHARS ? (
            <View style={styles.emptyRow}>
              <Ionicons
                name="search-outline"
                size={18}
                color={colors.textTertiary}
              />
              <Text style={styles.emptyText}>Aucun résultat</Text>
            </View>
          ) : (
            suggestions.map((s, i) => {
              const icon = iconForSuggestion(s);
              return (
                <TouchableOpacity
                  key={`${s.location.latitude}-${s.location.longitude}-${i}`}
                  style={[styles.row, i < suggestions.length - 1 && styles.rowBorder]}
                  // onPressIn pour que la selection s'execute avant que le
                  // TextInput ne perde son focus (fix Android principalement).
                  onPressIn={() => handleSelect(s)}
                  activeOpacity={0.6}
                >
                  <View style={styles.rowIconBox}>
                    <Ionicons name={icon} size={18} color={colors.textSecondary} />
                  </View>
                  <View style={styles.rowTexts}>
                    <Text style={styles.rowPrimary} numberOfLines={1}>
                      {s.shortName}
                    </Text>
                    <Text style={styles.rowSecondary} numberOfLines={1}>
                      {s.displayName}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 10,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm + 2,
    gap: spacing.sm,
  },
  inputBoxFocused: {
    borderColor: colors.primary,
    borderWidth: 1.5,
    shadowColor: colors.primary,
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    padding: 0,
  },
  dropdown: {
    position: 'absolute',
    top: 62, // juste sous l'inputBox (height 56 + 6 margin)
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm + 2,
    gap: spacing.sm,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowIconBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTexts: {
    flex: 1,
    minWidth: 0,
  },
  rowPrimary: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  rowSecondary: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  emptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
