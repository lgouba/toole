import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, sizes } from '@/theme';
import { LatLng } from '@/types';
import { searchAddresses, GeocodeSuggestion } from '@/utils/geocode';
import { OUAGADOUGOU_CENTER } from '@/utils/geo';

interface AddressAutocompleteProps {
  label: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  onSelect: (suggestion: GeocodeSuggestion) => void;
  iconColor?: string;
  biasLocation?: LatLng;
  rightSlot?: React.ReactNode;
}

const DEBOUNCE_MS = 400;

export function AddressAutocomplete({
  label,
  placeholder = 'Ex: Marche de Dassasgho',
  value,
  onChangeText,
  onSelect,
  iconColor = colors.primary,
  biasLocation = OUAGADOUGOU_CENTER,
  rightSlot,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [hasSelected, setHasSelected] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Si l'utilisateur vient de selectionner une suggestion, on ne recherche pas.
    if (hasSelected) {
      setHasSelected(false);
      setSuggestions([]);
      return;
    }

    if (!focused) return;
    if (value.trim().length < 3) {
      setSuggestions([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await searchAddresses(value, biasLocation);
        setSuggestions(results);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused]);

  const handleSelect = (s: GeocodeSuggestion) => {
    setHasSelected(true);
    onChangeText(s.shortName);
    onSelect(s);
    setSuggestions([]);
    Keyboard.dismiss();
  };

  const showDropdown = focused && (loading || suggestions.length > 0);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <View style={[styles.inputBox, focused && styles.inputBoxFocused]}>
        <Ionicons name="location-outline" size={18} color={iconColor} style={styles.icon} />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Delai pour laisser le temps a onPress de la suggestion
            setTimeout(() => setFocused(false), 200);
          }}
          autoCorrect={false}
          autoCapitalize="sentences"
        />
        {loading && <ActivityIndicator size="small" color={colors.textSecondary} />}
        {!!value && !loading && (
          <TouchableOpacity
            onPress={() => {
              onChangeText('');
              setSuggestions([]);
            }}
          >
            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
        {rightSlot}
      </View>

      {/* Dropdown suggestions */}
      {showDropdown && (
        <View style={styles.dropdown}>
          {loading && suggestions.length === 0 && (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>Recherche...</Text>
            </View>
          )}
          {!loading && suggestions.length === 0 && value.trim().length >= 3 && (
            <View style={styles.emptyRow}>
              <Text style={styles.emptyText}>Aucun resultat</Text>
            </View>
          )}
          {suggestions.map((s, i) => (
            <TouchableOpacity
              key={`${s.location.latitude}-${s.location.longitude}-${i}`}
              style={[styles.row, i < suggestions.length - 1 && styles.rowBorder]}
              onPress={() => handleSelect(s)}
              activeOpacity={0.6}
            >
              <Ionicons
                name="location"
                size={16}
                color={colors.textSecondary}
                style={styles.rowIcon}
              />
              <View style={styles.rowTexts}>
                <Text style={styles.rowPrimary} numberOfLines={1}>
                  {s.shortName}
                </Text>
                <Text style={styles.rowSecondary} numberOfLines={1}>
                  {s.displayName}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: sizes.inputHeight,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  inputBoxFocused: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  icon: {
    marginRight: 2,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
    padding: 0,
  },
  dropdown: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    marginTop: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowIcon: {
    marginTop: 2,
  },
  rowTexts: {
    flex: 1,
  },
  rowPrimary: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  rowSecondary: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  emptyRow: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});
