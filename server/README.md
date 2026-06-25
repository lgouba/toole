# Toole API Server

Node.js + TypeScript + Express + Prisma + Socket.IO backend for the Toole delivery app (Burkina Faso).

## Stack

- Node.js 22 / TypeScript 5 (ES2022 target, NodeNext module)
- Express 4
- Prisma ORM + PostgreSQL
- Socket.IO 4
- JWT (access + refresh) auth
- zod validation, pino logging, helmet, cors

## Prerequisites

- Node.js >= 22
- PostgreSQL >= 14 running locally or remote
- pnpm / npm / yarn

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file from the template and edit values:

   ```bash
   cp .env.example .env
   ```

3. Create the database (example with `psql`):

   ```bash
   createdb toole
   ```

4. Generate the Prisma client and run the first migration:

   ```bash
   npm run db:generate
   npm run db:migrate -- --name init
   ```

## Development

```bash
npm run dev
```

The server listens on `http://localhost:3000`. Health check: `GET /health`.

Socket.IO is mounted on the same port. Clients authenticate via `auth.token` on the handshake (JWT access token).

In `development`, the OTP code is always `1234`. Set `OTP_DEV_CODE` in the env to change it.

## Production

```bash
npm run build
npm run db:deploy
npm start
# or with PM2:
pm2 start ecosystem.config.js
```

## API summary

Base URL: `/api`

| Method | Path                                | Auth        | Notes                                            |
| ------ | ----------------------------------- | ----------- | ------------------------------------------------ |
| GET    | `/health`                           | no          | health + timestamp                               |
| POST   | `/api/auth/send-otp`                | no          | `{ phone }` -> sends OTP (`1234` in dev)        |
| POST   | `/api/auth/verify-otp`              | no          | `{ phone, code }` -> tokens or `isNewUser`     |
| POST   | `/api/auth/register`                | no          | `{ phone, fullName, userType, otpCode }`        |
| POST   | `/api/auth/refresh`                 | no          | `{ refreshToken }` -> rotated tokens             |
| GET    | `/api/users/me`                     | yes         | current user with profile                        |
| PUT    | `/api/users/me`                     | yes         | update `fullName`, `email`, `avatarUrl`          |
| GET    | `/api/drivers/nearby?lat&lng&radiusKm` | no       | online verified drivers in radius                |
| GET    | `/api/drivers/:id`                  | no          | public driver profile                            |
| PUT    | `/api/drivers/status`               | driver      | `{ isOnline }`                                   |
| PUT    | `/api/drivers/location`             | driver      | `{ latitude, longitude }`                        |
| POST   | `/api/deliveries`                   | yes         | create delivery, emits `delivery:new_request`    |
| GET    | `/api/deliveries?status&role`       | yes         | list my deliveries                               |
| GET    | `/api/deliveries/:id`               | yes         | sender or driver only                            |
| PUT    | `/api/deliveries/:id/accept`        | yes         | driver accepts                                   |
| PUT    | `/api/deliveries/:id/reject`        | yes         | driver rejects (log only)                        |
| PUT    | `/api/deliveries/:id/pickup-confirm` | yes        | `{ photoUrl }`                                   |
| PUT    | `/api/deliveries/:id/validate-code` | yes         | `{ code }` completes + commission txn            |
| PUT    | `/api/deliveries/:id/cancel`        | yes         | sender or driver                                 |
| POST   | `/api/deliveries/:id/rate`          | yes         | `{ score, comment }` updates counterpart avg    |
| GET    | `/api/deliveries/estimate`          | no          | `packageType`, `pickupLat/Lng`, `deliveryLat/Lng` |

All responses are wrapped as `{ data, error }`.

## Socket.IO events

Client -> Server:

- `driver:update_location` — `{ lat, lng }` (driver only). Ack-able.

Server -> Client (targeted rooms `user:{id}`):

- `delivery:new_request` — new pending delivery nearby (drivers)
- `delivery:accepted` — driver accepted (sender)
- `delivery:status_update` — status changed (sender/driver)
- `delivery:driver_location` — live driver location (sender)
- `delivery:cancelled` — other party cancelled

## Scripts

- `npm run dev` — watch mode (tsx)
- `npm run build` — tsc -> `dist/`
- `npm start` — run compiled server
- `npm run db:migrate` — create + apply dev migration
- `npm run db:deploy` — apply migrations in prod
- `npm run db:generate` — regenerate Prisma client
- `npm run db:studio` — Prisma Studio GUI

## Notes

- Commissions: default **15% platform fee**; driver wallet is credited automatically on delivery completion.
- Nearby search uses a lat/lng bounding box + Haversine in JS (no PostGIS required).
- Refresh tokens are stored and rotated on use.
