#!/bin/bash
# ============================================================
# Backup DB Tollé — pg_dump quotidien
# ============================================================
#
# Que fait ce script :
#   - dump complet de la DB postgres via le conteneur toole-db
#   - compresse avec gzip
#   - sauvegarde dans /opt/toole/backups/ avec timestamp
#   - rotation : garde les 30 derniers backups, supprime les autres
#
# Usage :
#   bash /opt/toole/server/scripts/backup-db.sh
#
# A planifier via cron (voir README en bas du fichier).
# ============================================================

set -euo pipefail

# --- Config ---
BACKUP_DIR="/opt/toole/backups"
COMPOSE_DIR="/opt/toole/server"
DB_CONTAINER="toole-db"
DB_NAME="toole"
DB_USER="toole"
RETENTION_DAYS=30
LOG_FILE="/var/log/toole-backup.log"

# --- Setup ---
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
FILENAME="toole-${TIMESTAMP}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

# Fonction log avec timestamp
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# --- Backup ---
log "=== Démarrage backup ${FILENAME} ==="

# pg_dump via le container, pipe directement dans gzip pour économiser la RAM
if ! cd "$COMPOSE_DIR"; then
  log "ERROR: Cannot cd to $COMPOSE_DIR"
  exit 1
fi

if ! docker compose exec -T "$DB_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists | gzip > "$FILEPATH"; then
  log "ERROR: pg_dump failed"
  rm -f "$FILEPATH"
  exit 1
fi

# Vérifie que le dump n'est pas vide (taille > 1KB minimum)
SIZE=$(stat -c%s "$FILEPATH" 2>/dev/null || stat -f%z "$FILEPATH")
if [ "$SIZE" -lt 1024 ]; then
  log "ERROR: Backup file suspiciously small (${SIZE} bytes), removing"
  rm -f "$FILEPATH"
  exit 1
fi

SIZE_HUMAN=$(du -h "$FILEPATH" | cut -f1)
log "Backup OK : ${FILENAME} (${SIZE_HUMAN})"

# --- Rotation ---
# Supprime les backups plus vieux que RETENTION_DAYS
log "Cleanup : suppression backups > ${RETENTION_DAYS} jours"
DELETED=$(find "$BACKUP_DIR" -name "toole-*.sql.gz" -type f -mtime +${RETENTION_DAYS} -print -delete | wc -l)
log "Anciens backups supprimés : ${DELETED}"

# Affiche un résumé
TOTAL_BACKUPS=$(find "$BACKUP_DIR" -name "toole-*.sql.gz" -type f | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
log "État : ${TOTAL_BACKUPS} backups, taille totale ${TOTAL_SIZE}"
log "=== Backup terminé ==="

# ============================================================
# INSTALLATION DU CRON
# ============================================================
#
# Pour planifier ce script chaque jour à 3h du matin, lance UNE FOIS :
#
#   sudo chmod +x /opt/toole/server/scripts/backup-db.sh
#   sudo touch /var/log/toole-backup.log
#   sudo chmod 644 /var/log/toole-backup.log
#
#   # Ouvre le crontab root
#   sudo crontab -e
#
#   # Ajoute cette ligne :
#   0 3 * * * /opt/toole/server/scripts/backup-db.sh >> /var/log/toole-backup.log 2>&1
#
# Verif que le cron est bien chargé :
#   sudo crontab -l
#
# Test immédiat (lance le script manuellement) :
#   sudo bash /opt/toole/server/scripts/backup-db.sh
#
# Voir les logs des backups passés :
#   tail -50 /var/log/toole-backup.log
#
# Voir les backups disponibles :
#   ls -lh /opt/toole/backups/
#
# ============================================================
# RESTAURATION
# ============================================================
#
# Pour restaurer un backup (ATTENTION : ÉCRASE la DB actuelle !) :
#
#   cd /opt/toole/server
#   gunzip < /opt/toole/backups/toole-YYYYMMDD-HHMMSS.sql.gz | \
#     docker compose exec -T toole-db psql -U toole -d toole
#
# Pour restaurer sur une DB de test (sans toucher prod) :
#
#   docker run --rm -d --name test-db \
#     -e POSTGRES_USER=toole -e POSTGRES_PASSWORD=test -e POSTGRES_DB=toole \
#     -p 5433:5432 postgres:16-alpine
#   gunzip < backup.sql.gz | psql -h localhost -p 5433 -U toole -d toole
#
# ============================================================
