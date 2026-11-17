# Déploiement — Parc Auto Lot 1 (volet base de données)

## Ce qui change en base

3 tables neuves + 2 enums, **100 % additifs**. Aucune table existante
(`User`, `Delivery`, `DriverProfile`, …) n'est modifiée ; `DriverProfile.vehicle*`
reste tel quel. SQL complet : [`2026-11-17-parc-auto-lot1.sql`](./2026-11-17-parc-auto-lot1.sql).

- enums : `VehicleStatus` (`en_service|en_panne|retire`), `VehicleOwnerType` (`actionnaire|toole`)
- tables : `Shareholder`, `Vehicle`, `VehicleAssignment`
- 7 index + 3 clés étrangères (toutes portées par les tables neuves)

## Comment ça s'applique

Le conteneur applique le schéma **au boot** : `server/Dockerfile` →
`CMD ["sh","-c","npx prisma db push && node dist/index.js"]`. `db push` est lancé
**sans `--accept-data-loss`** : il crée les ajouts et **échoue** (sans rien casser)
s'il détecte un changement destructif. Comme tout est additif ici, le boot crée
les 3 tables et démarre normalement. **Aucune étape SQL manuelle n'est requise.**

## Procédure de déploiement

Rien de spécifique à faire côté BDD avant : la reconstruction du conteneur suffit.

```bash
cd /opt/toole/server && git pull && docker compose up -d --build toole-api
```

Puis l'admin (les nouveaux écrans Parc Auto) :

```bash
cd /opt/toole/apps/admin && docker compose up -d --build toole-admin
```

Rien côté mobile (aucun changement app, pas d'OTA, pas de build natif).

## Vérifications après déploiement

1. **Les tables existent** :
   ```bash
   cd /opt/toole/server && docker compose exec toole-api \
     npx prisma db execute --stdin <<< "SELECT to_regclass('\"Vehicle\"'), to_regclass('\"Shareholder\"'), to_regclass('\"VehicleAssignment\"');"
   ```
2. **L'API répond** (JWT admin requis) : `GET https://api.toole.qalitylabs.fr/api/admin/fleet/vehicles` → `200 { "data": [], "error": null }`.
3. **L'admin** affiche l'entrée de menu « Parc Auto » (Engins / Actionnaires).
4. **(Recommandé) smokes de logique** sur une base de dev (PAS la prod) avant/au moment du déploiement :
   ```bash
   cd /opt/toole/server && npx tsx src/scripts/smoke-fleet-assign.ts   # -> SMOKE_OK
   cd /opt/toole/server && npx tsx src/scripts/smoke-fleet-revenue.ts  # -> SMOKE_OK
   ```
   Ils créent des données factices et nettoient derrière eux.

## Rollback

Le code est additif et sans flux d'argent : revenir au conteneur précédent (image
antérieure) suffit, les 3 tables restent en base sans effet (plus personne ne les
lit). Si on veut vraiment les retirer (optionnel, après backup) :

```sql
DROP TABLE "VehicleAssignment";
DROP TABLE "Vehicle";
DROP TABLE "Shareholder";
DROP TYPE "VehicleOwnerType";
DROP TYPE "VehicleStatus";
```

## Sauvegarde

Déploiement non destructif → pas de backup obligatoire. Par prudence, un dump
Postgres avant déploiement reste une bonne pratique :
`docker compose exec <postgres> pg_dump -U <user> <db> > backup-pre-parcauto.sql`.
