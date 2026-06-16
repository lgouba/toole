# wallet-flow — Retrait / Règlement de dette (livreur)

Refonte visuelle de `app/wallet-flow.tsx` alignée sur les écrans de paiement
client (`components/delivery/step4/*`), à la demande : « prendre comme exemple
les écrans des paiements du client ».

## Ce qui a changé (visuel uniquement)
- Canvas crème `#F5F2EC`, titres **Archivo** (display), montant en **mono**.
- Choix opérateur via **`<MethodCard variant="orange|moov">`** — exactement les
  mêmes cartes radio que le paiement client (bordure verte + point quand sélectionné).
- Numéro Mobile Money préfixé **+226** (champ blanc, formaté 2 par 2).
- Code OTP via **`<OtpInput length={4}>`** (`components/ui`) + carte récap de l'opération.
- CTA vert plein (`CtaButton` local, calqué sur « Valider le paiement »).
- Barre de progression verte (33/66/100 %, ou 50/100 % si montant verrouillé).

## Ce qui n'a PAS changé (logique préservée à l'identique)
- Machine à 3 étapes `amount → phone → otp` (handlers `goToPhone` / `sendOtp` /
  `submitOtp` / `handleBack` repris mot pour mot).
- Modes `withdraw` / `topup`, params `{mode, amount, max}`, `amountLocked`
  (règlement de dette = montant imposé, démarre direct à l'étape `phone`).
- Validation montant ≤ `maxAmount`, numéro 8 chiffres → `226XXXXXXXX`.
- Appels service inchangés : `sendWithdrawOtp` / `requestWithdraw` /
  `sendTopupOtp` / `requestTopup`, mêmes `Alert` de succès → `router.back()`.

## Réutilisation / dépendances
- Aucune dépendance native ajoutée → **OTA-safe** (déployé sur preview + production).
- Réutilise `MethodCard`, `OtpInput`, tokens `recap` + `step4` (`theme/recapTokens.ts`).

## Écart assumé
- L'ancien `<Button>` UI (terra-cotta) est remplacé par un CTA vert local pour
  rester cohérent avec la direction « billet vert » des écrans paiement, plutôt
  que le thème terra-cotta global.
