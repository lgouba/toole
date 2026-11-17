# Parc Auto — Lot 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter le reporting fin du Parc Auto : ventilation de l'activité par **jour / mois / année** sur la fiche engin et le **relevé actionnaire** (« vos N motos, voici ce que ça rapporte sur la période »), avec export CSV.

**Architecture:** Nouvelles fonctions d'agrégation **lecture seule** dans `fleet.service.ts` (séries temporelles via `date_trunc`, mêmes bornes de fenêtre d'affectation qu'au Lot 1). Nouvelles routes `GET /vehicles/:id/report`, `GET /shareholders/:id/report`, `GET /shareholders/:id/report.csv`. Admin : réutilise le composant `BarChart` existant (SVG pur, sans dépendance) et le pattern sélecteur de période du Dashboard, ajouté en section sur `VehicleDetail` et `ShareholderDetail`. Aucun changement de logique métier, aucun flux d'argent.

**Tech Stack:** Node/Express/Prisma 5/Postgres (`$queryRaw` + `date_trunc`), Zod ; admin Vite/React/axios, `components/BarChart.tsx`.

**Spec:** `docs/superpowers/specs/2026-11-17-parc-auto-design.md` (§6 dimensions, §7-8 Lot 2)

## Global Constraints

- Lecture seule : agrégation des `Delivery` `status='delivered'`, aucune écriture, aucun flux d'argent.
- Mêmes règles d'attribution qu'au Lot 1 : par engin = somme sur ses affectations ; fenêtre `[startedAt, COALESCE(endedAt, now())]` ; un bucket de période compte les courses `deliveredAt` dans l'intersection période ∩ fenêtre.
- Routes sous `/api/admin/fleet`, gardées `authRequired, requireRole('admin')`.
- Réponses via `success(res, data)` ; erreurs via `HttpError`. Zod pour les query params.
- Admin : réutiliser `BarChart` (`apps/admin/src/components/BarChart.tsx`) et `fmtFcfa` (`pages/fleetTypes.ts`). Fond clair, accent vert, nom **Toolé** (accent).
- Pas de framework de test → vérif = `npm run typecheck` (serveur + admin) + 1 smoke `tsx` (séries) exécutable sur base de dev.

## Review Focus

- **Buckets manquants** : une période sans course doit apparaître à 0 (pas d'absence de barre qui décale la lecture) — la série comble les trous sur [from,to] selon la granularité. Testé par le smoke Task 1.
- **Fenêtre ouverte dans un bucket courant** (`endedAt=null`) : les courses du mois/jour en cours comptent jusqu'à maintenant. Smoke Task 1.
- **Chevauchement période ∩ affectation** : une course hors de la fenêtre d'affectation mais dans la période ne doit PAS compter (et inversement). Smoke Task 1.
- **Fuseau horaire des buckets** : `date_trunc` s'exécute dans le TZ de la session Postgres ; la clé de bucket et le remplissage des trous doivent utiliser la même base (UTC) pour ne pas décaler d'un jour. Vérifié au smoke + revue.
- **CSV injection / format** : séparateur, en-têtes, montants numériques bruts (pas « 1 000 FCFA ») pour réimport tableur ; échapper les champs texte. Vérifié en revue Task 2.

---

### Task 1: Service — séries temporelles (engin, actionnaire)

**Files:**
- Modify: `server/src/services/fleet.service.ts`
- Create: `server/src/scripts/smoke-fleet-report.ts`

**Interfaces:**
- Consumes: `prisma.$queryRaw`, helpers Lot 1 (`ActivityTotals`, affectations).
- Produces :
  - type `Granularity = 'day' | 'month' | 'year'`
  - type `ReportBucket = { period: string; courses: number; totalGenere: number; gainsLivreur: number }` (`period` = ISO `YYYY-MM-DD` tronqué selon granularité)
  - `getVehicleReport(vehicleId: string, granularity: Granularity, from: Date, to: Date): Promise<{ series: ReportBucket[]; totals: ActivityTotals }>`
  - `getShareholderReport(shareholderId: string, granularity: Granularity, from: Date, to: Date): Promise<{ series: ReportBucket[]; totals: ActivityTotals; vehicles: Array<{ id: string; label: string; plate: string|null; totals: ActivityTotals }> }>`

- [ ] **Step 1: Helper d'agrégation par bucket** — `aggregateSeriesForDriverWindow(driverId, from, to, granularity)` : `$queryRaw` `SELECT date_trunc($granularity, "deliveredAt") AS bucket, COUNT(*) , SUM("price"), SUM("driverCommission") FROM "Delivery" WHERE "driverId"=$driverId AND status='delivered' AND "deliveredAt" >= $from AND "deliveredAt" < $to GROUP BY 1`. Retourne `Map<isoBucket, {courses,totalGenere,gainsLivreur}>` (bigint→number). La granularité est validée en amont (whitelist) et injectée via `Prisma.raw` sûr, pas d'interpolation libre.
- [ ] **Step 2: `getVehicleReport`** : pour chaque affectation de l'engin recoupant [from,to], appeler le helper sur `[max(from,startedAt), min(to, endedAt ?? now)]`, fusionner les Map par bucket, puis **combler** tous les buckets de [from,to] à 0 selon la granularité, trié croissant. `totals` = somme des buckets.
- [ ] **Step 3: `getShareholderReport`** : somme des séries de ses engins (buckets fusionnés) + un tableau par engin avec ses `ActivityTotals` sur la période (réutilise l'agrégat Lot 1 borné à [from,to]).
- [ ] **Step 4: Smoke** `smoke-fleet-report.ts` : engin + livreur + affectation, 2 courses `delivered` à des mois différents, assert que `getVehicleReport(..,'month',..)` produit les bons buckets, qu'un mois sans course est présent à 0, qu'une course hors fenêtre d'affectation est exclue. Nettoie. `SMOKE_OK`.
- [ ] **Step 5: Lancer le smoke** — Run: `cd server && npx tsx src/scripts/smoke-fleet-report.ts` — Expected: `SMOKE_OK` (nécessite DATABASE_URL de dev).
- [ ] **Step 6: Typecheck** — Run: `cd server && npm run typecheck` — Expected: exit 0.
- [ ] **Step 7: Commit**

```bash
git add server/src/services/fleet.service.ts server/src/scripts/smoke-fleet-report.ts
git commit -m "feat(parc-auto): series temporelles jour/mois/annee (engin, actionnaire)"
```

---

### Task 2: Controller + routes report (+ CSV)

**Files:**
- Modify: `server/src/controllers/fleet.controller.ts`, `server/src/routes/fleet.routes.ts`

**Interfaces:**
- Consumes: `getVehicleReport`, `getShareholderReport` (Task 1).
- Produces :
  - `GET /vehicles/:id/report?granularity=&from=&to=` → `{ series, totals }`
  - `GET /shareholders/:id/report?granularity=&from=&to=` → `{ series, totals, vehicles }`
  - `GET /shareholders/:id/report.csv?granularity=&from=&to=` → `text/csv` (une ligne par bucket : `periode,courses,total_genere,gains_livreur`).

- [ ] **Step 1: Schéma Zod** `reportQuery` : `granularity` enum day|month|year (défaut `day`), `from`/`to` dates ISO optionnelles (défauts : day→30j, month→12 mois, year→5 ans, calculés si absents). Helper `parseRange(q)`.
- [ ] **Step 2: Controllers** `getVehicleReportCtrl`, `getShareholderReportCtrl` (JSON via `success`), `getShareholderReportCsvCtrl` : construire le CSV (en-tête + lignes, montants **numériques bruts**, champs texte échappés, `\n`), `res.setHeader('Content-Type','text/csv; charset=utf-8')` + `Content-Disposition: attachment; filename="releve-<id>-<granularity>.csv"`, `res.send(csv)`.
- [ ] **Step 3: Routes** dans `fleet.routes.ts` : les 3 GET (la route `.csv` avant `/:id/report` n'est pas ambiguë car chemins distincts).
- [ ] **Step 4: Typecheck** — Run: `cd server && npm run typecheck` — Expected: exit 0.
- [ ] **Step 5: Commit**

```bash
git add server/src/controllers/fleet.controller.ts server/src/routes/fleet.routes.ts
git commit -m "feat(parc-auto): endpoints report engin/actionnaire + export CSV"
```

---

### Task 3: Admin — section « Activité » sur la fiche engin

**Files:**
- Modify: `apps/admin/src/pages/VehicleDetail.tsx`
- Modify: `apps/admin/src/pages/fleetTypes.ts` (types report + helper défauts de plage)

**Interfaces:**
- Consumes: `GET /vehicles/:id/report`, `BarChart` (`components/BarChart.tsx`), `fmtFcfa`.
- Produces: types `Granularity`, `ReportBucket`, `VehicleReport` dans `fleetTypes.ts` ; helper `defaultRange(granularity): {from,to}` (ISO yyyy-mm-dd).

- [ ] **Step 1: Types + helper** dans `fleetTypes.ts` : `Granularity`, `ReportBucket`, `VehicleReport = { series: ReportBucket[]; totals: ActivityTotals }`, `ShareholderReport`, et `defaultRange(g)`.
- [ ] **Step 2: Section Activité** sous l'historique de `VehicleDetail` : sélecteur **Jour / Mois / Année** (boutons façon Dashboard) + 2 inputs date (`from`/`to`, préremplis via `defaultRange`), chargement du report à chaque changement. Deux `BarChart` : **courses livrées** par période (vert `#1d9e75`) et **total généré** par période (`valueFormatter=fmtFcfa`). États chargement/vide/erreur. Libellés d'axe formatés selon la granularité (jj/mm, mm/aaaa, aaaa).
- [ ] **Step 3: Typecheck** — Run: `cd apps/admin && npm run typecheck` — Expected: exit 0.
- [ ] **Step 4: Build** — Run: `cd apps/admin && npm run build` — Expected: OK.
- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/pages/VehicleDetail.tsx apps/admin/src/pages/fleetTypes.ts
git commit -m "feat(parc-auto): ventilation jour/mois/annee sur la fiche engin"
```

---

### Task 4: Admin — relevé actionnaire (ventilation + CSV + impression)

**Files:**
- Modify: `apps/admin/src/pages/ShareholderDetail.tsx`

**Interfaces:**
- Consumes: `GET /shareholders/:id/report`, `GET /shareholders/:id/report.csv`, `BarChart`, `fmtFcfa`, `defaultRange` (Task 3).

- [ ] **Step 1: Section Relevé** sur `ShareholderDetail` : même sélecteur granularité + plage, `BarChart` des courses et du total généré sur la période, et un tableau **par engin** (plaque, courses, total généré) sur la période choisie. Phrase de tête « N engins dont M affectés ».
- [ ] **Step 2: Export CSV** : bouton « Exporter CSV » → `api.get('/admin/fleet/shareholders/:id/report.csv', { params, responseType: 'blob' })` puis déclenche un téléchargement (anchor + `URL.createObjectURL`, révoqué après). Nom de fichier depuis l'en-tête ou `releve-<nom>-<granularity>.csv`.
- [ ] **Step 3: Impression** : bouton « Imprimer » → `window.print()` (la vue relevé reste lisible à l'impression ; pas de CSS print dédié requis en Lot 2, option différable).
- [ ] **Step 4: Typecheck** — Run: `cd apps/admin && npm run typecheck` — Expected: exit 0.
- [ ] **Step 5: Build** — Run: `cd apps/admin && npm run build` — Expected: OK.
- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/pages/ShareholderDetail.tsx
git commit -m "feat(parc-auto): releve actionnaire (ventilation, export CSV, impression)"
```

---

## Notes d'exécution

- Réutiliser strictement `BarChart` existant (ne pas ajouter de lib de graphe). Si une courbe cumulée est souhaitée plus tard, c'est hors Lot 2.
- Déploiement (après validation) : `cd /opt/toole/server && docker compose up -d --build toole-api` puis `cd /opt/toole/apps/admin && docker compose up -d --build toole-admin`. Aucune migration (pas de changement de schéma au Lot 2). Rien côté mobile.
- Le smoke `smoke-fleet-report.ts` est un utilitaire jetable, exécutable sur base de dev.
