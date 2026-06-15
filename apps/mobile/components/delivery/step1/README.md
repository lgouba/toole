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

## Héros = sac Toolé (BagHero) — MàJ

L'objet héros est désormais le **sac de livraison Toolé** (`BagHero.tsx`), plus le
carton (`ParcelBox.tsx` conservé mais non utilisé). **Ombre au sol supprimée.**

- Rendu **SVG** (react-native-svg) — vert `#15803D` (constante `GREEN` dans
  `BagHero.tsx`), roll-top, poche zippée + passepoil gris, poignée, bretelles,
  wordmark blanc « Toolé » (overlay RN Text, police `displayXBold`).
### Deux rendus (3D natif + fallback SVG)

- `BagHero3D.tsx` = **vrai 3D** (expo-gl + three + expo-three), modèle exact du
  §4 (corps, roll-top, poche, passepoil, poignée demi-tore, bretelles), lumières
  ambiante+directionnelle, rotation idle `rotation.y += 0.012`, échelle lerp,
  wordmark = texture PNG (`assets/images/toole-wordmark.png`). Pas de sol/ombre.
- `BagHeroSVG.tsx` = **fallback** (oscillation rotateY douce + flottement).
- `BagHero.tsx` = orchestrateur : `require('./BagHero3D')` dans un `try/catch`
  + error boundary. expo-gl appelle `requireNativeModule` à l'IMPORT → sur un
  binaire SANS expo-gl natif, le require échoue → repli SVG, **sans crash (OTA-safe)**.
  Le 3D ne s'active donc **qu'après un build natif** incluant expo-gl.

**Build requis pour activer le 3D** : `eas build` (expo-gl est natif). Les
installs OTA actuelles restent sur le SVG. Profiler `pixelRatio` sur entrée de
gamme si besoin (actuellement rendu natif via GLView 122×134).
- Échelle ressort selon la taille (s/m/l → 0.82/1.0/1.18), dans `BagHero` (`SCALE`).
- Couleur à ajuster : `GREEN`/`GREEN_DK`/`GREEN_SIDE` en haut de `BagHero.tsx`.

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
