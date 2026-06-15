# Étape 4 · Paiement — refonte (OTP intégré à l'étape)

Refonte de l'étape "paiement" (step index 3). Branchée dans
`app/(client)/new-delivery.tsx` via `<PaymentStep4 />`.

## ⚠️ Changement d'architecture

L'OTP mobile money est **désormais validé EN LIGNE à l'étape 4** (plus de modale
post-récap). La modale `PaymentOtpModal` n'est plus rendue. Au récap (étape 5),
« Confirmer l'envoi » finalise **directement** :
- `cash` → création directe (encaissé à la livraison).
- mobile + `paid` → création directe (déjà payé).
- mobile + `unpaid` (montant changé entre-temps) → renvoie à l'étape 4 (Alert).

## Composants

- `AmountCard` — montant à régler (issu du pricing, cohérent récap).
- `MethodCard` — carte radio (Espèces / Orange / Moov ; rond couleur opérateur, sans logo).
- `MobilePaymentFlow` — bloc en ligne : en-tête opérateur, USSD + copier, OTP 4 cases
  (`ui/OtpInput`), « Valider le paiement » → état succès (check pop).
- `PaymentStep4` — assemble + note espèces + réassurance.

## Provider (`utils/payment.ts`)

Couche d'abstraction `paymentProvider` (interface `ussdCode` + `confirm`).
- **Mock** actuel : `confirm` valide l'OTP **`0000`** (mode démo). USSD placeholders
  (`*144*4*6*{montant}#` Orange, `*155*1*{montant}#` Moov).
- Pour le réel (CinetPay / Fedapay / API opérateur) : remplacer l'implémentation
  de `paymentProvider` **sans toucher à l'UI**.

## Statut paiement (état écran)

`paymentStatus: 'unpaid' | 'paid'` + `paymentTxId` + `paidAmount`, gérés dans
`new-delivery.tsx` :
- Changement de mode/opérateur → `unpaid`.
- `onPaid` → `paid` + txId + `paidAmount = total`.
- Si le montant change après coup (effet sur `estimate.price`) → re-`unpaid`.

« Continuer » (étape 4) : actif si `cash` OU `paid`. Sinon libellé
« Valide le paiement ci-dessus ».

## Mapping des modes

`cash` / `orange_money` / `moov_money` → `draft.paymentMethod` (inchangé côté backend).

## Dépendances

**Aucune ajoutée** (OTA-safe) : réutilise `ui/OtpInput`, `expo-clipboard`,
`reanimated`. `PaymentMethodPicker` et `PaymentOtpModal` ne sont plus utilisés.
