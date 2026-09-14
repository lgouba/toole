import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';
import { UserRole, VehicleType } from '@/types';
import { RegisterLayout } from '@/hooks/useRegisterLayout';

/**
 * Carte d'identité Toolé qui se fabrique en direct pendant l'inscription.
 * AUCUNE logique métier : elle lit l'état du formulaire et l'affiche. Les
 * emplacements vides sont des points (•) — ce qui reste à faire est lisible
 * dans l'objet lui-même. Dimensions pilotées par le palier (jamais pendant un
 * parcours). Valeurs chiffrées en monospace + slots à largeur fixe → aucun
 * sautillement pendant la frappe.
 */

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })!;

const VEHICLE_GLYPH: Record<VehicleType, keyof typeof MaterialIcons.glyphMap> = {
  moto: 'two-wheeler',
  velo: 'pedal-bike',
  tricycle: 'electric-rickshaw',
  voiture: 'directions-car',
};

const FILL = '#FFFFFF';
const DOT = 'rgba(255,255,255,0.32)';

/**
 * Rend `groups` cellules monospace : les `value.length` premières portent le
 * caractère saisi (blanc), les autres un • atténué. Largeur constante : une
 * cellule vide devenue pleine ne décale rien.
 */
function Slots({
  value,
  groups,
  size,
}: {
  value: string;
  groups: number[];
  size: number;
}) {
  const cells: React.ReactNode[] = [];
  let idx = 0;
  groups.forEach((g, gi) => {
    if (gi > 0) cells.push(<Text key={`sp${gi}`}>{'  '}</Text>);
    for (let k = 0; k < g; k++) {
      const c = idx < value.length ? value[idx] : null;
      cells.push(
        <Text key={`c${idx}`} style={{ color: c == null ? DOT : FILL }}>
          {c == null ? '•' : c}
        </Text>,
      );
      idx++;
    }
  });
  return (
    <Text
      maxFontSizeMultiplier={1.3}
      style={{ fontFamily: MONO, fontWeight: '700', fontSize: size, color: FILL, letterSpacing: 0.5 }}
      numberOfLines={1}
    >
      {cells}
    </Text>
  );
}

function initials(firstName: string, lastName: string): string {
  const a = firstName.trim()[0] ?? '';
  const b = lastName.trim()[0] ?? '';
  return (a + b).toUpperCase();
}

/** Barre compacte (paysage) : pastille + nom + badge, 44 pt. */
export function InscriptionBar({
  role,
  firstName,
  lastName,
}: {
  role: UserRole | null;
  firstName: string;
  lastName: string;
}) {
  const ini = initials(firstName, lastName);
  const name = `${firstName} ${lastName}`.trim();
  return (
    <View style={styles.bar}>
      <View style={styles.barAvatar}>
        {ini ? (
          <Text style={styles.barAvatarText}>{ini}</Text>
        ) : (
          <MaterialIcons name="person" size={16} color="rgba(255,255,255,0.5)" />
        )}
      </View>
      <Text style={styles.barName} numberOfLines={1}>
        {name || 'Votre carte'}
      </Text>
      <RoleBadge role={role} vehicleType={null} small />
    </View>
  );
}

function RoleBadge({
  role,
  vehicleType,
  onPress,
  small,
}: {
  role: UserRole | null;
  vehicleType?: VehicleType | null;
  onPress?: () => void;
  small?: boolean;
}) {
  let bg = 'transparent';
  let border = 'rgba(255,255,255,0.34)';
  let color = 'rgba(255,255,255,0.45)';
  let label = '•••';
  let dashed = true;

  if (role === 'client') {
    bg = 'rgba(255,255,255,0.16)';
    border = 'rgba(255,255,255,0.26)';
    color = 'rgba(255,255,255,0.88)';
    label = 'CLIENT';
    dashed = false;
  } else if (role === 'driver') {
    bg = 'rgba(240,196,96,0.24)';
    border = 'rgba(245,214,140,0.5)';
    color = '#FFE3AC';
    label = 'LIVREUR';
    dashed = false;
  }

  const content = (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          borderColor: border,
          borderStyle: dashed ? 'dashed' : 'solid',
          paddingVertical: small ? 4 : 5,
          paddingHorizontal: small ? 9 : 11,
        },
      ]}
    >
      {role === 'driver' && vehicleType ? (
        <MaterialIcons name={VEHICLE_GLYPH[vehicleType]} size={13} color={color} style={{ marginRight: 5 }} />
      ) : null}
      <Text
        maxFontSizeMultiplier={1.3}
        style={[styles.badgeText, { color, fontSize: small ? 8.5 : 9 }]}
      >
        {label}
      </Text>
      {role && onPress ? (
        <MaterialIcons name="edit" size={10} color={color} style={{ marginLeft: 5, opacity: 0.7 }} />
      ) : null}
    </View>
  );

  if (role && onPress) {
    return (
      <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel="Modifier le rôle">
        {content}
      </Pressable>
    );
  }
  return content;
}

export interface InscriptionCardProps {
  role: UserRole | null;
  firstName: string;
  lastName: string;
  day: string;
  month: string;
  year: string;
  /** Chiffres saisis du téléphone (max 8), SANS le préfixe +226. */
  phone: string;
  vehicleType?: VehicleType | null;
  vehiclePlate?: string;
  onEditRole?: () => void;
  layout: RegisterLayout;
  /** Masque la ligne TITULAIRE (palier serré, étapes ≥ 3 : le nom est acquis). */
  hideTitulaire?: boolean;
}

export function InscriptionCard({
  role,
  firstName,
  lastName,
  day,
  month,
  year,
  phone,
  vehicleType,
  vehiclePlate,
  onEditRole,
  layout,
  hideTitulaire,
}: InscriptionCardProps) {
  const { cardW, cardH, cardRowGap, cardPadV, stackBottomRow } = layout;
  const ini = initials(firstName, lastName);
  const name = `${firstName} ${lastName}`.trim();

  // Date : DD MM YYYY (groupes 2/2/4). On concatène les chiffres saisis dans
  // l'ordre visuel pour que les points se remplissent de gauche à droite.
  const dateValue = `${day}${month}${year}`;
  const dateGroups = [2, 2, 4];
  const showPlate = role === 'driver' && !!vehiclePlate?.trim();

  const naissance = (
    <View style={styles.field}>
      <Text maxFontSizeMultiplier={1.3} style={styles.slotLabel}>
        NAISSANCE
      </Text>
      <Slots value={dateValue} groups={dateGroups} size={14} />
    </View>
  );
  const telephone = (
    <View style={styles.field}>
      <Text maxFontSizeMultiplier={1.3} style={styles.slotLabel}>
        TÉLÉPHONE
      </Text>
      <Text
        maxFontSizeMultiplier={1.3}
        style={styles.phoneLine}
        numberOfLines={1}
      >
        <Text style={styles.phonePrefix}>+226 </Text>
        <Slots value={phone} groups={[2, 2, 2, 2]} size={14} />
      </Text>
    </View>
  );

  return (
    <View style={[styles.card, { width: cardW, height: cardH }]}>
      {/* Dégradé 145° */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <LinearGradient id="insc" x1="0.15" y1="0" x2="0.85" y2="1">
            <Stop offset="0" stopColor="#23B063" />
            <Stop offset="0.42" stopColor="#14853F" />
            <Stop offset="1" stopColor="#06341F" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" rx={24} fill="url(#insc)" />
      </Svg>
      {/* Décor (overflow hidden par le radius de la carte) */}
      <View pointerEvents="none" style={styles.decorClip}>
        <View style={styles.circleA} />
        <View style={styles.circleB} />
        <View style={styles.band} />
      </View>

      <View style={[styles.inner, { paddingVertical: cardPadV }]}>
        {/* Rangée haut : Toolé + badge */}
        <View style={styles.topRow}>
          <Text maxFontSizeMultiplier={1.3} style={styles.wordmark}>
            Toolé
          </Text>
          <RoleBadge role={role} vehicleType={vehicleType} onPress={onEditRole} />
        </View>

        {/* Chip plaque (livreur, si saisie) */}
        {showPlate ? (
          <View style={styles.plateChip}>
            <Text maxFontSizeMultiplier={1.3} style={styles.plateText} numberOfLines={1}>
              {vehiclePlate!.trim().toUpperCase()}
            </Text>
          </View>
        ) : null}

        {/* Titulaire (pastille + nom) */}
        {!hideTitulaire ? (
          <View style={[styles.holderRow, { marginTop: cardRowGap * 0.5 }]}>
            <View style={[styles.avatar, ini ? styles.avatarFilled : styles.avatarEmpty]}>
              {ini ? (
                <Text maxFontSizeMultiplier={1.3} style={styles.avatarText}>
                  {ini}
                </Text>
              ) : (
                <MaterialIcons name="person" size={22} color="rgba(255,255,255,0.5)" />
              )}
            </View>
            <View style={styles.holderText}>
              <Text maxFontSizeMultiplier={1.3} style={styles.slotLabel}>
                TITULAIRE
              </Text>
              {name ? (
                <Text maxFontSizeMultiplier={1.3} style={styles.holderName} numberOfLines={1}>
                  {name}
                </Text>
              ) : (
                <Text maxFontSizeMultiplier={1.3} style={styles.holderNameEmpty} numberOfLines={1}>
                  •••••• •••••••
                </Text>
              )}
            </View>
          </View>
        ) : null}

        {/* Rangée bas : naissance / téléphone */}
        <View style={[styles.bottomRow, { marginTop: 'auto' }, stackBottomRow && styles.bottomStack]}>
          {stackBottomRow ? (
            <>
              {naissance}
              <View style={{ height: 10 }} />
              {telephone}
            </>
          ) : (
            <>
              <View style={{ width: '44%' }}>{naissance}</View>
              <View style={{ flex: 1 }}>{telephone}</View>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#06341F',
    shadowColor: 'rgba(8,60,32,1)',
    shadowOpacity: 0.32,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 18 },
    elevation: 10,
  },
  decorClip: { ...StyleSheet.absoluteFillObject, borderRadius: 24, overflow: 'hidden' },
  circleA: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(255,255,255,0.10)',
    right: -70,
    top: -80,
  },
  circleB: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.06)',
    left: -60,
    bottom: -110,
  },
  band: {
    position: 'absolute',
    width: 300,
    height: 70,
    backgroundColor: 'rgba(255,255,255,0.05)',
    left: -40,
    top: 20,
    transform: [{ rotate: '-18deg' }],
  },
  inner: { flex: 1, paddingHorizontal: 22 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { fontFamily: 'BricolageGrotesque_800ExtraBold', fontSize: 16, color: '#FFFFFF' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: { fontWeight: '700', letterSpacing: 1.3 },
  plateChip: {
    position: 'absolute',
    right: 22,
    top: 66,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  plateText: {
    fontFamily: MONO,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.9,
    color: 'rgba(255,255,255,0.82)',
  },
  holderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarEmpty: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.35)',
  },
  avatarFilled: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.26)',
  },
  avatarText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 16, color: '#FFFFFF' },
  holderText: { flex: 1, minWidth: 0 },
  slotLabel: {
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 1.3,
    color: 'rgba(255,255,255,0.58)',
    marginBottom: 3,
  },
  holderName: {
    fontFamily: 'BricolageGrotesque_700Bold',
    fontSize: 17,
    letterSpacing: -0.17,
    color: '#FFFFFF',
  },
  holderNameEmpty: { fontFamily: MONO, fontSize: 16, color: DOT, letterSpacing: 1 },
  bottomRow: { flexDirection: 'row', alignItems: 'flex-end' },
  bottomStack: { flexDirection: 'column', alignItems: 'flex-start' },
  field: {},
  phoneLine: { color: '#FFFFFF' },
  phonePrefix: { fontFamily: MONO, fontWeight: '700', fontSize: 14, color: 'rgba(255,255,255,0.75)' },
  // Barre paysage
  bar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#12803E',
  },
  barAvatar: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  barAvatarText: { fontFamily: 'BricolageGrotesque_700Bold', fontSize: 12, color: '#FFFFFF' },
  barName: { flex: 1, fontFamily: 'BricolageGrotesque_700Bold', fontSize: 14, color: '#FFFFFF' },
});
