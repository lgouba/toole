import { PackageCategory } from '@/types';

/**
 * Données des catégories pour la grille d'icônes (étape 1).
 *
 * ⚠️ Les ICÔNES restent les EMOJI de l'ancien design (cf. PACKAGE_CATEGORY_META).
 * On ne remplace PAS par des Material Symbols / SVG. Ici on ajoute juste le
 * label court + les couleurs de tuile (fond + teinte) du brief.
 * La clé `key` correspond au PackageCategory du draft (zéro mapping à faire).
 */
export interface CategoryItem {
  key: PackageCategory;
  emoji: string;
  short: string;
  canonical: string;
  bg: string;
  tint: string;
}

export const CATEGORIES: CategoryItem[] = [
  { key: 'meal', emoji: '🍽️', short: 'Repas', canonical: 'Repas & nourriture', bg: '#FCE9D8', tint: '#DC7A2C' },
  { key: 'cake', emoji: '🍰', short: 'Pâtisserie', canonical: 'Gâteaux & pâtisseries', bg: '#FBE2EC', tint: '#CE4A82' },
  { key: 'fresh', emoji: '🧊', short: 'Frais', canonical: 'Produits frais & surgelés', bg: '#E0EEFB', tint: '#2C7CC2' },
  { key: 'grocery', emoji: '🛒', short: 'Épicerie', canonical: 'Épicerie & autres courses', bg: '#E2F2E7', tint: '#2E9E54' },
  { key: 'pharmacy', emoji: '💊', short: 'Pharmacie', canonical: 'Pharmacie & produits sensibles', bg: '#FBE1E0', tint: '#D2433D' },
  { key: 'cosmetics', emoji: '💄', short: 'Beauté', canonical: 'Cosmétiques & beauté', bg: '#EFE7FB', tint: '#7E55E6' },
  { key: 'gift', emoji: '🎁', short: 'Cadeaux', canonical: 'Cadeaux & objets fragiles', bg: '#FBEFD6', tint: '#C5961A' },
  { key: 'other', emoji: '📦', short: 'Divers', canonical: 'Colis & Divers', bg: '#E9EDE6', tint: '#5E7A4E' },
];
