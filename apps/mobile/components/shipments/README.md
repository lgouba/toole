# Mes envois (client) — refonte variante B (accent de statut)

Refonte de `app/(client)/shipments.tsx`.

## Composants
- `StatusFilters` — 4 pills à **largeurs égales (`flex:1`)** → toujours sur une
  ligne, **jamais coupées**, pas de scroll horizontal (corrige le bug « Annulées » rognée).
- `ShipmentCard` — barre d'accent de statut à gauche + référence (mono) + badge +
  motif billet (`RouteMini`) + encart live (si en cours) + pied (catégorie ·
  destinataire + prix FCFA) + temps écoulé. Carte en cours mise en avant (ombre verte).
- `RouteMini` — motif billet compact (point vert départ → pointillé → carré sombre arrivée).

## Mapping statuts backend → buckets UI (`toBucket`)
- **en_cours** ← scheduled / pending / accepted / picking_up / picked_up / delivering
- **livree** ← delivered
- **annulee** ← cancelled / expired

Couleurs d'accent/badge dans `shipmentStatus` (recapTokens).

## Filtre
`all` = tout ; sinon `toBucket(status) === filtre`. Le filtre ne re-render que la liste (useMemo).

## États
- **Chargement** : `SkeletonList`.
- **Vide global** (aucun envoi) : icône + texte + **CTA « Envoyer un colis »** (→ étape 1).
- **Vide par filtre** : « Aucun envoi dans cette catégorie. »
- **Pull-to-refresh** : `RefreshControl` → `fetchDeliveries`.

## Référence & temps
Référence = `delivery.reference` (format backend `TOL-YYYYMMDD-XXXX`), affichée en mono.
Temps écoulé = `relativeTime()` (date-fns `formatDistanceToNow` + locale `fr`).

## Navigation
Tap carte : en cours → `setActiveDelivery` + `/(client)/active-delivery` (suivi) ;
sinon → `/delivery/[id]` (détail). Lien « Suivre » (en cours) → suivi.

## Écart
Pas de pagination (l'API `/deliveries` renvoie la liste complète du client) —
FlatList simple. Montants FCFA via `formatCFA`.
