# Écran Récapitulatif — direction "billet / itinéraire"

Refonte de l'étape 5 (récap) de la création de colis. Branché dans
`app/(client)/new-delivery.tsx` (step index 4) via `<DeliveryRecap />`.

## Composants

- `RouteTicket` — trajet récup→livraison, perforation (effet ticket), détail prix + total.
- `InfoGrid` — grille 2 colonnes (taille / catégorie / paiement / destinataire).
- `PromoField` — code promo (input dashed + bouton Appliquer). Validé via l'API existante.
- `ScheduleDelivery` — toggle + carrousel de créneaux + champs date/heure → molette.
- `QuickSlotsCarousel` — créneaux suggérés (heures réelles calculées, créneaux passés filtrés).
- `WheelPicker` (`WheelColumn`) — colonne de molette.
- `DateTimeWheelSheet` — bottom-sheet de sélection date/heure.
- `DeliveryRecap` — assemble le tout.

## Dépendances

**Aucune dépendance ajoutée.** Choix volontaire (compatibilité OTA, pas de rebuild natif) :

- **Wheel picker = Option B custom** (et NON l'Option A `@react-native-community/datetimepicker`).
  Raison : ce package est un **module natif** absent du build → l'ajouter casserait
  l'OTA (crash). On a donc construit une molette **100% JS** (ScrollView + `snapToInterval`),
  identique iOS/Android.
- **Bottom-sheet** : `Modal` natif RN (`@gorhom/bottom-sheet` n'est pas au projet).

## Polices (mappées sur la marque, pas de nouvelle police)

- `display` → `BricolageGrotesque_700Bold`
- `body` → `PlusJakartaSans_500/700`
- `mono` → monospace natif (`Menlo` iOS / `monospace` Android)

## Fuseau horaire

`APP_TIMEZONE = 'Africa/Ouagadougou'` (UTC+0, sans DST). Toute l'arithmétique
des créneaux utilise les getters/setters **UTC** (robuste quel que soit le fuseau
du téléphone) ; l'affichage passe par `Intl.DateTimeFormat('fr-FR', { timeZone })`.
Rien n'est hardcodé : tout dérive de `new Date()`.

## Données

Consomme le `DeliveryDraft` + `PriceEstimate` existants. **Aucun changement
backend ni de la logique de pricing.** Le créneau programmé est stocké dans
`draft.scheduledFor` en ISO 8601 (contrat identique à l'ancien `SchedulePicker`).

## Divergences assumées vs le brief design

- Devise **FCFA** (pas EUR), adresses **Ouagadougou** (pas Marseille).
- Tokens dans `theme/recapTokens.ts` ; l'accent vert correspond au `secondary`
  (vert kola) du thème global. Le reste de l'app reste en terra-cotta.
