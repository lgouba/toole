# Profil client — refonte (en-tête + sections groupées)

Refonte de `app/(client)/profile.tsx`.

## Composants
- `ProfileHeader` — avatar initiales + bouton edit (vert), nom, téléphone
  (🇧🇫 +226 formaté via `formatPhone`), 3 stats (Envois / En cours / Membre).
- `MenuSection` (+ `MenuItem` inline) — libellé caps + carte de lignes
  (chip d'icône teinté + libellé + chevron).

## Entrées & destinations (existantes conservées)
| Section | Ligne | Route |
|---|---|---|
| COMPTE | Modifier le profil | `/profile-edit` |
| COMPTE | Mes adresses | `/(client)/favorites` |
| ACTIVITÉ | Mes envois | `/(client)/shipments` |
| APPLICATION | Paramètres | `/settings` |
| APPLICATION | À propos & support | `/about` |

## Moyens de paiement — RETIRÉ
Aucun écran de gestion des moyens de paiement n'existe (le mode de paiement se
choisit **par course** à l'étape 4 : Espèces / Orange Money / Moov Money). Entrée
**retirée** (conforme au brief : « la garder si le produit la prévoit, sinon la
retirer »). À ajouter si une vraie gestion de moyens de paiement est créée.

## Stats (état vide)
`total` / `active` calculés depuis `getDeliveries('', 'client')` (au focus).
Si pas de stats ou `total === 0` (nouveau compte) → affichage **« — »**
(aucun chiffre inventé). `Membre` = année de `user.createdAt`.

## Déconnexion
Bouton blanc bordure rouge → **confirmation** (`Alert` « Se déconnecter ? »)
AVANT de déconnecter. Pas de logout direct.

## Pied
`Toolé · version x.y.z` via `expo-constants` (`expoConfig.version`).

## Écart
Le picker contacts / certaines routes de groupe expo-router ne sont pas dans le
type généré → `router.push(path as any)` (même pattern que l'ancien écran).
