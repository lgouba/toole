# Observabilité & analytics rétention — Design

**Date :** 2026-11-18
**App :** Toolé mobile (Expo/RN, SDK 54)
**Statut :** en attente de validation user

## Intention / pourquoi

Pouvoir **piloter les améliorations sans perdre d'utilisateurs** : voir une
**courbe de rétention**, un funnel d'activation (installation → inscription →
1ʳᵉ course → course répétée) et des signaux produit (« il se passe un truc »),
tout en gardant une bonne visibilité sur la stabilité (crashs). Aujourd'hui on
est aveugle sur l'usage : aucun event, aucune rétention.

## Objectifs

1. **Analytics produit** via **PostHog** (SDK officiel `posthog-react-native`,
   choix user) : `identify`, cycle de vie app (nourrit la rétention), et un jeu
   d'events métier contrôlé. Consultation dans le **dashboard PostHog** (pas
   dans l'admin Toolé).
2. **Durcir Sentry** (déjà en place, pas de doublon Crashlytics) :
   - **release health** (taux de sessions / users sans crash = KPI stabilité) ;
   - **upload des source maps** → stack traces lisibles en prod.

## Non-objectifs / anti-objectifs

- **Pas** de Firebase Crashlytics (doublon de Sentry).
- **Pas** de rétention/funnels construits dans l'admin Toolé (gros pipeline ;
  on utilise le dashboard PostHog).
- **Pas** de session replay ni de feature flags en v1 (dispo plus tard avec le
  SDK si besoin).
- **Pas** d'autocapture des écrans en v1 (les noms d'écran peuvent porter des
  ids → risque PII + bruit). Rétention assurée par l'event cycle de vie, pas par
  le screen-tracking.
- **Anti-objectif :** aucune PII dans les events (nom, téléphone, email, code
  OTP, token, photo). Un event qui en contiendrait = échec, même « utile ».

## Contraintes

- **Rebuild natif obligatoire** : le SDK PostHog ajoute module/config natifs →
  **build 1.2.0** (iOS production/TestFlight + Android preview APK, cf. CLAUDE.md).
  **Ce n'est PAS un OTA.** Rien n'est livrable avant ce build.
- **`runtimeVersion` = appVersion** → le bump 1.1.0 → 1.2.0 crée un nouveau
  runtime ; les testeurs doivent installer le nouveau build.
- **Prod/preview seulement** (comme Sentry) : aucun event ni crash en dev/Expo
  Go (sinon on pollue les dashboards et on fausse la rétention).
- **Vie privée** : `distinct_id = user.id` (UUID, pas une PII) ; propriétés en
  liste blanche (`role`, éventuellement ville) ; jamais de champ libre PII.
- **Secrets** : clé projet PostHog = **publique** (`phc_...`, peut vivre dans le
  code comme le DSN Sentry). `SENTRY_AUTH_TOKEN` (upload source maps) = secret
  **build-time** (EAS secret, **non commité**).
- **Pré-requis user** : créer un projet **PostHog Cloud EU** et fournir la clé
  `phc_...` + host `https://eu.i.posthog.com`. (Sans la clé, on code tout mais on
  ne peut pas vérifier end-to-end.)

## Approches considérées

- **A — SDK officiel `posthog-react-native` (CHOISI par le user).** Autocapture
  cycle de vie, propriétés device auto, évolutif (replay/flags plus tard). Coût :
  rebuild natif 1.2.0 + deps Expo (`expo-file-system`, `expo-application`,
  `expo-localization` à installer ; `expo-device`/`async-storage` déjà présents).
- **B — client HTTP léger (fetch → /capture).** 100 % JS, livrable en OTA, zéro
  natif. Rejeté par le user au profit des extras du SDK (A). *Conservé comme repli
  si le rebuild pose problème.*
- **C — Firebase Analytics (GA4).** Gratuit, Firebase déjà présent (push). Rejeté :
  `react-native-firebase` lourd + UI rétention GA4 pénible.
- **Crash : Sentry seul (CHOISI)** vs ajouter Crashlytics (rejeté, doublon).

## Conception décidée

### 1. Wrapper `services/analytics.ts` (façade)
Le reste de l'app **n'importe jamais PostHog directement**. Le wrapper expose :
`initAnalytics()`, `identifyUser(user)`, `resetAnalytics()`, `track(event, props?)`.
Bénéfices : garde-fou PII centralisé, no-op en dev (même détection que Sentry),
events **typés** (union `AnalyticsEvent`, aucune string libre), outil remplaçable
(repli B) sans toucher aux call-sites.

### 2. Init
Dans `app/_layout.tsx`, **à côté de `initSentry()`** : `initAnalytics()`.
- Skip dev/Expo Go (réutilise la logique de `services/sentry.ts`).
- Host EU + clé `phc_...`.
- `captureAppLifecycleEvents: true` → events « Application Opened/Backgrounded »
  → **courbe de rétention** sans instrumentation manuelle.
- Autocapture d'écrans **désactivée** (non-objectif v1).

### 3. identify / reset (dans `stores/auth.store.ts`)
Collés aux appels Sentry existants, sans changer la logique métier :
- login réussi (~l.161) et bootstrap/refresh (~l.232, à côté de `Sentry.setUser`)
  → `identifyUser(user)` : `distinct_id = user.id`, props `{ role }`.
- `logout` (~l.256, à côté de `Sentry.setUser(null)`) → `resetAnalytics()`.

### 4. Events métier (v1, aux actions de store existantes)
| Event | Lieu | Props (sans PII) |
|---|---|---|
| `signup_completed` | auth.store (register) | `{ role }` |
| `login_completed` | auth.store (login ~l.161) | `{ role }` |
| `delivery_estimated` | delivery.store (estimation) | `{ distance_m?, price? }` |
| `delivery_created` | delivery.store `createDelivery` (~l.63) | `{ delivery_id }` |
| `delivery_cancelled` | delivery.store / driver.store `cancelActiveDelivery` | `{ delivery_id, by: client\|driver }` |
| `delivery_completed` | delivery.store `updateStatus(delivered)` (~l.133) | `{ delivery_id }` |
| `driver_online` | driver.store `toggleOnline` → online (~l.206) | `{}` |
| `driver_offline` | driver.store `toggleOnline` → offline (~l.226) | `{}` |
| `delivery_accepted` | driver.store `acceptRequest` (~l.259) | `{ delivery_id }` |
| `delivery_delivered` | driver.store `confirmDelivery` (~l.322) | `{ delivery_id }` |

`delivery_id` est un UUID (pas une PII). **⚠️ à confirmer par le user** : ajouter
des events paiement / partage de suivi ? en retirer ?

### 5. Durcissement Sentry
- **Release health** : vérifier/activer le suivi de sessions (par défaut en v8)
  → crash-free users/sessions dans Sentry.
- **Source maps** : plugin Sentry (Expo/Metro) + `SENTRY_AUTH_TOKEN` en secret
  EAS build → upload auto des source maps au build, stack traces symbolicées.
  *(Sous-objectif séparable : peut être livré avec le même build ou plus tard.)*

### 6. Déploiement
Build natif **1.2.0** : `eas build --platform ios --profile production`
(TestFlight) + `eas build --platform android --profile preview` (APK). Pas d'OTA.

## Laissé au builder (plan)
- Lignes exactes des call-sites (identify/reset/events) + deps Expo à installer.
- Forme précise du wrapper + union `AnalyticsEvent`.
- Config du plugin source maps + nom du secret EAS.
- Valeurs exactes des props `delivery_estimated` selon ce qui existe déjà au
  moment de l'estimation.
