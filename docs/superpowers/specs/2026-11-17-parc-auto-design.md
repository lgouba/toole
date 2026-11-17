# Parc Auto — actionnaires, engins, affectations & reporting

Date : 2026-11-17
Statut : en attente de validation
Portée : admin + backend uniquement. Aucun changement mobile. Aucun changement de logique métier existante.

## 1. Intention & pourquoi

Des personnes (« actionnaires ») achètent des motos, les mettent sur Toolé et les
confient à des livreurs. Toolé possède aussi des engins en propre. Aujourd'hui la
moto n'existe **que** comme champs sur le livreur (`DriverProfile.vehicleType /
vehiclePlate / vehiclePhotoUrl`, déclarés au KYC) : impossible de gérer un parc,
de savoir quel engin roule avec quel livreur, d'en garder l'historique, ni de
rendre compte à un actionnaire.

Le but final : pouvoir dire à un actionnaire « vous avez 3 motos dont 2 affectées,
voici ce que ça a rapporté par jour / par mois / par an ». Le calcul de la **part**
qui revient à l'actionnaire reste **hors système** (choix métier E retenu) : Toolé
affiche l'**activité brute** (nombre de courses livrées + total généré), l'admin
calcule la répartition lui-même.

## 2. Objectifs / non-objectifs / anti-objectifs

**Objectifs**
- Module admin « Parc Auto » : créer des actionnaires, créer des engins, affecter /
  désaffecter un engin à un livreur, voir qui roule avec quoi.
- Historique des engins (toutes les affectations passées avec leurs fenêtres).
- Un engin possédé par un actionnaire OU par Toolé (propriétaire optionnel).
- Reporting d'activité par engin et par actionnaire, ventilable jour / mois / année.
- La moto affectée visible sur la fiche livreur de la gestion des utilisateurs
  existante.

**Non-objectifs**
- Aucun flux d'argent : pas de reversement, pas de calcul de part, pas de
  transaction créée. Lecture/agrégation seule des `Delivery` existantes.
- Pas d'accès applicatif pour l'actionnaire (géré 100 % en admin pour l'instant).
- Rien côté app mobile (livreur/client).
- Pas de refonte de la gestion des utilisateurs : elle existe et marche, on
  l'enrichit seulement du lien engin.

**Anti-objectifs (échec même si « ça marche »)**
- Modifier `DriverProfile.vehicle*` ou la façon dont le KYC déclare un véhicule.
- Changer un champ, un payload, un appel API ou une navigation d'un flux existant
  (course, suivi, wallet, commissions).
- Rendre un engin indissociable d'un livreur (il doit vivre seul et changer de
  livreur dans le temps).

## 3. Contraintes

- Backend Node/Express/Prisma/Postgres ; migrations via `prisma db push` au boot
  **sans `--accept-data-loss`** → uniquement des tables neuves et des colonnes
  nullable / avec défaut (jamais de `@unique` ou NOT NULL ajouté sur une table
  existante peuplée).
- Routes admin sous `/api/admin/*`, gardées par `authRequired, requireRole('admin')`
  (voir `server/src/routes/admin.routes.ts`). Le module suit ce patron.
- Admin React/Vite (`apps/admin`) : `UsersList` est réutilisable par rôle,
  `UserDetail` routé sur `/users/:id`. Tokens/design = design-system-qalitylabs
  (fond clair, un accent vert, pas de dark).
- Nom officiel **Toolé** avec accent partout en UI.

## 4. Approches envisagées

- **A1 — Étendre `DriverProfile`.** Rejeté : un engin ne pourrait pas exister sans
  livreur, aucun historique, aucun actionnaire possible. Ne répond pas au besoin.
- **A2 — 3 tables additives autonomes (Actionnaire, Engin, Affectation), reporting
  en lecture seule sur `Delivery`.** Retenu : l'engin vit seul, change de livreur,
  garde son historique ; aucun impact sur l'existant.

**Séquencement (choisi : en 2 lots — Approche 2 de la discussion)**
- **Lot 1** livre un parc gérable tout de suite (CRUD + affectation + historique +
  totaux bruts + moto sur la fiche livreur).
- **Lot 2** livre le reporting fin (ventilation jour/mois/année + relevé actionnaire
  + export).

Chaque lot est validé séparément. Le présent document couvre les deux ; on
implémente le Lot 1 d'abord.

## 5. Modèle de données (Prisma — additif)

Trois nouvelles tables. Les champs `@db.Uuid`, `createdAt`/`updatedAt` suivent le
style des modèles existants.

### enum VehicleStatus
`en_service` · `en_panne` · `retire`

### enum VehicleOwnerType
`actionnaire` · `toole`  (engin du parc propre = `toole`, `shareholderId` null)

### model Shareholder (Actionnaire)
- `id`, `fullName` (requis), `phone?`, `email?`, `note?`
- `isActive Boolean @default(true)` (archivage doux plutôt que suppression dure)
- relations : `vehicles Vehicle[]`
- index : `@@index([fullName])`

### model Vehicle (Engin)
- `id`
- `vehicleType VehicleType` (réutilise l'enum existant : moto/velo/voiture/tricycle)
- `brand String?` (marque), `model String?` (modèle), `plate String?` (plaque),
  `photoUrl String?`
- `status VehicleStatus @default(en_service)`
- `ownerType VehicleOwnerType @default(toole)`
- `shareholderId String? @db.Uuid` → `shareholder Shareholder?` (null = parc Toolé)
- `note String?`
- relations : `assignments VehicleAssignment[]`
- index : `@@index([status])`, `@@index([shareholderId])`, `@@index([plate])`
- La plaque n'est **pas** `@unique` (contrainte `prisma db push` + données
  éventuellement sales) : unicité vérifiée au niveau applicatif (findFirst avant
  create), avec avertissement non bloquant si doublon.

### model VehicleAssignment (Affectation)
- `id`
- `vehicleId String @db.Uuid` → `vehicle Vehicle`
- `driverId String @db.Uuid` → `driver User` (rôle driver)
- `startedAt DateTime @default(now())`, `endedAt DateTime?` (null = affectation active)
- `note String?`, `endedBy String? @db.Uuid` (admin qui a désaffecté)
- index : `@@index([vehicleId])`, `@@index([driverId])`, `@@index([endedAt])`
- **Invariant applicatif** (pas de contrainte DB) : au plus **une** affectation
  active (`endedAt = null`) par engin, et au plus une par livreur. Affecter un engin
  déjà affecté → on ferme l'affectation précédente (endedAt = now) puis on crée la
  nouvelle, dans une transaction Prisma. Idem si le livreur avait déjà un engin.

Le modèle `User` reçoit la relation inverse `vehicleAssignments VehicleAssignment[]`.
`DriverProfile.vehicle*` reste **inchangé** (source KYC déclarative, distincte du
parc réel).

## 6. Calcul des revenus (lecture seule)

« Ce que rapporte un engin » = agrégation des `Delivery` **livrées**
(`status = 'delivered'`, `deliveredAt` non null) faites par le **livreur affecté
pendant la fenêtre de l'affectation**.

Pour un engin, sur une période [from, to] :
- pour chaque affectation de l'engin qui recoupe la période, prendre les livraisons
  du `driverId` de cette affectation dont `deliveredAt` ∈ [max(from, startedAt),
  min(to, endedAt ?? now)] ;
- agréger : **nombre de courses** livrées, **total généré** = Σ `price`,
  et (pour contexte) **gains livreur** = Σ `driverCommission`.

Pour un actionnaire = somme sur ses engins. Aucune part/pourcentage calculé.

Décisions de conception (validées avec le demandeur) :
- « Total généré » = Σ `Delivery.price` (montant total payé client). On affiche à
  côté Σ `driverCommission` pour information.
- Seules les courses `delivered` comptent (ni annulées ni en cours).
- **Attribution** : toutes les courses livrées par le livreur pendant la fenêtre
  d'affectation sont attribuées à **l'engin affecté** (on ne trace pas la moto
  physique par course ; confirmé comme l'approximation voulue).
- Les revenus suivent l'engin à travers **toutes** ses affectations successives
  (changer de livreur ne remet pas le compteur engin/actionnaire à zéro).

**Dimensions de reporting voulues : jour / mois / année ET par affectation.**
Chaque affectation porte donc ses propres agrégats (nb courses + total généré sur
sa fenêtre), pas seulement l'engin globalement.
- **Lot 1** : chiffre de tête = **cumul à vie** de l'engin (toutes affectations),
  affiché sur la liste et la fiche ; et l'**historique affiche les totaux de chaque
  affectation** (c'est le « par affectation », livré dès le Lot 1 car peu coûteux).
- **Lot 2** : ventilation temporelle **jour / mois / année** (séries + sélecteur de
  période) sur la fiche engin et le relevé actionnaire, la dimension « par
  affectation » restant disponible.

## 7. API (backend) — toutes sous `/api/admin/fleet`, role admin

Nouveau `fleet.controller.ts` + section dédiée dans `admin.routes.ts` (ou
`fleet.routes.ts` monté sur `/api/admin/fleet`).

**Lot 1**
- `GET  /shareholders` · `POST /shareholders` · `GET /shareholders/:id` ·
  `PATCH /shareholders/:id` · `POST /shareholders/:id/archive`
- `GET  /vehicles` (filtres : statut, propriétaire, affecté/libre) ·
  `POST /vehicles` · `GET /vehicles/:id` (inclut affectation active + historique +
  totaux bruts) · `PATCH /vehicles/:id`
- `POST /vehicles/:id/assign` `{ driverId, note? }` (ferme l'ancienne affectation
  si besoin, transaction) · `POST /vehicles/:id/unassign`
  - **Affectable uniquement si `status = en_service`** (ni `en_panne` ni `retire`).
  - **Réaffectation non silencieuse** : si le livreur a déjà un engin actif, ou si
    l'engin est déjà affecté, l'admin **confirme** (« ce livreur roule déjà avec X,
    il sera libéré ») avant de clôturer l'ancienne affectation.
- `GET  /drivers/assignable` : livreurs **`verificationStatus = verified` + `isActive`
  + non suspendus**. Un livreur déjà affecté reste listé (réaffectation possible,
  avec la confirmation ci-dessus).
- Enrichissement de `GET /api/admin/users/:id` (existant) : ajouter l'engin
  actuellement affecté au livreur (champ additif dans la réponse, sans retirer
  l'existant).

**Lot 2**
- `GET /vehicles/:id/report?granularity=day|month|year&from=&to=` → séries agrégées.
- `GET /shareholders/:id/report?...` → relevé (liste des engins + agrégats + séries).
- `GET /shareholders/:id/report.csv` (export).

## 8. Admin (frontend)

**Lot 1**
- Entrée de menu **« Parc Auto »**. Routes :
  - `/fleet` — liste des engins (tableau : plaque, type, marque/modèle, statut,
    propriétaire, livreur actuel, nb courses, total généré). États chargement / vide
    / erreur gérés.
  - `/fleet/vehicles/:id` — fiche engin : infos, propriétaire, affectation active
    (bouton affecter/désaffecter), cumul à vie (nb courses + total généré), et
    **historique des affectations avec les totaux de chaque affectation**.
  - **Photo d'engin : pas d'upload en Lot 1** (le champ `photoUrl` existe en base,
    mais aucun flux d'upload admin — création/édition sur du texte seulement ;
    upload ajoutable plus tard).
  - `/fleet/shareholders` — liste des actionnaires (nb d'engins, nb affectés).
  - `/fleet/shareholders/:id` — fiche actionnaire + ses engins.
  - Création actionnaire / engin via dialog (réutiliser `DialogProvider`).
- Fiche livreur (`UserDetail`) : bloc « Engin affecté » (lien vers la fiche engin)
  quand une affectation active existe.

**Lot 2**
- Sur la fiche engin et la fiche actionnaire : sélecteur de granularité
  (jour/mois/année) + plage de dates + graphe/series + export CSV. Vue « relevé »
  imprimable côté actionnaire.

Style : design-system-qalitylabs (fond clair, accent vert, la typo porte la
hiérarchie). Un `screen-brief` sera rempli pour les écrans de liste et de fiche
avant de les coder ; des maquettes navigateur seront proposées pour validation
visuelle avant intégration.

## 9. Migration & déploiement

- Schéma appliqué au boot par `prisma db push` (tables neuves → sûr).
- Déploiement serveur : `cd /opt/toole/server && docker compose up -d --build toole-api`.
- Admin : `cd /opt/toole/apps/admin && docker compose up -d --build toole-admin`.
- Aucun rebuild natif mobile, aucun OTA (rien côté app).

## 10. Laissé au builder

- Forme exacte des payloads de réponse et nommage des champs (cohérent avec
  l'existant admin).
- Détail visuel des écrans (via screen-brief + maquettes), dans les règles du
  design system.
- Validation applicative de l'unicité de plaque (avertissement vs blocage).
- Pagination/tri des listes (suivre le patron de `UsersList` / listes admin
  existantes).
