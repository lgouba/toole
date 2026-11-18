# Observabilité & analytics rétention — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Instrumenter le mobile Toolé avec PostHog (identify + events + rétention) et durcir Sentry (release health + source maps), sans changer la logique métier.

**Architecture:** Une façade `services/analytics.ts` isole PostHog du reste de l'app ; sa logique pure (typage events, garde-fou PII, gating dev) vit dans `services/analytics.events.ts` (testable en tsx). `identify`/`reset` et les events se branchent sur les call-sites de stores existants, à côté des appels Sentry.

**Tech Stack:** Expo/RN SDK 54, `posthog-react-native` (SDK officiel), `@sentry/react-native` v8 (déjà présent), zustand stores, tsx pour les tests de logique pure.

**Spec :** docs/superpowers/specs/2026-11-18-observabilite-analytics-design.md

## Global Constraints

- **Logique métier INCHANGÉE** : champs, payloads, appels API, navigation, conditions — on n'ajoute que des appels d'observabilité autour.
- **Aucune PII** dans les events : `distinct_id = user.id` (UUID) ; props en liste blanche (`role`, `delivery_id`, `distance_m`, `price`, `by`) ; jamais nom/tel/email/OTP/token/photo.
- **Prod/preview seulement** : no-op total en dev/Expo Go (même détection que `services/sentry.ts` : `__DEV__ || Constants.executionEnvironment === 'storeClient'`).
- **Events TYPÉS** : union `AnalyticsEvent`, aucune string libre au call-site.
- **Jamais de throw** : `init`/`identify`/`reset`/`track` enveloppés try/catch, l'observabilité ne doit jamais casser ni bloquer l'app (offline inclus).
- **Rebuild natif 1.2.0** (pas d'OTA) ; `runtimeVersion = appVersion`.
- **Secrets** : clé PostHog `phc_...` = publique (peut vivre dans le code comme le DSN Sentry) ; `SENTRY_AUTH_TOKEN` = secret EAS build, **non commité**.
- Nom officiel **Toolé** partout où du texte user apparaît.

## Review Focus

- **Init KO (clé absente/invalide)** : l'app doit démarrer normalement, pas de crash → init try/catch + `track` no-op si non initialisé. (test Task 1 : `analyticsEnabled` ; Task 2 : try/catch.)
- **Offline / réseau BF** : `track` ne doit ni throw ni bloquer (PostHog met en file ; on garde quand même le try/catch). Vérif revue Task 2/4.
- **Fuite PII via un futur event** : `sanitizeProps` doit DROP toute clé hors liste blanche même si un appelant la passe. (test Task 1.)
- **Dev/Expo Go** : `track` = no-op silencieux quand non initialisé. (test Task 1 + revue Task 2.)
- **Changement d'utilisateur** : logout → `reset()` puis login autre user → `identify()` ⇒ le `distinct_id` bascule, pas de fuite inter-comptes. (revue Task 3.)

---

## Task 1 : Logique pure analytics + tests

**Files:**
- Create: `apps/mobile/services/analytics.events.ts`
- Test: `apps/mobile/services/analytics.events.test.ts`

**Interfaces:**
- Produces :
  - `type AnalyticsEvent = 'signup_completed' | 'login_completed' | 'delivery_estimated' | 'delivery_created' | 'delivery_cancelled' | 'delivery_completed' | 'driver_online' | 'driver_offline' | 'delivery_accepted' | 'delivery_delivered'`
  - `const ALLOWED_PROP_KEYS: readonly string[]` = `['role','delivery_id','distance_m','price','by']`
  - `sanitizeProps(raw: Record<string, unknown> | undefined): Record<string, string | number> | undefined` — ne garde que les clés de `ALLOWED_PROP_KEYS` dont la valeur est `string | number` ; rend `undefined` si rien ne reste.
  - `analyticsEnabled(input: { isDev: boolean; isExpoGo: boolean }): boolean` — `false` si `isDev || isExpoGo`.

- [ ] **Step 1 : Écrire le test (RED)** — `analytics.events.test.ts`, import **relatif** (`./analytics.events.js`), style `assertEqual` JSON comme `server/src/scripts/test-extract-auth-token.ts`. Cas :
  - `sanitizeProps({ role: 'client', delivery_id: 'uuid', distance_m: 1200, price: 500 })` → identique.
  - `sanitizeProps({ role: 'client', name: 'Issa', phone: '+226...', token: 'x', otp: '1234' })` → `{ role: 'client' }` (PII droppée).
  - `sanitizeProps({ by: 'driver' })` → `{ by: 'driver' }`.
  - `sanitizeProps({ foo: 'bar' })` → `undefined` (clé hors liste).
  - `sanitizeProps({ delivery_id: { nested: 1 } })` → `undefined` (valeur non primitive droppée).
  - `sanitizeProps(undefined)` → `undefined`.
  - `analyticsEnabled({ isDev: true, isExpoGo: false })` → `false` ; `{ isDev:false, isExpoGo:true }` → `false` ; `{ isDev:false, isExpoGo:false }` → `true`.

- [ ] **Step 2 : Lancer le test (RED)**
Run: `cd apps/mobile && npx tsx services/analytics.events.test.ts`
Expected: FAIL (module introuvable / export absent).

- [ ] **Step 3 : Implémenter `analytics.events.ts`** avec `AnalyticsEvent`, `ALLOWED_PROP_KEYS`, `sanitizeProps`, `analyticsEnabled`. Pur : aucun import PostHog/React/expo.

- [ ] **Step 4 : Lancer le test (GREEN)**
Run: `cd apps/mobile && npx tsx services/analytics.events.test.ts`
Expected: PASS (ligne `OK — ...`).

- [ ] **Step 5 : Commit**
```bash
git add apps/mobile/services/analytics.events.ts apps/mobile/services/analytics.events.test.ts
git commit -m "feat(analytics): logique pure (events typés + garde-fou PII) + tests"
```

---

## Task 2 : SDK PostHog + façade + init

**Files:**
- Modify: `apps/mobile/package.json` (deps)
- Create: `apps/mobile/services/analytics.ts`
- Modify: `apps/mobile/app/_layout.tsx` (appel init)
- Modify: `apps/mobile/app.json` (plugin PostHog si requis par le SDK)

**Interfaces:**
- Consumes : `analytics.events.ts` (Task 1) ; pattern de gating de `services/sentry.ts`.
- Produces :
  - `initAnalytics(): void`
  - `identifyUser(user: { id: string; userType: string }): void`
  - `resetAnalytics(): void`
  - `track(event: AnalyticsEvent, props?: Record<string, unknown>): void` — passe `props` par `sanitizeProps` avant envoi.

- [ ] **Step 1 : Installer les deps**
Run: `cd apps/mobile && npx expo install posthog-react-native expo-file-system expo-application expo-localization`
Expected: ajoutées à package.json sans erreur de résolution Expo SDK 54.

- [ ] **Step 2 : Implémenter `analytics.ts`** — façade. Clé `phc_...` + host `https://eu.i.posthog.com` en constantes (comme le DSN Sentry). `initAnalytics` : si `!analyticsEnabled(...)` → log skip + return ; sinon `new PostHog(KEY, { host, captureAppLifecycleEvents: true })`, autocapture d'écran désactivée. `identifyUser` → `posthog.identify(user.id, { role: user.userType })`. `resetAnalytics` → `posthog.reset()`. `track` → `posthog.capture(event, sanitizeProps(props))`. **Tout en try/catch, no-op si non initialisé.** Garder une instance module-level nullable.

- [ ] **Step 3 : Câbler l'init** dans `app/_layout.tsx`, juste après `initSentry()` (~l.50) : `initAnalytics()`.

- [ ] **Step 4 : Plugin app.json** — si le SDK/les deps exigent un config plugin (vérifier la doc PostHog Expo), l'ajouter à `expo.plugins`. Sinon, ne rien changer.

- [ ] **Step 5 : Typecheck**
Run: `cd apps/mobile && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6 : Commit**
```bash
git add apps/mobile/package.json apps/mobile/package-lock.json apps/mobile/services/analytics.ts apps/mobile/app/_layout.tsx apps/mobile/app.json
git commit -m "feat(analytics): SDK PostHog + facade + init (prod/preview, no-op dev)"
```

---

## Task 3 : identify / reset dans auth.store

**Files:**
- Modify: `apps/mobile/stores/auth.store.ts`

**Interfaces:**
- Consumes : `identifyUser`, `resetAnalytics` (Task 2).

- [ ] **Step 1 : Brancher identify** aux endroits où `user` est posé, à côté des appels Sentry existants :
  - login réussi (~l.161, `set({ user: result.user, ... })`) → `identifyUser(result.user)`.
  - bootstrap/refresh (~l.229-232, à côté de `Sentry.setUser(...)`) → `identifyUser(fresh)`.
- [ ] **Step 2 : Brancher reset** dans `logout` (~l.256), à côté de `Sentry.setUser(null)` → `resetAnalytics()`.
- [ ] **Step 3 : Ne RIEN changer d'autre** (pas de modif de flux login/logout).
- [ ] **Step 4 : Typecheck**
Run: `cd apps/mobile && npx tsc --noEmit`
Expected: exit 0.
- [ ] **Step 5 : Commit**
```bash
git add apps/mobile/stores/auth.store.ts
git commit -m "feat(analytics): identify au login/bootstrap, reset au logout"
```

---

## Task 4 : Events métier sur les actions de store

**Files:**
- Modify: `apps/mobile/stores/auth.store.ts` (signup/login_completed)
- Modify: `apps/mobile/stores/delivery.store.ts`
- Modify: `apps/mobile/stores/driver.store.ts`

**Interfaces:**
- Consumes : `track` + `AnalyticsEvent` (Task 2).

- [ ] **Step 1 : auth.store** — `track('signup_completed', { role })` après register réussi ; `track('login_completed', { role })` après login réussi (~l.161).
- [ ] **Step 2 : delivery.store** — après succès uniquement :
  - estimation (là où l'estimation route/prix est calculée) → `track('delivery_estimated', { distance_m?, price? })` (ne passer que ce qui existe déjà en mémoire).
  - `createDelivery` (~l.75, après `delivery` obtenu) → `track('delivery_created', { delivery_id: delivery.id })`.
  - `updateStatus(..., 'delivered')` (~l.133) → `track('delivery_completed', { delivery_id })`.
  - annulation client → `track('delivery_cancelled', { delivery_id, by: 'client' })`.
- [ ] **Step 3 : driver.store** — après succès uniquement :
  - `toggleOnline` passage online (après `setOnlineStatus(true)`, ~l.206) → `track('driver_online')` ; passage offline (~l.226) → `track('driver_offline')`.
  - `acceptRequest` (~l.263, après succès) → `track('delivery_accepted', { delivery_id })`.
  - `confirmDelivery` (~l.322) → `track('delivery_delivered', { delivery_id })`.
  - `cancelActiveDelivery` (~l.331) → `track('delivery_cancelled', { delivery_id, by: 'driver' })`.
- [ ] **Step 4 : Vérifier** qu'aucun `track` n'est posé avant le succès de l'action (pas d'event sur un échec/exception) et qu'aucune PII n'est passée.
- [ ] **Step 5 : Typecheck**
Run: `cd apps/mobile && npx tsc --noEmit`
Expected: exit 0.
- [ ] **Step 6 : Commit**
```bash
git add apps/mobile/stores/auth.store.ts apps/mobile/stores/delivery.store.ts apps/mobile/stores/driver.store.ts
git commit -m "feat(analytics): events metier (course client + livreur)"
```

---

## Task 5 : Durcissement Sentry (release health + source maps)

**Files:**
- Modify: `apps/mobile/services/sentry.ts` (release health si besoin)
- Modify: `apps/mobile/app.json` (plugin Sentry source maps) et/ou `metro.config.js`
- Create/Modify: note de build (`SENTRY_AUTH_TOKEN` en secret EAS)

**Interfaces:**
- N/A (config).

- [ ] **Step 1 : Release health** — vérifier que le suivi de sessions est actif (par défaut en `@sentry/react-native` v8). Si une option explicite est requise (`enableAutoSessionTracking`), l'ajouter dans `Sentry.init`. Ne pas changer le reste de la config.
- [ ] **Step 2 : Source maps** — ajouter le plugin Sentry Expo (`@sentry/react-native/expo`) à `expo.plugins` avec `{ organization, project }`, l'auth token étant lu depuis l'env `SENTRY_AUTH_TOKEN` au build. Documenter : `eas secret:create --name SENTRY_AUTH_TOKEN --value <token>` (non commité).
- [ ] **Step 3 : Typecheck**
Run: `cd apps/mobile && npx tsc --noEmit`
Expected: exit 0.
- [ ] **Step 4 : Commit**
```bash
git add apps/mobile/services/sentry.ts apps/mobile/app.json
git commit -m "feat(observabilite): Sentry release health + upload source maps au build"
```

---

## Task 6 : Bump version 1.2.0 + notes de build

**Files:**
- Modify: `apps/mobile/app.json` (`version` 1.1.0 → 1.2.0)
- Modify: `CLAUDE.md` et/ou mémoire (statut plateformes + commandes build)

**Interfaces:**
- N/A.

- [ ] **Step 1 : Bump** `expo.version` `1.1.0` → `1.2.0` (⇒ nouveau `runtimeVersion`).
- [ ] **Step 2 : Typecheck + rappel build** — pas d'OTA : build requis.
Run: `cd apps/mobile && npx tsc --noEmit`
Expected: exit 0.
- [ ] **Step 3 : Commit**
```bash
git add apps/mobile/app.json
git commit -m "chore(mobile): bump 1.2.0 (rebuild natif analytics PostHog)"
```

- [ ] **Step 4 : Livraison (hors plan, action user au build)** :
```bash
eas build --platform ios --profile production
eas build --platform android --profile preview
```
