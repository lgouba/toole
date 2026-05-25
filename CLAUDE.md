# Tôllé — Mémoire projet (Claude)

App de livraison Burkina Faso. Mobile RN/Expo, backend Node/Express/Prisma/Postgres, admin React/Vite.

**⚠️ Nom officiel : `Tôllé` (avec accent aigu sur le É), JAMAIS `Tolle` sans accent.** S'applique partout : SMS, emails, UI mobile/admin/landing, app.json (`name: "Tôllé"`), titres push, OG metadata. Le user râle si on perd l'accent.

---

## ⚠️ Commandes de déploiement (NE PAS INVENTER)

### Serveur (VPS)

```bash
cd /opt/toole/server && docker compose up -d --build tolle-api
```

Logs :

```bash
cd /opt/toole/server && docker compose logs -f tolle-api --tail=50
```

Le service docker s'appelle **`tolle-api`** (pas `server`, pas `api`). Le path sur le VPS est **`/opt/toole/server`** (pas `/opt/tolle`, pas `~/tolle`).

### Admin (VPS)

```bash
cd /opt/toole/apps/admin && docker compose up -d --build tolle-admin
```

Service Docker : **`tolle-admin`** · path VPS : **`/opt/toole/apps/admin`** · domaine : `admin-tolle.qalitylabs.fr` (via nginx-proxy externe).

⚠️ Le path est `/opt/toole/apps/admin` (PAS `/opt/toole/admin`, PAS `/opt/apps/admin`). Le serveur est `/opt/toole/server` mais l'admin/landing sont sous `/opt/toole/apps/`.

### Landing (VPS)

```bash
cd /opt/toole/apps/landing && docker compose up -d --build tolle-landing
```

### Mobile (EAS OTA — iOS + Android en un seul update)

```bash
cd /Users/macos/Tôllé/apps/mobile
eas update --branch preview    --message "..."
eas update --branch production --message "..."
```

**`eas update` cible déjà iOS + Android par défaut.** Ne PAS ajouter `--platform all`, c'est inutile et ça fait râler le user.

### Mobile — Quel profile EAS Build pour quoi (iOS)

Dans `apps/mobile/eas.json` :
- `preview` = `distribution: "internal"` → **ad-hoc**, install par UDID/QR, demande à enregistrer les devices à chaque nouveau testeur. Pas TestFlight.
- `production` = `distribution: "store"` (défaut) → **TestFlight** + App Store. Pas d'UDID.

**Pour envoyer aux testeurs sur TestFlight, c'est TOUJOURS `--profile production`**, jamais `preview`. Le `preview` ne sert que pour install direct sur device sans passer par Apple Review.

**Statut actuel des plateformes** (à jour 2026-05-25) :
- iOS → **production** (TestFlight). C'est ce qu'on rebuild quand l'app évolue.
- Android → **preview** (APK ad-hoc, distribué directement aux testeurs). Pas encore sur Play Store. Pour Android : `eas build --platform android --profile preview`.

### Mobile — REBUILD NATIF requis quand ?

Un OTA `eas update` ne suffit PAS si on touche :
- `app.json` → `ios.infoPlist`, `ios.entitlements`, `android.permissions`, `plugins`
- Native modules ajoutés/changés (`expo-*` natif)
- `google-services.json`, certificats APNs

Dans ces cas :

```bash
cd /Users/macos/Tôllé/apps/mobile
eas build --platform ios     --profile preview        # TestFlight
eas build --platform android --profile preview        # APK / Play Internal
# Après validation testeurs :
eas build --platform ios     --profile production
eas build --platform android --profile production
```

Branches EAS : `preview` (testeurs) et `production` (live).

### Git workflow

Repo `lgouba/toole` sur GitHub, branche `main`. Push direct sur main (pas de PR pour les fixes solo).

---

## Architecture

- `/Users/macos/Tôllé/apps/mobile` — Expo app (client + driver dans la même app, rôle dans User)
- `/Users/macos/Tôllé/apps/admin` — Vite/React admin
- `/Users/macos/Tôllé/server` — Express API + Socket.io
- Postgres + Prisma. Migrations via `prisma db push` (pas migrate dev en prod).
- Stores : Zustand (`apps/mobile/stores/*.store.ts`)
- Socket : `server/src/socket/index.ts` + `apps/mobile/services/socket.client.ts`
- Push notifs : Expo Push (FCM/APNs)

---

## Bug livreur "notifs reçues seulement après toggle off/on" — RÉSOLU (2026-05-22)

**Symptôme** : livreurs en ligne ne recevaient pas les nouvelles courses. Il fallait passer hors ligne puis en ligne pour débloquer.

**Root causes (deux problèmes empilés)** :

1. **Côté serveur** : `markStaleDriversOffline` (cron 30s dans `server/src/index.ts` → `server/src/services/driver.service.ts`) flippait `isOnline=false` dès qu'un livreur n'avait pas pushé de heartbeat depuis 120s. Sur réseau flaky BF (transport close ~100s), suffisait à dégommer le livreur en silence.
2. **Côté mobile** : dans `apps/mobile/stores/driver.store.ts` → `toggleOnline()`, on appelait `setOnlineStatus(true)` AVANT de push une position GPS fraîche. Si un client créait une course dans les 10s, `findNearbyDrivers` (filtre `lastLocationUpdate < 2 min`) ne nous voyait pas.

**Fixes** :

1. `markStaleDriversOffline` ne mute plus `isOnline`, juste log debug. Cron passé à 5 min. `findNearbyDrivers` continue à filtrer sur `lastLocationUpdate` donc les zombies sont quand même exclus.
2. Mobile : push GPS → `updateLocation` → puis `setOnlineStatus(true)` → puis `startLocationTracking`.

**Commits** : `71cf4f7` (server) + `ae5c157` (mobile).

**Règle** : `isOnline` est contrôlé UNIQUEMENT par le user (toggle dans l'app) ou logout explicite. Jamais par un cron.

---

## Auth (refactor 2026-05)

- Login : téléphone OU email + OTP (canal SMS/WhatsApp/Email choisi à l'envoi).
- Register : tout d'un coup (full name, phone, email, canal, password optionnel, + KYC photos pour livreurs).
- KYC livreur : upload photos pendant l'inscription via endpoint **public** `/uploads/kyc/*` (le user n'a pas encore de JWT). Les URLs sont passées à `/auth/register` qui les stocke dans `driverProfile.create`.
- `sendOtp(identifier, purpose)` : vérifie existence (login) ou non-existence (register) AVANT d'envoyer. Message générique anti-enumeration : "Impossible d'envoyer le code. Vérifiez vos informations."
- `sendEmail` accepte `throwOnError: true` pour les chemins critiques (OTP).
- Dev : OTP SMS fixé à `1234`. OTP email = code réel généré.
- WhatsApp Cloud API en attente validation Meta Business.
- **Provider SMS prod = Aqilas** (https://www.aqilas.com/app/api). Endpoint `POST /api/v1/sms`, auth `X-AUTH-TOKEN`, body `{ from, to: [phone], text }`. Env vars : `SMS_PROVIDER=aqilas`, `AQILAS_API_KEY`, `AQILAS_SENDER_ID=TOLLE`.

Driver inactif (KYC en cours) → backend renvoie code `DRIVER_KYC_PENDING`, mobile affiche "en attente de validation" (PAS "Compte indisponible").

---

## Thème "Concept C - Friendly & Local"

Palette : terra cotta + sable + vert kola. Admin peut configurer la couleur primaire → propagation à toute l'app. Refactor `useColors()` hook pour propagation instantanée (Phase 5/6, pas fait — actuellement force-quit nécessaire).

---

## TODOs en cours

- [ ] Refactor `useColors()` hook (propagation couleur primaire admin)
- [ ] Phase 5/6 : redesign écrans client/driver avec Concept C
- [ ] WhatsApp OTP (attente Meta)
- [x] ~~Provider SMS Termii~~ → Aqilas intégré (commit `b662c3f`), reste à configurer `AQILAS_API_KEY` sur le VPS
- [ ] Logs Sentry auto quand `findNearbyDrivers` retourne 0 candidats (visibilité prod)

---

## Règles user (à respecter)

- **Lis ce fichier avant d'inventer des commandes de déploiement.**
- Commit messages en français, format `type(scope): description`.
- Ne jamais ajouter `--platform all` à `eas update`.
- Pas de docs/README inventés sans demande explicite.
- Pas d'emojis sauf demande.
- Tester en prod = via les testeurs, donc EAS preview puis production après validation.
