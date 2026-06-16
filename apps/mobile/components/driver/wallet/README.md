# Portefeuille livreur — refonte (Carte Toolé)

Refonte de `app/(driver)/wallet.tsx` + écran lié `app/(driver)/remit.tsx`.

## Composants
- `WalletCard` — carte **Toolé** héros : dégradé vert (svg) + wordmark + « DRIVER
  WALLET » + moto + cercles déco ; « Disponible à retirer » + total gagné.
- `RemitAlert` — chip ambre « À reverser à Toolé » + montant → écran dédié.
- `ActivityRow` — fil d'activité (gain +vert, retrait/reversement/commission −ambre)
  avec icône par type, libellé, réf course (mono) · date, montant signé.

## Flux retrait / reversement — RÉUTILISÉS
Les flux Mobile Money (OTP) existent déjà dans l'écran **`/wallet-flow`** :
- Retrait → `/wallet-flow?mode=withdraw&max={balance}`.
- Reversement → `/wallet-flow?mode=topup&amount={effectiveDebt}`.
> Écart vs brief : pas de nouveaux `WithdrawScreen`/`payoutProvider` — on réutilise
> `wallet-flow` + `services/wallet.service` (sendWithdrawOtp/requestWithdraw,
> sendTopupOtp/requestTopup). État réel backend (jamais de faux succès). `remit`
> ajouté aux écrans cachés du Tabs `(driver)/_layout`.

## Modèle « à reverser » (réalité backend, cf. wallet.service)
`walletBalance` = source unique : **positif → `balance`** (disponible à retirer),
**négatif → `commissionDebt`** (à reverser). Les deux sont donc **mutuellement
exclusifs** (le solde n'est PAS « net de l'à-reverser » — ils ne coexistent pas).
Courses **cash** : le livreur encaisse sa part en espèces, et la **part plateforme**
devient une dette à reverser. `effectiveDebt` = dette − reversements en attente.
> TODO produit (déjà acté dans le code wallet) : commission cash uniquement (pas
> tout l'encaissement). Montant min / frais de retrait gérés par `wallet-flow`/backend.

## Données
`getMyWallet()` (balance, commissionDebt, effectiveDebt, totalEarned, totalDeliveries)
+ `getMyTransactions()` (fil). Pull-to-refresh, skeleton, vide. Montants `formatCFA`.

## RemitScreen
Héros ambre (montant + « part plateforme des courses cash ») + note + « Reverser
maintenant » (→ wallet-flow topup) + historique (commission_debt/topup) + « Tu es à
jour ✓ » si dette = 0.
