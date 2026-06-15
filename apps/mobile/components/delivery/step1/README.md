# Étape 1 · Colis — refonte "scène héro"

Refonte de l'étape 0 (taille + catégorie + détails) de la création de colis.
Branchée dans `app/(client)/new-delivery.tsx` (step index 0) via `<PackageStep1 />`.

## Composants

- `SizeStage` — scène + carton qui grandit/rétrécit (spring) + ombre au sol + segmenté Petit/Moyen/Grand + readout.
- `ParcelBox` — carton kraft 2.5D en `react-native-svg`.
- `CategoryGrid` — grille **4 colonnes**, tuile colorée + **emoji** + label court, sélection unique (anneau vert + check).
- `OptionalDetails` — bloc repliable (fermé par défaut) : description, valeur estimée (FCFA), colis fragile (switch).
- `PackageStep1` — assemble le tout.

## Dépendances

**Aucune dépendance ajoutée.** `react-native-svg` et `react-native-reanimated`
sont **déjà** dans le build (utilisés ailleurs) → carton SVG + spring sans
nouveau module natif (OTA-safe, pas de rebuild).

## Animation

- **Reanimated** (`useSharedValue` + `withSpring damping 12 / stiffness 180`)
  pour le redimensionnement du carton ; `transformOrigin: 'center bottom'` pour
  qu'il "grandisse depuis le sol". L'ombre au sol s'élargit (scaleX) + opacité.
- **LayoutAnimation** pour l'ouverture/fermeture du bloc Détails.

## ⚠️ Icônes catégories = EMOJI existants

Les catégories utilisent les **emoji de l'ancien design** (🍽️🍰🧊🛒💊💄🎁📦),
repris depuis `PACKAGE_CATEGORY_META`. **Aucun** Material Symbols / SVG custom
pour les catégories. Seules les icônes de chrome (chevron, edit-note, warning)
viennent de `@expo/vector-icons`.

## Données / flow

Consomme le `DeliveryDraft` existant : `packageSize` (+ `packageType` legacy via
`SIZE_TO_LEGACY_TYPE`), `packageCategory`, `packageDescription`, `declaredValue`,
`isFragile`. **Aucun changement backend.** La taille a un défaut **Moyen**
(posé au montage) ; « Continuer » est désactivé tant qu'aucune **catégorie**
n'est choisie.

## Divergences assumées vs le brief

- `ContinueBar` : on réutilise le **footer partagé** de l'assistant (convention
  repo) plutôt qu'une barre dédiée par écran.
- Fond de scène : aplat `stageBg` (vert très clair) au lieu d'un dégradé radial
  (évite une dépendance gradient) — rendu équivalent.
- Polices mappées sur la marque (Bricolage display / PlusJakarta UI / mono natif).
