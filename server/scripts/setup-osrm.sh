#!/usr/bin/env bash
#
# Prepare les donnees OSRM (Burkina Faso) pour le service `tolle-osrm`.
# A lancer UNE FOIS sur le VPS (et a re-lancer si tu veux rafraichir la carte).
#
# Usage (sur le VPS) :
#   cd /opt/toole/server
#   bash scripts/setup-osrm.sh
#   docker compose up -d tolle-osrm
#   docker compose up -d --build tolle-api   # pour prendre OSRM_BASE_URL
#
# Pre-requis : docker. ~1-2 Go RAM le temps du traitement (la carte BF est
# petite). Les fichiers prepares sont ecrits dans ./osrm-data (monte par le
# service tolle-osrm).
#
set -euo pipefail

OSRM_IMAGE="ghcr.io/project-osrm/osrm-backend:latest"
# Extrait OpenStreetMap du Burkina Faso (Geofabrik, mis a jour quotidiennement).
PBF_URL="https://download.geofabrik.de/africa/burkina-faso-latest.osm.pbf"
PBF_FILE="burkina-faso-latest.osm.pbf"
OSRM_BASE="burkina-faso-latest"

# Se place dans le dossier de donnees (a cote de ce script -> ../osrm-data)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)/osrm-data"
mkdir -p "$DATA_DIR"
cd "$DATA_DIR"

echo "==> 1/4 Telechargement de l'extrait OSM Burkina Faso..."
curl -fL --retry 3 -o "$PBF_FILE" "$PBF_URL"

echo "==> 2/4 osrm-extract (profil voiture)..."
docker run --rm -t -v "$DATA_DIR:/data" "$OSRM_IMAGE" \
  osrm-extract -p /opt/car.lua "/data/$PBF_FILE"

echo "==> 3/4 osrm-partition..."
docker run --rm -t -v "$DATA_DIR:/data" "$OSRM_IMAGE" \
  osrm-partition "/data/$OSRM_BASE.osrm"

echo "==> 4/4 osrm-customize..."
docker run --rm -t -v "$DATA_DIR:/data" "$OSRM_IMAGE" \
  osrm-customize "/data/$OSRM_BASE.osrm"

echo ""
echo "OK. Donnees OSRM pretes dans $DATA_DIR"
echo "Demarre le moteur :   docker compose up -d tolle-osrm"
echo "Puis rebuild l'API :  docker compose up -d --build tolle-api"
