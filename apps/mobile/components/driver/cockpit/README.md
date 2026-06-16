# Accueil livreur — concept Cockpit (thème clair)

Refonte de `app/(driver)/index.tsx`.

## Composants
- `IgnitionDial` — cadran rond + cœur power (tap = en ligne/hors ligne). En ligne :
  cœur vert, halo qui respire, **ondes radar** (sonar) qui se propagent (reanimated).
- `StatusText` — eyebrow + titre (« HORS LIGNE » → « EN LIGNE » vert) + sous-titre
  + point qui clignote en ligne.
- `DriverKpis` — gains du jour (FCFA) + 3 KPIs (Courses / En ligne / Note).
- `MapScrim` — voile crème **radial** (react-native-svg) par-dessus la carte :
  opaque au centre (lisibilité), transparent sur les bords (rues visibles).

## Carte de fond
Composant partagé `Map` en `theme="soft"` (CartoDB Positron **avec labels** →
**rues + noms visibles**, désaturé), centrée sur la **position réelle** du livreur
(`currentLocation` heartbeat > `userLocation` GPS > Ouaga fallback). Recentrage au
déplacement (seuil ~1km dans `Map`). Carte décorative — le cadran est le contrôle.

> Écart vs brief : carte = **Leaflet/WebView** (convention repo, OTA-safe) au lieu
> de react-native-maps/Mapbox. Voile radial via SVG (pas de CSS radial-gradient en RN).

## En ligne / hors ligne
Tap cadran → `useDriverStore.toggleOnline()` (logique existante : pousse la position
GPS AVANT `setOnlineStatus(true)` puis démarre le tracking — cf. fix CLAUDE.md).
Si pas de position (permission refusée) → alerte « Active la localisation… », pas de
passage en ligne. La réception d'une course (`currentRequest`) ouvre la modale
« Nouvelle demande » montée dans `(driver)/_layout` (inchangé).

## Gains & KPIs
`getMyDriverStats()` au focus : `today.revenue`, `today.deliveredCount`, `ratingAvg`
(si `ratingCount>0`, sinon « — »). **En ligne** = durée locale depuis le passage en
ligne (pas de champ backend) → « — » hors ligne.

## Divers
- Pas d'avatar en haut ; salutation « Bonjour, {prénom} · Toolé Driver ».
- État « Compte en validation » si `user.isActive` faux (pas de cadran).
- Animations radar/halo uniquement en ligne. Onglets driver inchangés.
