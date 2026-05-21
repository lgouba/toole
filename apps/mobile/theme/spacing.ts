export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Border radius genereux pour le design "Friendly & Local" (Concept C).
// Les cards et CTA principaux ont des coins tres arrondis (20-28) qui
// donnent l'aspect chaleureux et moderne du design valide.
export const borderRadius = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
  pill: 100,
  full: 9999,
} as const;

export const sizes = {
  buttonHeight: 56,        // un peu plus grand pour CTA accueillants
  buttonHeightSmall: 44,
  inputHeight: 52,
  iconSm: 20,
  iconMd: 24,
  iconLg: 32,
  avatarSm: 32,
  avatarMd: 48,
  avatarLg: 64,
  avatarXl: 88,
} as const;

// Ombres preconfigurees pour donner du relief aux cards (style Concept C).
// Utilisable avec ...shadow.md dans un StyleSheet.
export const shadow = {
  sm: {
    shadowColor: '#9A3412',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: '#9A3412',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 5,
  },
  lg: {
    shadowColor: '#9A3412',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
} as const;
