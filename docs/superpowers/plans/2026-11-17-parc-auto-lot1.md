# Parc Auto — Lot 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer le registre Parc Auto : actionnaires, engins autonomes, affectation à un livreur avec historique, totaux bruts d'activité, et l'engin affecté visible sur la fiche livreur admin.

**Architecture:** 3 tables Prisma additives (`Shareholder`, `Vehicle`, `VehicleAssignment`). Backend : nouveau `fleet.service.ts` + `fleet.controller.ts` + `fleet.routes.ts` monté sur `/api/admin/fleet` (garde `authRequired, requireRole('admin')`). Revenus = agrégation lecture seule des `Delivery` existantes (raw SQL, modèle `getDailyStats`). Admin React/Vite : section « Parc Auto » (listes + fiches + dialogs), enrichissement de `UserDetail`. Aucun changement mobile, aucun flux d'argent, logique métier existante intacte.

**Tech Stack:** Node/Express/Prisma 5/Postgres, Zod, TypeScript (CommonJS) ; admin Vite/React/axios.

**Spec:** `docs/superpowers/specs/2026-11-17-parc-auto-design.md`

## Global Constraints

- Migrations via `prisma db push` au boot **sans `--accept-data-loss`** → uniquement tables neuves + colonnes nullable/avec défaut ; aucune `@unique`/NOT NULL ajoutée sur table existante. Plaque **non** `@unique`.
- Toutes les routes sous `/api/admin/fleet`, gardées `authRequired, requireRole('admin')`.
- Réponses via `success(res, data)` (`{ data, error:null }`) ; erreurs via `HttpError(status, code, message)`. Services jettent, controllers parsent (Zod) et appellent le service.
- Ne jamais toucher `DriverProfile.vehicle*` ni aucun flux existant (course, wallet, commissions, KYC).
- Nom officiel **Toolé** (accent) partout en UI.
- **Pas de framework de test dans ce repo** (vérif = `npm run typecheck`). Déviation TDD assumée : les tâches à risque (invariant d'affectation, agrégation revenus) sont vérifiées par un **script de smoke `tsx`** jetable sous `server/src/scripts/` (patron existant `seed-admin.ts`), lançable sur la base de dev. Le typecheck garde les interfaces honnêtes ; le smoke prouve la logique.

## Review Focus

- **Réaffectation concurrente** : deux affectations actives sur un même engin/livreur si deux requêtes `assign` se croisent → l'assign doit clôturer+créer dans **une** transaction Prisma (`$transaction`). Testé par le smoke Task 3.
- **Engin non affectable** : `assign` sur un engin `en_panne`/`retire` → doit renvoyer `HttpError(409/400)`, pas créer l'affectation. Smoke Task 3.
- **Fenêtre d'affectation ouverte** (`endedAt = null`) dans l'agrégation : les courses après `startedAt` jusqu'à *maintenant* doivent compter ; une mauvaise borne `COALESCE(endedAt, now())` perd les revenus courants. Smoke Task 4.
- **Engin sans actionnaire** (`ownerType = toole`, `shareholderId null`) : listes et fiches ne doivent pas planter sur le proprio null. Vérifié au typecheck + smoke Task 4.
- **Livreur affecté supprimé/suspendu** : la fiche engin et l'historique doivent rester lisibles (jointure sur `driver` tolérante). Vérifié Task 4/7.

---

### Task 1: Schéma Prisma — Shareholder, Vehicle, VehicleAssignment

**Files:**
- Modify: `server/prisma/schema.prisma` (ajout de 2 enums, 3 models, 1 relation inverse sur `User`)

**Interfaces:**
- Produces: modèles `Shareholder`, `Vehicle`, `VehicleAssignment` et enums `VehicleStatus` (`en_service|en_panne|retire`), `VehicleOwnerType` (`actionnaire|toole`) tels que décrits §5 de la spec. `User` reçoit `vehicleAssignments VehicleAssignment[]`.

- [ ] **Step 1: Ajouter les enums + models** dans `schema.prisma` en suivant §5 de la spec (types exacts, defaults, index). `Vehicle.vehicleType` réutilise l'enum `VehicleType` existant. Relation `User.vehicleAssignments VehicleAssignment[]` (inverse de `VehicleAssignment.driver`). Aucune modif d'un model existant hormis cette ligne de relation.
- [ ] **Step 2: Générer le client** — Run: `cd server && npx prisma generate` — Expected: génération sans erreur, types `Shareholder`/`Vehicle`/`VehicleAssignment` disponibles.
- [ ] **Step 3: Vérifier la cohérence du schéma** — Run: `cd server && npx prisma validate` — Expected: « The schema is valid ».
- [ ] **Step 4: Typecheck** — Run: `cd server && npm run typecheck` — Expected: pas d'erreur.
- [ ] **Step 5: Commit**

```bash
git add server/prisma/schema.prisma
git commit -m "feat(parc-auto): schema engins, actionnaires, affectations"
```

---

### Task 2: Service fleet — CRUD actionnaires & engins

**Files:**
- Create: `server/src/services/fleet.service.ts`

**Interfaces:**
- Consumes: `prisma` (`server/src/lib/prisma` — même import que `admin.service.ts`), `HttpError` (`../utils/response.js`), types Prisma générés (Task 1).
- Produces :
  - `listShareholders(): Promise<Shareholder[]>` (actifs d'abord, triés `fullName`)
  - `createShareholder(input: { fullName: string; phone?: string; email?: string; note?: string }): Promise<Shareholder>`
  - `getShareholder(id): Promise<Shareholder & { vehicles: Vehicle[] }>` (throw 404 si absent)
  - `updateShareholder(id, patch): Promise<Shareholder>` · `archiveShareholder(id): Promise<Shareholder>` (`isActive=false`)
  - `listVehicles(filter: { status?; ownerType?; assigned?: boolean }): Promise<VehicleListRow[]>` où `VehicleListRow = Vehicle & { shareholder: Shareholder|null; activeAssignment: (VehicleAssignment & { driver: {id;fullName} })|null }`
  - `createVehicle(input: { vehicleType; brand?; model?; plate?; status?; ownerType; shareholderId?; note? }): Promise<Vehicle>` (si `ownerType='actionnaire'` → `shareholderId` requis, sinon 400 ; plaque dupliquée → n'échoue pas mais renvoie champ `plateWarning` au controller — cf. Task 5)
  - `getVehicle(id)` et `updateVehicle(id, patch)` — `getVehicle` détaillé est complété en Task 4 (historique+totaux) ; ici retourne au moins `Vehicle & { shareholder; activeAssignment }`.

- [ ] **Step 1: Implémenter les fonctions ci-dessus** dans `fleet.service.ts`. `activeAssignment` = `assignments` où `endedAt: null` (include `driver: { select: { id:true, fullName:true } }`). Validation « actionnaire ⇒ shareholderId » et unicité plaque applicative (`findFirst({ where:{ plate } })`) côté service, la plaque dupliquée journalisée et signalée, non bloquante.
- [ ] **Step 2: Typecheck** — Run: `cd server && npm run typecheck` — Expected: pas d'erreur.
- [ ] **Step 3: Commit**

```bash
git add server/src/services/fleet.service.ts
git commit -m "feat(parc-auto): service CRUD actionnaires et engins"
```

---

### Task 3: Service fleet — affectation / désaffectation + livreurs affectables

**Files:**
- Modify: `server/src/services/fleet.service.ts`
- Create: `server/src/scripts/smoke-fleet-assign.ts` (smoke jetable, patron `seed-admin.ts`)

**Interfaces:**
- Consumes: service Task 2, `prisma.$transaction`.
- Produces :
  - `assignVehicle(vehicleId: string, driverId: string, note?: string, adminId?: string): Promise<VehicleAssignment>`
  - `unassignVehicle(vehicleId: string, adminId?: string): Promise<VehicleAssignment>` (clôt l'affectation active, throw 404 si aucune)
  - `listAssignableDrivers(): Promise<{ id; fullName; phone; hasActiveVehicle: boolean; activeVehicleLabel: string|null }[]>`

- [ ] **Step 1: Implémenter `assignVehicle`** : (a) charge l'engin, 404 si absent ; (b) si `status !== 'en_service'` → `throw new HttpError(409,'VEHICLE_NOT_ASSIGNABLE', ...)` ; (c) dans un `prisma.$transaction` : clôturer l'affectation active de **l'engin** (`endedAt=now, endedBy=adminId`) si elle existe, clôturer l'affectation active **du livreur** si elle existe, puis créer la nouvelle. (La confirmation UI « libère l'ancien » est côté admin Task 7 ; le service applique l'invariant.)
- [ ] **Step 2: Implémenter `unassignVehicle` et `listAssignableDrivers`** : livreurs `userType='driver'`, `isActive=true`, `suspendedAt=null`, `driverProfile.verificationStatus='verified'` ; `hasActiveVehicle`/`activeVehicleLabel` calculés depuis les affectations ouvertes.
- [ ] **Step 3: Écrire le smoke** `smoke-fleet-assign.ts` : crée 1 engin en_service + 2 livreurs factices, `assignVehicle(v,d1)`, ré-`assignVehicle(v,d2)`, assert : exactement 1 affectation ouverte sur l'engin, celle de d1 close, assert qu'`assignVehicle` sur un engin `en_panne` jette `VEHICLE_NOT_ASSIGNABLE`. Nettoie derrière lui. Affiche `SMOKE_OK` à la fin.
- [ ] **Step 4: Lancer le smoke** — Run: `cd server && npx tsx src/scripts/smoke-fleet-assign.ts` — Expected: imprime `SMOKE_OK`, pas d'exception. (Nécessite `DATABASE_URL` de dev.)
- [ ] **Step 5: Typecheck** — Run: `cd server && npm run typecheck` — Expected: pas d'erreur.
- [ ] **Step 6: Commit**

```bash
git add server/src/services/fleet.service.ts server/src/scripts/smoke-fleet-assign.ts
git commit -m "feat(parc-auto): affectation/desaffectation avec invariant transactionnel"
```

---

### Task 4: Service fleet — agrégation d'activité (cumul engin, par affectation, par actionnaire)

**Files:**
- Modify: `server/src/services/fleet.service.ts`
- Create: `server/src/scripts/smoke-fleet-revenue.ts`

**Interfaces:**
- Consumes: service Tasks 2-3, `prisma.$queryRaw` (patron `getDailyStats`).
- Produces :
  - type `ActivityTotals = { courses: number; totalGenere: number; gainsLivreur: number }`
  - `getVehicleActivity(vehicleId): Promise<ActivityTotals>` — cumul à vie, toutes affectations de l'engin.
  - `getAssignmentActivity(assignmentId): Promise<ActivityTotals>` — fenêtre `[startedAt, COALESCE(endedAt, now())]` du `driverId` de l'affectation.
  - `getShareholderActivity(shareholderId): Promise<ActivityTotals>` — somme sur ses engins.
  - `getVehicleDetail(id)` (complète Task 2) : `Vehicle & { shareholder; activeAssignment; history: (VehicleAssignment & { driver; totals: ActivityTotals })[]; totals: ActivityTotals }`.

- [ ] **Step 1: Implémenter l'agrégation** : une requête réutilisable qui, pour un `driverId` et une fenêtre `[from,to]`, somme sur `Delivery` où `driverId=? AND status='delivered' AND deliveredAt >= from AND deliveredAt < to` : `COUNT(*)`, `SUM(price)`, `SUM("driverCommission")`. Cumul engin = Σ sur ses affectations (chaque fenêtre bornée par `COALESCE(endedAt, now())`). Convertir les `bigint` SQL en `number`.
- [ ] **Step 2: Écrire le smoke** `smoke-fleet-revenue.ts` : crée engin + livreur + affectation ouverte, insère 2 `Delivery` `delivered` (`deliveredAt` après `startedAt`, `price` connus) et 1 `cancelled`, assert `getVehicleActivity.courses===2` et `totalGenere===` somme des 2 prix ; clôt l'affectation à une date T, insère une course après T, assert qu'elle **ne compte pas** pour cette affectation mais compte pour une nouvelle affectation couvrant T+. Nettoie. Affiche `SMOKE_OK`.
- [ ] **Step 3: Lancer le smoke** — Run: `cd server && npx tsx src/scripts/smoke-fleet-revenue.ts` — Expected: `SMOKE_OK`.
- [ ] **Step 4: Typecheck** — Run: `cd server && npm run typecheck` — Expected: pas d'erreur.
- [ ] **Step 5: Commit**

```bash
git add server/src/services/fleet.service.ts server/src/scripts/smoke-fleet-revenue.ts
git commit -m "feat(parc-auto): agregation activite engin/affectation/actionnaire"
```

---

### Task 5: Controller + routes `/api/admin/fleet`

**Files:**
- Create: `server/src/controllers/fleet.controller.ts`, `server/src/routes/fleet.routes.ts`
- Modify: `server/src/index.ts` (monter le routeur)

**Interfaces:**
- Consumes: toutes les fonctions `fleet.service.ts` (Tasks 2-4), `success`/`HttpError`, `authRequired`/`requireRole` (`../middleware/auth.js`), `z`.
- Produces: routes §7-Lot 1 de la spec :
  `GET/POST /shareholders`, `GET/PATCH /shareholders/:id`, `POST /shareholders/:id/archive`,
  `GET/POST /vehicles`, `GET/PATCH /vehicles/:id`,
  `POST /vehicles/:id/assign` `{driverId, note?}`, `POST /vehicles/:id/unassign`,
  `GET /drivers/assignable`.

- [ ] **Step 1: Écrire les schémas Zod + controllers** (thin : parse → service → `success`). `createVehicle` : si le service renvoie un `plateWarning`, le controller l'inclut dans la réponse (`success(res, { vehicle, plateWarning })`). `assign` : propage `HttpError` du service (engin non affectable, 404).
- [ ] **Step 2: Monter le routeur** dans `index.ts` : `app.use('/api/admin/fleet', fleetRoutes)` (le routeur applique `router.use(authRequired, requireRole('admin'))` comme `admin.routes.ts`).
- [ ] **Step 3: Typecheck** — Run: `cd server && npm run typecheck` — Expected: pas d'erreur.
- [ ] **Step 4: Smoke HTTP (optionnel si serveur dev lançable)** — démarrer `npm run dev`, `curl` `GET /api/admin/fleet/vehicles` avec un JWT admin (token obtenu via `/api/admin/login`) — Expected: `200 { data: [...] , error:null }`. Sinon s'appuyer sur les smokes service Tasks 3-4.
- [ ] **Step 5: Commit**

```bash
git add server/src/controllers/fleet.controller.ts server/src/routes/fleet.routes.ts server/src/index.ts
git commit -m "feat(parc-auto): routes admin /api/admin/fleet"
```

---

### Task 6: Enrichir `getUserDetail` avec l'engin affecté

**Files:**
- Modify: `server/src/services/admin.service.ts` (`getUserDetail`, ~ligne 265)

**Interfaces:**
- Consumes: Prisma `VehicleAssignment` (Task 1).
- Produces: le retour de `getUserDetail` gagne un champ **additif** `activeVehicle: { id; plate; brand; model; vehicleType; shareholderName: string|null } | null` (sans retirer `user`/`recentDeliveries`).

- [ ] **Step 1: Ajouter la lecture** de l'affectation active du livreur (`VehicleAssignment` où `driverId=userId, endedAt:null`, include `vehicle.shareholder`) et l'ajouter au retour. Ne rien changer d'autre dans la fonction.
- [ ] **Step 2: Typecheck** — Run: `cd server && npm run typecheck` — Expected: pas d'erreur.
- [ ] **Step 3: Commit**

```bash
git add server/src/services/admin.service.ts
git commit -m "feat(parc-auto): engin affecte visible sur la fiche utilisateur admin"
```

---

### Task 7: Admin — section « Parc Auto » (listes, fiches, dialogs, affectation)

**Files:**
- Create: `apps/admin/src/pages/Fleet.tsx` (liste engins), `apps/admin/src/pages/VehicleDetail.tsx`, `apps/admin/src/pages/Shareholders.tsx`, `apps/admin/src/pages/ShareholderDetail.tsx`
- Modify: `apps/admin/src/App.tsx` (routes), `apps/admin/src/components/Shell.tsx` (entrées de menu)

**Interfaces:**
- Consumes: `api`/`unwrap` (`../api`), `useDialog` (confirm/prompt), endpoints Task 5.
- Produces: routes `/fleet`, `/fleet/vehicles/:id`, `/fleet/shareholders`, `/fleet/shareholders/:id`.

- [ ] **Step 1: Routes + menu** — ajouter les 4 `<Route>` dans `App.tsx` (zone authentifiée) et une entrée « Parc Auto » (+ sous-liens Engins / Actionnaires) dans la sidebar `Shell.tsx`, style identique aux NavLink existants.
- [ ] **Step 2: `Fleet.tsx`** — tableau des engins (plaque, type, marque/modèle, statut, propriétaire, livreur actuel, nb courses, total généré) ; filtres statut/propriétaire/affecté ; bouton « Nouvel engin » (dialog : type, marque, modèle, plaque, statut, propriétaire = Toolé/actionnaire → sélecteur d'actionnaire ; **pas de photo**). Gérer chargement/vide/erreur (patron `UsersList`). Afficher `plateWarning` s'il revient.
- [ ] **Step 3: `VehicleDetail.tsx`** — infos engin + proprio, bloc affectation active avec **Affecter** (sélecteur `GET /drivers/assignable` ; si le livreur `hasActiveVehicle`, `useDialog().confirm` « ce livreur roule déjà avec X, il sera libéré » avant `POST assign`) et **Désaffecter** (`confirm`). Cumul à vie (nb courses + total généré). **Historique** des affectations avec, par ligne, livreur + période + totaux de l'affectation.
- [ ] **Step 4: `Shareholders.tsx` + `ShareholderDetail.tsx`** — liste (nb engins, nb affectés) + bouton « Nouvel actionnaire » (dialog : nom, tel, email, note) ; fiche = infos + ses engins + totaux agrégés. Archiver via `confirm`.
- [ ] **Step 5: Typecheck** — Run: `cd apps/admin && npm run typecheck` — Expected: pas d'erreur.
- [ ] **Step 6: Build** — Run: `cd apps/admin && npm run build` — Expected: build OK.
- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/pages/Fleet.tsx apps/admin/src/pages/VehicleDetail.tsx apps/admin/src/pages/Shareholders.tsx apps/admin/src/pages/ShareholderDetail.tsx apps/admin/src/App.tsx apps/admin/src/components/Shell.tsx
git commit -m "feat(parc-auto): ecrans admin parc auto (engins, actionnaires, affectation)"
```

---

### Task 8: Admin — bloc « Engin affecté » sur `UserDetail`

**Files:**
- Modify: `apps/admin/src/pages/UserDetail.tsx`

**Interfaces:**
- Consumes: champ `activeVehicle` ajouté en Task 6.

- [ ] **Step 1: Afficher le bloc** « Engin affecté » sur la fiche d'un livreur quand `activeVehicle` non null : plaque + marque/modèle + (actionnaire si présent), avec un `Link` vers `/fleet/vehicles/:id`. Masqué si null ou si l'utilisateur n'est pas livreur. Étendre le type local `UserDetailData` avec `activeVehicle`.
- [ ] **Step 2: Typecheck** — Run: `cd apps/admin && npm run typecheck` — Expected: pas d'erreur.
- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/pages/UserDetail.tsx
git commit -m "feat(parc-auto): lien engin affecte sur la fiche livreur"
```

---

## Notes d'exécution

- Design des écrans (Task 7-8) : suivre `design-system-qalitylabs` + `screen-brief` avant de coder chaque écran ; proposer des maquettes navigateur pour validation visuelle avant intégration finale.
- Déploiement (après validation) : serveur `cd /opt/toole/server && docker compose up -d --build toole-api` (le `prisma db push` du boot crée les tables), puis admin `cd /opt/toole/apps/admin && docker compose up -d --build toole-admin`. Rien côté mobile.
- Les scripts `smoke-fleet-*.ts` ne sont pas du code produit : ils peuvent rester (utilitaires) ou être retirés avant déploiement, au choix.
