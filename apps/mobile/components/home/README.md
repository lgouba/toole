# Accueil client — carte + livreurs en ligne

Refonte de `app/(client)/index.tsx` (accueil = lanceur + surface d'état).

## Composants
- `HowItWorks` — 3 étapes (Décris / Indique le trajet / Un livreur s'en charge).
- `Reassurance` — Rapide · Paiement à la livraison · Suivi en temps réel.
- Carte = composant partagé `components/map/Map` en `theme="soft"` (tuiles
  CartoDB Positron désaturées, sans labels), marqueurs `icon:'courier'` (moto).

## Provider carte (écart vs brief)

Le brief suggère react-native-maps / Mapbox. **Le repo utilise Leaflet en WebView**
(`Map.tsx`) → on reste dessus : **zéro dépendance native, OTA-safe**, style
désaturé via Positron. Pas de pin de sélection, pas de saisie d'adresse : la
carte est **décorative** (pan/zoom uniquement).

## Livreurs en ligne (temps réel)

Source = `useDeliveryStore().nearbyDrivers` (vrais livreurs en ligne proches, via
`fetchNearbyDrivers`), rafraîchi **toutes les 20s au focus** et **coupé hors focus**
(perf/batterie). Mapping état → couleur du marqueur :
- en ligne (`online: true`) → moto **verte `#15803D`** + halo qui pulse ;
- hors ligne (`online: false`) → moto **grise `#AEB2AB`** (pas d'utilisation
  actuelle : `nearbyDrivers` ne renvoie que des livreurs en ligne).

**Pas de nouvel event Socket.IO** ajouté (il n'existe pas de flux public
"livreurs en ligne autour de moi"). Pour brancher un vrai flux temps réel
plus tard (ex. `courier:online` / `courier:position`), il suffit d'alimenter la
même liste de marqueurs `courier` — l'UI ne change pas.

## Onboarding = lanceur uniquement

Salutation + CTA + « Comment ça marche » + réassurance. **Le CTA ouvre l'étape 1**
(`/(client)/new-delivery`) — aucun composant de saisie des étapes 1→5 n'est réutilisé.
Aucune saisie d'adresse sur l'accueil.

## État "envoi en cours"

Si une livraison est active (`activeDelivery.status` ∈ accepted/picking_up/
picked_up/delivering), le CTA bascule sur **« Suivre ma livraison »** →
`/(client)/active-delivery`, et l'onboarding est masqué. (Le bandeau global
`ActiveDeliveryBanner` reste disponible partout.)

## Écart layout

Layout **A** (carte plein écran + salutation flottante + panneau bas) plutôt que
le bottom-sheet glissable (B) — plus robuste, sans dépendance sheet. Le panneau
reste compact (règle "sans scroll"). B (sheet draggable) possible plus tard.
