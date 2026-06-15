import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { recap as R, profile as P } from '@/theme/recapTokens';
import { formatPhone } from '@/utils/format';

interface Props {
  fullName: string;
  phone: string;
  memberSinceYear?: number;
  stats?: { total: number; active: number } | null;
  onEdit: () => void;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ProfileHeader({ fullName, phone, memberSinceYear, stats, onEdit }: Props) {
  const hasStats = !!stats && stats.total > 0;
  return (
    <View style={styles.wrap}>
      <View style={styles.avatarWrap}>
        <View style={styles.avatar}>
          <Text style={styles.initials}>{initialsOf(fullName)}</Text>
        </View>
        <TouchableOpacity style={styles.editBtn} onPress={onEdit} accessibilityLabel="Modifier le profil">
          <MaterialIcons name="edit" size={14} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <Text style={styles.name}>{fullName}</Text>
      <Text style={styles.phone}>🇧🇫 {formatPhone(phone)}</Text>

      <View style={styles.statsRow}>
        <Stat value={hasStats ? String(stats!.total) : '—'} label="ENVOIS" />
        <View style={styles.statSep} />
        <Stat value={hasStats ? String(stats!.active) : '—'} label="EN COURS" />
        <View style={styles.statSep} />
        <Stat value={memberSinceYear ? String(memberSinceYear) : '—'} label="MEMBRE" />
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingTop: R.space.md, paddingBottom: R.space.xl },
  avatarWrap: { width: 84, height: 84 },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: P.avatarBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontFamily: R.font.displayXBold, fontSize: 30, color: P.avatarFg },
  editBtn: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: P.green,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: P.canvas,
  },
  name: { fontFamily: R.font.displayXBold, fontSize: 20, color: P.textPrim, marginTop: R.space.md },
  phone: { fontFamily: R.font.body, fontSize: 13.5, color: P.textSec, marginTop: 3 },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: P.radius.card,
    paddingVertical: R.space.lg,
    paddingHorizontal: R.space.sm,
    marginTop: R.space.gut,
    alignSelf: 'stretch',
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontFamily: R.font.displayXBold, fontSize: 18, color: P.textPrim },
  statLabel: { fontFamily: R.font.mono, fontSize: 9, letterSpacing: 1, color: P.textMuted },
  statSep: { width: 1, height: 28, backgroundColor: P.divider },
});
