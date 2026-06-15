# Étape 3 · Destinataire — refonte

Refonte de l'étape "destinataire" (step index 2) de la création de colis.
Branchée dans `app/(client)/new-delivery.tsx` via `<RecipientStep3 />`.

## Composants

- `PersonCard` — carte personne réutilisable (variant `recipient` / `holder`) :
  avatar (icône → initiales dès qu'un nom est saisi), bouton contacts, champ Nom, `PhoneField`.
- `ContactsButton` — déclenche le picker de contacts (rendu au niveau de l'écran).
- `PhoneField` — préfixe fixe 🇧🇫 +226 + champ numérique formaté "70 12 34 56".
- `HeldByOtherToggle` — carte-bascule "Quelqu'un d'autre détient le colis" (thème,
  idle ambre crème → actif vert), déplie la carte détenteur.
- `RecipientStep3` — assemble + dépliage animé (LayoutAnimation).

## Mapping `holder ↔ expediteur`

Le « détenteur » (affiché "DÉTENTEUR · EXPÉDITEUR / Qui détient le colis")
**mappe sur l'`expediteur`** du modèle existant : champs draft
`senderContactName` / `senderContactPhone`. La bascule = l'ancien `thirdPartyPickup`.

## Téléphone (`utils/phone.ts`)

- Stockage = **valeur nationale 8 chiffres** dans le draft ; le backend
  (`cleanPhone`) la normalise en `226XXXXXXXX`. `toE164` fournit `+226XXXXXXXX`.
- Affichage groupé "70 12 34 56" ; validation = 8 chiffres (`isValidBF`).
- Sélecteur pays fixe BF pour cette itération (extensible).

## Contacts

Réutilise le `ContactPickerModal` existant (déjà au projet, permission + picker +
extraction nom/numéro). L'écran garde `contactPickerTarget` ('recipient' | 'sender')
et mappe `holder → 'sender'`. Permission refusée → message, saisie manuelle possible.

## Animations

- Avatar icône → initiales quand le nom devient non vide.
- Bascule : couleurs idle→active + dépliage hauteur/opacité (LayoutAnimation).

## Validation

« Continuer » actif si destinataire (nom + tel 8 chiffres valides) — et détenteur
aussi si la bascule est active.

## Dépendances

**Aucune dépendance ajoutée** (OTA-safe). `expo-contacts` est déjà utilisé via
`ContactPickerModal`. Pas de lib téléphone lourde (préfixe +226 fixe + util maison).

## Écarts assumés

- Pas de `react-native-phone-number-input` (util maison suffit).
- Le picker contacts reste la modale plein écran existante (pas le picker natif iOS).
