# Toole

Application de livraison de colis pour le Burkina Faso.

## Structure du projet

```
Tollé/
├── apps/
│   └── mobile/         # App React Native + Expo (iOS + Android)
├── server/             # Backend Node.js + Express + Prisma + Socket.IO
└── DEPLOY_VPS.md       # Guide de deploiement sur VPS
```

## Stack

- **Mobile** : React Native, Expo Router, Zustand, Leaflet (via WebView)
- **Backend** : Node.js 22, Express, Prisma, PostgreSQL, Socket.IO
- **Auth** : OTP + JWT access/refresh tokens
- **Hebergement** : VPS Ubuntu + Nginx + Let's Encrypt

## Demarrage rapide

### Backend (local)

```bash
cd server
cp .env.example .env
# editer .env (DATABASE_URL, JWT secrets)
npm install
npm run db:generate
npm run db:migrate -- --name init
npm run dev
```

### Mobile (local)

```bash
cd apps/mobile
npm install
npx expo start
```

### Deploiement backend

Voir [DEPLOY_VPS.md](DEPLOY_VPS.md).

### Build APK mobile

```bash
cd apps/mobile
npx eas-cli build --profile preview --platform android
```
