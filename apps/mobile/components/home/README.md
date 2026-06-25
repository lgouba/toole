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

Source = **endpoint serveur `GET /drivers/map`** (NOUVEAU) → livreurs proches
**en ligne ET hors ligne récents** avec statut. `findNearbyDrivers` ne renvoyait
que les `isOnline:true` → impossible d'afficher des gris ; d'où ce nouvel endpoint.
Rafraîchi **toutes les 20s au focus**, **coupé hors focus** (perf/batterie).

Mapping état → couleur du marqueur :
- `status:'online'` (en ligne + position fraîche) → moto **verte `#15803D`** + halo pulsant ;
- `status:'offline'` (position < 2h mais hors ligne) → moto **grise `#AEB2AB`**.

Vie privée : coordonnées **arrondies ~3 décimales (≈110 m)** côté serveur, récence
bornée à 2h, liste plafonnée à 40. ⚠️ Note : on expose la dernière position
(approx.) de livreurs hors ligne — choix produit assumé (demande explicite
d'afficher les hors-ligne en gris). À revoir si jugé trop intrusif.

**Pas d'event Socket.IO** (polling 20s). Pour passer en temps réel plus tard,
alimenter la même liste `courier` — l'UI ne change pas.

⚠️ **Déploiement serveur requis** : `/drivers/map` doit être déployé
(`docker compose up -d --build toole-api`), sinon l'accueil affiche 0 livreur.

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
