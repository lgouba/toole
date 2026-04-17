import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { colors, typography, sizes } from '@/theme';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  uri?: string;
  name: string;
  size?: AvatarSize;
}

const sizeMap: Record<AvatarSize, number> = {
  sm: sizes.avatarSm,
  md: sizes.avatarMd,
  lg: sizes.avatarLg,
  xl: sizes.avatarXl,
};

const fontSizeMap: Record<AvatarSize, number> = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
};

function getInitials(name: string): string {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (parts[0]?.[0] || '?').toUpperCase();
}

export function Avatar({ uri, name, size = 'md' }: AvatarProps) {
  const dim = sizeMap[size];

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, { width: dim, height: dim, borderRadius: dim / 2 }]}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        { width: dim, height: dim, borderRadius: dim / 2 },
      ]}
    >
      <Text style={[styles.initials, { fontSize: fontSizeMap[size] }]}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.surface,
  },
  fallback: {
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.primaryDark,
    fontWeight: '600',
  },
});
