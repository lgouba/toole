# Profil livreur — refonte

Refonte de `app/(driver)/profile.tsx` (en-tête + sections groupées, orienté livreur).

## Composants
- `DriverProfileHeader` — avatar initiales (+ **badge vérifié** ✓ conditionnel),
  nom, tél `🇧🇫 +226 …`, **note ★ + avis** (« Pas encore noté » si 0), + bandeau
  **stats** (Courses / Acceptation / Depuis).
- `MenuSection` (réutilisé du profil client, étendu) — supporte désormais un
  **chip de statut** + un **sous-libellé** par ligne.

## Sections & routes
- ACTIVITÉ : Mes statistiques → `/(driver)/stats`.
- COMPTE : Modifier le profil → `/profile-edit` · Mes documents → `/(driver)/kyc`
  (+ **chip statut**) · Moyen de retrait → `/(driver)/wallet` (sous-libellé « Mobile Money · ···XX »).
- APPLICATION : Paramètres → `/settings` · À propos & support → `/about`.

## Badge vérifié & statut documents (`utils/documentsStatus.ts`)
Le profil auth (`/auth/me`) n'expose qu'un booléen **`isVerified`** (pas l'état
pièce par pièce). Donc :
- `verified` = `user.isVerified` → badge ✓.
- chip Documents : vérifié → **À jour** (vert) ; sinon → **En vérification** (neutre).
> TODO produit : exposer le statut par pièce (CNIB/permis/assurance) pour
> distinguer « À compléter » / « À renouveler ».

## Stats
`getMyDriverStats()` : Courses = `totalDeliveries`, Acceptation = `acceptanceRate`,
Depuis = année `createdAt`. État vide → « — » / 0.

## Déconnexion
Bouton rouge → **confirmation** (`Alert`) avant `logout()`. (Pas de hook `useLogout`
dédié : on réutilise `useAuthStore().logout` — écart assumé vs le brief.)

## Écarts
- Pas d'écran `PayoutMethod` dédié → « Moyen de retrait » pointe vers le
  Portefeuille (le numéro de retrait = le tél du livreur, choisi au moment du
  retrait dans `wallet-flow`). Sous-libellé = 2 derniers chiffres du tél.
- Footer « Toolé Driver · v{version} » via `expo-constants`.
