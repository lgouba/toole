import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { recap as R, profile as P } from '@/theme/recapTokens';
import { formatPhone } from '@/utils/format';

interface Props {
  fullName: string;
  phone: string;
  verified: boolean;
  ratingAvg: number;
  ratingCount: number;
  stats?: { courses: number; acceptance: number | null; sinceYear?: number } | null;
  onEdit: () => void;
}

function initialsOf(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

export function DriverProfileHeader({ fullName, phone, verified, ratingAvg, ratingCount, stats, onEdit }: Props) {
  const hasRatings = ratingCount > 0;
  return (
    <View style={styles.wrap}>
      <View style={styles.avatarWrap}>
        <View style={styles.avatar}>
          <Text style={styles.initials}>{initialsOf(fullName)}</Text>
        </View>
        {verified ? (
          <View style={styles.verified}>
            <MaterialIcons name="check" size={13} color="#FFFFFF" />
          </View>
        ) : (
          <TouchableOpacity style={styles.editBtn} onPress={onEdit}>
            <MaterialIcons name="edit" size={13} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.name}>{fullName}</Text>
      <Text style={styles.phone}>🇧🇫 {formatPhone(phone)}</Text>

      <View style={styles.ratingRow}>
        <MaterialIcons name="star" size={16} color={hasRatings ? P.star : P.textMuted} />
        {hasRatings ? (
          <Text style={styles.rating}>
            {ratingAvg.toFixed(1)} <Text style={styles.ratingCount}>· {ratingCount} avis</Text>
          </Text>
        ) : (
          <Text style={styles.ratingCount}>Pas encore noté</Text>
        )}
      </View>

      <View style={styles.statsRow}>
        <Stat value={stats ? String(stats.courses) : '—'} label="COURSES" />
        <View style={styles.sep} />
        <Stat value={stats && stats.acceptance != null ? `${Math.round(stats.acceptance)}%` : '—'} label="ACCEPTATION" />
        <View style={styles.sep} />
        <Stat value={stats?.sinceYear ? String(stats.sinceYear) : '—'} label="DEPUIS" />
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
  wrap: { alignItems: 'center', paddingTop: R.space.md, paddingBottom: R.space.lg },
  avatarWrap: { width: 84, height: 84 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: P.avatarBg, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: R.font.displayXBold, fontSize: 30, color: P.avatarFg },
  verified: {
    position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14,
    backgroundColor: P.green, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: P.canvas,
  },
  editBtn: {
    position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14,
    backgroundColor: P.textMuted, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: P.canvas,
  },
  name: { fontFamily: R.font.displayXBold, fontSize: 20, color: P.textPrim, marginTop: R.space.md },
  phone: { fontFamily: R.font.mono, fontSize: 13, color: P.textSec, marginTop: 3 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  rating: { fontFamily: R.font.bodyBold, fontSize: 13.5, color: P.textPrim },
  ratingCount: { fontFamily: R.font.body, fontSize: 13, color: P.textMuted },
  statsRow: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch',
    backgroundColor: P.surface, borderRadius: P.radius.card, borderWidth: 1, borderColor: P.border,
    paddingVertical: R.space.lg, marginTop: R.space.gut,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontFamily: R.font.displayXBold, fontSize: 17, color: P.textPrim },
  statLabel: { fontFamily: R.font.mono, fontSize: 8.5, letterSpacing: 1, color: P.textMuted },
  sep: { width: 1, height: 28, backgroundColor: P.divider },
});
