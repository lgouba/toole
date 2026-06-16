# Mes livraisons (livreur)

Refonte de `app/(driver)/deliveries.tsx` — historique côté **livreur** (≠ « Mes envois » client).

## Composants
- `WeekSummary` — titre + « Cette semaine · {n} courses · {gains} FCFA ».
- `DeliveryFilters` — pills `flex:1` (Toutes / En cours / Terminées / Annulées), jamais tronquées.
- `DriverDeliveryCard` — accent statut, référence (mono) + badge, motif billet
  (`RouteMini` réutilisé), **gain vert `+X FCFA`** (rémunération livreur), catégorie ·
  destinataire · distance, temps relatif FR. Course **en cours** : ligne live +
  bouton **« Continuer la livraison »** + point pulsant.

## Mapping statuts → buckets (`toBucket`, utils/relativeTime)
- **en_cours** ← scheduled/pending/accepted/picking_up/picked_up/delivering
- **livree** ← delivered
- **annulee** ← cancelled/expired

Couleurs dans `deliveries.status` (recapTokens).

## Rémunération (gain affiché) — `utils/courierEarning.ts`
Gain = **rémunération livreur**, PAS le prix client. Règle : `driverCommission`
(= prix − commission plateforme) ; repli `price − platformFee` puis `price`.
> ⚠️ TODO produit : confirmer **gain = commission livreur** (par défaut) **vs montant complet**.

## Résumé semaine
Somme `courierEarning` + nombre de `delivered` de la **semaine en cours** (lundi
00:00), calculée en **heure Ouaga (UTC+0)** côté client (agrégation depuis la liste).
> TODO : déplacer côté API si volume important.

## Course en cours (épinglée)
Triée en tête. « Continuer la livraison » → `useDriverStore.setState({activeDelivery})`
puis navigation : `picked_up`/`delivering` → `delivery-navigation`, sinon `pickup-navigation`.

## États / data
FlatList + pull-to-refresh ; vide global / vide par filtre / skeleton. Tap carte →
`/delivery/[id]`. Distance = `estimatedDistanceKm` (masquée si absente).
> Écart : pas de pagination (l'API renvoie la liste complète). Pas de champ "raison
> d'annulation" sur `Delivery` (seul `cancelledAt`) → on affiche « · annulée ».
