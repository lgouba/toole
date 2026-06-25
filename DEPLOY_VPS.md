# Deploiement du backend Toole sur VPS

Guide pour deployer `api.toole.qalitylabs.fr` sur un VPS Ubuntu/Debian avec SSH root.

## Prerequis sur ton VPS

- Ubuntu 22.04+ ou Debian 11+
- Port 80 et 443 ouverts (pour Nginx + Let's Encrypt)
- Un enregistrement DNS de type **A** pour `api.toole.qalitylabs.fr` qui pointe vers l'IP de ton VPS **avant** de lancer le certificat HTTPS

---

## 1. Installation des dependances systeme

Connecte-toi en SSH root puis :

```bash
# Mise a jour
apt update && apt upgrade -y

# Outils de base
apt install -y curl git build-essential ufw

# Node.js 22 (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node --version   # doit afficher v22.x
npm --version

# PostgreSQL 16
apt install -y postgresql postgresql-contrib
systemctl enable --now postgresql

# Nginx + Certbot (HTTPS)
apt install -y nginx certbot python3-certbot-nginx

# PM2 (gestion du process Node)
npm install -g pm2
```

Configure le firewall :

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
```

---

## 2. Creer l'utilisateur et la base PostgreSQL

```bash
# Generer un mot de passe fort pour la DB
DB_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=')
echo "Mot de passe DB : $DB_PASSWORD"  # NOTE-LE, tu en as besoin plus bas

# Creer l'utilisateur et la base
sudo -u postgres psql <<EOF
CREATE USER toole WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE toole OWNER toole;
GRANT ALL PRIVILEGES ON DATABASE toole TO toole;
EOF

# Verifier
sudo -u postgres psql -c "\du"
```

---

## 3. Deployer le code du backend

### Option A - Via Git (recommande)

Depuis ton Mac, cree un repo sur GitHub/GitLab puis pousse le code :

```bash
cd /Users/macos/Tollé
git init
# Ajouter un .gitignore racine si pas deja fait
git add server/
git commit -m "initial backend"
git remote add origin git@github.com:TON_USER/toole.git
git push -u origin main
```

Sur le VPS :

```bash
mkdir -p /opt/toole
cd /opt/toole
git clone git@github.com:TON_USER/toole.git .
# ou https si pas de cle SSH : git clone https://github.com/TON_USER/toole.git .
cd server
```

### Option B - Via scp (rapide, sans Git)

Depuis ton Mac :

```bash
cd /Users/macos/Tollé
rsync -avz --exclude 'node_modules' --exclude 'dist' server/ root@TON_VPS_IP:/opt/toole/server/
```

Sur le VPS :

```bash
cd /opt/toole/server
```

---

## 4. Configurer les variables d'environnement

```bash
cd /opt/toole/server
cp .env.example .env

# Generer des secrets JWT
JWT_ACCESS=$(openssl rand -hex 32)
JWT_REFRESH=$(openssl rand -hex 32)

# Editer le .env
nano .env
```

Contenu du `.env` :

```env
DATABASE_URL="postgresql://toole:LE_MOT_DE_PASSE_DB@localhost:5432/toole"
JWT_ACCESS_SECRET="COLLER_ICI_LA_VALEUR_JWT_ACCESS"
JWT_REFRESH_SECRET="COLLER_ICI_LA_VALEUR_JWT_REFRESH"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="30d"
PORT=3000
NODE_ENV=production
CORS_ORIGIN="*"
OTP_DEV_CODE="1234"
```

> ⚠️ En production reelle, change `OTP_DEV_CODE` et branche un vrai SMS provider. Pour les tests, garde `1234`.

---

## 5. Installer, migrer et build

```bash
cd /opt/toole/server
npm install --omit=dev --include=dev  # on a besoin des devDependencies pour build
npm run db:generate
npm run db:deploy                      # applique les migrations Prisma
npm run build                          # compile TypeScript -> dist/
```

---

## 6. Demarrer avec PM2

```bash
cd /opt/toole/server
pm2 start ecosystem.config.js
pm2 logs toole-api --lines 50          # verifier les logs

# Sauvegarder la config pour reboot automatique
pm2 save
pm2 startup                            # copie-colle la commande retournee
```

Verifier que l'API repond :

```bash
curl http://localhost:3000/health
# { "status": "ok", "timestamp": "..." }
```

---

## 7. Configurer Nginx en reverse proxy

```bash
cat > /etc/nginx/sites-available/toole-api <<'EOF'
server {
    listen 80;
    server_name api.toole.qalitylabs.fr;

    # Taille max upload (pour photos colis)
    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 3600s;   # WebSocket: keep alive
        proxy_send_timeout 3600s;
    }
}
EOF

ln -s /etc/nginx/sites-available/toole-api /etc/nginx/sites-enabled/
nginx -t           # verifier la syntaxe
systemctl reload nginx
```

Verifier : `curl http://api.toole.qalitylabs.fr/health`

---

## 8. Activer HTTPS avec Let's Encrypt

```bash
certbot --nginx -d api.toole.qalitylabs.fr --non-interactive --agree-tos -m ton@email.com --redirect
```

Certbot modifie automatiquement la config Nginx pour rediriger HTTP → HTTPS.

Verifier : `curl https://api.toole.qalitylabs.fr/health`

Le renouvellement auto est deja configure via cron/systemd. Tu peux tester avec :

```bash
certbot renew --dry-run
```

---

## 9. Pointer l'app mobile vers l'API

Dans [apps/mobile/config/api.ts](apps/mobile/config/api.ts), l'URL par defaut est deja `https://api.toole.qalitylabs.fr`. Rien a changer si tu fais un nouveau build APK.

Pour surcharger en dev local, cree `apps/mobile/.env` :

```
EXPO_PUBLIC_API_URL=http://192.168.1.10:3000
```

---

## 10. Commandes utiles au quotidien

```bash
# Voir les logs en direct
pm2 logs toole-api

# Redemarrer l'API
pm2 restart toole-api

# Voir le statut
pm2 status

# Accepter des requetes externes (si firewall bloque)
ufw status

# Se connecter a la DB
sudo -u postgres psql toole

# Voir les utilisateurs inscrits
sudo -u postgres psql toole -c "SELECT id, phone, \"fullName\", \"userType\", \"createdAt\" FROM \"User\" ORDER BY \"createdAt\" DESC LIMIT 20;"

# Voir les livraisons en cours
sudo -u postgres psql toole -c "SELECT reference, status, \"createdAt\" FROM \"Delivery\" ORDER BY \"createdAt\" DESC LIMIT 10;"

# Mise a jour du code
cd /opt/toole
git pull
cd server
npm install
npm run db:deploy
npm run build
pm2 restart toole-api
```

---

## 11. Debug rapide

**L'API ne repond pas ?**
```bash
pm2 status
pm2 logs toole-api --err
systemctl status nginx
```

**Erreur de connexion DB ?**
```bash
systemctl status postgresql
sudo -u postgres psql -c "SELECT 1;"
# Tester l'URL du .env
PGPASSWORD=TON_MDP psql -h localhost -U toole -d toole -c "SELECT 1;"
```

**Socket.IO ne fonctionne pas ?**
- Verifie que Nginx a bien `proxy_set_header Upgrade $http_upgrade` et `Connection "upgrade"`
- Verifie les logs PM2
- Teste avec `wscat` : `wscat -c wss://api.toole.qalitylabs.fr/socket.io/?EIO=4&transport=websocket`

---

## 12. Securite en production reelle (plus tard)

- Change `CORS_ORIGIN="*"` en liste explicite d'origines
- Remplace `OTP_DEV_CODE="1234"` par un vrai provider SMS (Twilio, Orange SMS API, Africa's Talking)
- Desactive `NODE_ENV=development` (deja fait ci-dessus)
- Ajoute rate limiting (`express-rate-limit`)
- Sauvegarde automatique PostgreSQL (cron + `pg_dump`)
- Monitoring : UptimeRobot, Grafana, etc.
