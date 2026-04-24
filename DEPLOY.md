# Tôllé — Guide de déploiement

> **À lire avant toute commande de déploiement.**
> Ce fichier fixe le workflow réel pour éviter de casser ce qui marche.

---

## Infrastructure

- **VPS** : `/opt/toole/`
- **Backend** : conteneur Docker `tolle-api` (Express + Prisma + Postgres)
- **Admin** : conteneur Docker (Vite/React)
- **Base de données** : Postgres dans un conteneur, variables injectées via `docker-compose.yml`
- **Mobile** : Expo — **pas sur le VPS**, tourne en local (Expo Go ou build APK)

⚠️ **Il n'y a PAS de `.env` sur l'hôte VPS.** Les variables (`DATABASE_URL`, `JWT_*`, etc.) sont définies dans `docker-compose.yml` et injectées dans les conteneurs. Toute commande qui lit `.env` doit passer **par le conteneur**.

---

## Workflow de déploiement standard

### 1. En local — commit & push

```bash
cd /Users/macos/Tollé
git add -A
git commit -m "feat(...): ..."
git push origin main
```

### 2. Sur le VPS — backend

```bash
ssh root@<vps>
cd /opt/toole/server
git pull origin main

# Si le schéma Prisma a changé :
docker exec tolle-api npx prisma db push
# (db push applique les changements sans créer de migration)

# Rebuild + relance :
docker compose build --no-cache
docker compose up -d
```

### 3. Sur le VPS — admin (si modifié)

```bash
cd /opt/toole/apps/admin
git pull origin main
docker compose build --no-cache
docker compose up -d
```

### 4. Mobile (local)

- Expo Go : appuyer sur `r` dans le terminal Expo pour reload
- Si cache cassé : `npx expo start -c`
- Nouveau build APK seulement si natif changé (permissions, libs natives)

---

## Commandes Prisma — ⚠️ TOUJOURS via docker exec

| ❌ À ne JAMAIS faire sur le VPS   | ✅ À faire à la place                       |
| --------------------------------- | -------------------------------------------- |
| `npx prisma db push`              | `docker exec tolle-api npx prisma db push`   |
| `npx prisma generate`             | `docker exec tolle-api npx prisma generate`  |
| `npx prisma migrate deploy`       | `docker exec tolle-api npx prisma migrate deploy` |
| `npx prisma studio`               | `docker exec -it tolle-api npx prisma studio` |

**Pourquoi** : `DATABASE_URL` n'existe que dans le conteneur. Un `npx prisma` direct sur l'hôte échoue avec `Environment variable not found: DATABASE_URL` — même si Prisma dit "loaded from .env", ça veut dire qu'il a trouvé un fichier mais pas la variable dedans.

---

## Commandes interdites sur le VPS

Aucune de ces commandes n'est adaptée à ce setup :

- ❌ `npm run dev`, `npm start`, `npm run build` (directement sur l'hôte)
- ❌ `pm2 restart ...`
- ❌ `systemctl restart tolle-*`
- ❌ `cp .env.example .env` (casserait la config si un `.env` existait)
- ❌ Toucher à un `.env` sur l'hôte

---

## Vérifications rapides

```bash
# Voir les conteneurs qui tournent
docker ps

# Logs temps réel du backend
docker logs -f tolle-api

# Logs admin
docker compose -f /opt/toole/apps/admin/docker-compose.yml logs -f

# Se connecter au shell du conteneur backend
docker exec -it tolle-api sh

# Vérifier que DATABASE_URL est bien injectée
docker exec tolle-api printenv DATABASE_URL
```

---

## Checklist avant de pousser un changement de schéma Prisma

1. [ ] Modifs `schema.prisma` reviewées
2. [ ] `npx tsc --noEmit` passe en local (mobile + server + admin)
3. [ ] Commit + push
4. [ ] Sur VPS : `git pull`
5. [ ] `docker exec tolle-api npx prisma db push`
6. [ ] `docker compose build --no-cache && docker compose up -d`
7. [ ] `docker logs -f tolle-api` — vérifier pas d'erreur au démarrage
8. [ ] Test rapide depuis le mobile

---

## Notes pour Claude (ou tout assistant IA)

- Toujours **proposer la version `docker exec`** des commandes Prisma
- Jamais suggérer de créer/modifier un `.env` sur l'hôte VPS
- En cas de doute sur l'infra, **demander** avant de proposer une commande destructive (`git reset`, `docker volume rm`, `prisma migrate reset`, etc.)
- Ne pas inventer de commandes `pm2`/`systemctl` — c'est 100% Docker
