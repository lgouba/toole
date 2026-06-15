# Étape 2 · Trajet — refonte inline (sans carte)

Refonte de l'étape "adresses" (step index 1) de la création de colis.
Branchée dans `app/(client)/new-delivery.tsx` via `<TripStep2 />`.

## Composants

- `RouteTargets` — carte "billet" : Départ (rond vert) / Arrivée (carré noir),
  liseré vert sur la ligne active, point qui pulse, flash vert à la pose. Pas
  d'étiquette "Modifier".
- `AddressSource` — panneau qui alimente la ligne active : recherche + suggestions,
  GPS "Ma position" (Départ uniquement), tuiles favorites (Maison/Bureau), récents
  (cascade), action "Coller un lien Google Maps / WhatsApp".
- `TripSummary` — bandeau noir : distance / durée / estimation, slide-up + compteurs.
- `TripStep2` — assemble, gère la ligne active + auto-avance Départ→Arrivée.

## Dépendances

**Aucune dépendance ajoutée** (OTA-safe). Réutilise :
- **Géocodage** : `utils/geocode.ts` (provider **Nominatim/OSM** déjà en place,
  amélioré : reverse honnête + autocomplétion bornée à la ville). Divergence vs
  le brief (qui suggérait Google Places) : on garde le provider existant gratuit ;
  l'abstraction permet de basculer plus tard.
- **GPS** : `expo-location`. Permission refusée → message + repli sur la recherche.
- **Coller un lien** : `utils/parseLocation.ts` (`parseLocationUrl`, `isShortLocationUrl`).
  Liens courts (`maps.app.goo.gl`…) → on invite à coller l'URL complète.
- **Favoris** : `stores/addressFavorites.store` (Maison/Bureau).
- **Récents** : `stores/recentPlaces.store` (NOUVEAU, persisté AsyncStorage).
- **Estimation** : `useDeliveryPrice` (distance + prix, **cohérent avec le récap**) ;
  durée approximée (distance / 20 km/h urbain Ouaga).

## Animations (reanimated)

- Ligne active : liseré vert + pulse du point. Flash vert ~0.6s à la pose.
- Récents : `entering={FadeInDown.delay(i*55)}` ; la **liste** est remontée
  (`key={active}`) à chaque bascule → seules les lignes ré-animent, pas le panneau.
- Bandeau récap : slide-up + compteurs count-up ~750ms (respecte reduce-motion).

## Données / flow

Écrit dans le `draft` existant : `pickupAddress/pickupLocation`,
`deliveryAddress/deliveryLocation`. **Aucun changement backend.** "Continuer"
désactivé tant que les deux points n'ont pas de coordonnées valides.

## Divergences assumées vs le brief

- **Provider = Nominatim** (existant) et non Google Places.
- `TripSummary`/`ContinueBar` : bandeau rendu inline (sous le billet) + footer
  partagé de l'assistant, plutôt que des barres absolues dédiées.
- L'ancien champ "indication d'accès" (porte/étage) n'est plus capturé ici
  (le design épuré ne le prévoit pas) — champ optionnel côté backend, sans impact.
- Pas de `react-native-maps` (volontaire, conforme au brief).
