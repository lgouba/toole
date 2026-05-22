# Tollé — Mémoire projet (Claude)

App de livraison Burkina Faso. Mobile RN/Expo, backend Node/Express/Prisma/Postgres, admin React/Vite.

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

### Mobile (EAS OTA — iOS + Android en un seul update)

```bash
cd /Users/macos/Tollé/apps/mobile
eas update --branch preview    --message "..."
eas update --branch production --message "..."
```

**`eas update` cible déjà iOS + Android par défaut.** Ne PAS ajouter `--platform all`, c'est inutile et ça fait râler le user.

Branches EAS : `preview` (testeurs) et `production` (live).

### Git workflow

Repo `lgouba/toole` sur GitHub, branche `main`. Push direct sur main (pas de PR pour les fixes solo).

---

## Architecture

- `/Users/macos/Tollé/apps/mobile` — Expo app (client + driver dans la même app, rôle dans User)
- `/Users/macos/Tollé/apps/admin` — Vite/React admin
- `/Users/macos/Tollé/server` — Express API + Socket.io
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
- Termii à intégrer pour remplacer Africa's Talking.

Driver inactif (KYC en cours) → backend renvoie code `DRIVER_KYC_PENDING`, mobile affiche "en attente de validation" (PAS "Compte indisponible").

---

## Thème "Concept C - Friendly & Local"

Palette : terra cotta + sable + vert kola. Admin peut configurer la couleur primaire → propagation à toute l'app. Refactor `useColors()` hook pour propagation instantanée (Phase 5/6, pas fait — actuellement force-quit nécessaire).

---

## TODOs en cours

- [ ] Refactor `useColors()` hook (propagation couleur primaire admin)
- [ ] Phase 5/6 : redesign écrans client/driver avec Concept C
- [ ] WhatsApp OTP (attente Meta)
- [ ] Provider SMS Termii (remplace Africa's Talking)
- [ ] Logs Sentry auto quand `findNearbyDrivers` retourne 0 candidats (visibilité prod)

---

## Règles user (à respecter)

- **Lis ce fichier avant d'inventer des commandes de déploiement.**
- Commit messages en français, format `type(scope): description`.
- Ne jamais ajouter `--platform all` à `eas update`.
- Pas de docs/README inventés sans demande explicite.
- Pas d'emojis sauf demande.
- Tester en prod = via les testeurs, donc EAS preview puis production après validation.
