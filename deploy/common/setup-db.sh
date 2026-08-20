#!/usr/bin/env bash
# Install Prisma 5 + native client for host arch. Initialize or migrate the SQLite database.
#
# Usage:
#   setup-db.sh [INSTALL_DIR]           — full init (generate + db push + seed if new)
#   setup-db.sh [INSTALL_DIR] --generate-only — regenerate Prisma client only (updates)
set -euo pipefail

INSTALL_DIR="${1:-/opt/kiosk}"
MODE="${2:-}"
WEB_DIR="${INSTALL_DIR}/web"
TOOLS_DIR="${INSTALL_DIR}/prisma-tools"
ENV_FILE=""
DB_FILE=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=kiosk-paths.sh
source "${SCRIPT_DIR}/kiosk-paths.sh"

log() { echo "[setup-db] $*"; }

[[ -d "${WEB_DIR}" ]] || { log "Missing ${WEB_DIR}"; exit 1; }

ensure_data_dir
write_env_if_missing "${WEB_DIR}/.env.example"

ENV_FILE="$(kiosk_env_file)"
DB_FILE="$(kiosk_db_file)"

mkdir -p "${TOOLS_DIR}"
cat >"${TOOLS_DIR}/package.json" <<'JSON'
{
  "private": true,
  "dependencies": {
    "@prisma/client": "5.22.0",
    "prisma": "5.22.0"
  }
}
JSON

chown -R kiosk:kiosk "${INSTALL_DIR}" "${KIOSK_DATA_DIR}"

log "Installing Prisma 5 CLI in ${TOOLS_DIR}..."
sudo -u kiosk bash -lc "
  set -euo pipefail
  cd '${TOOLS_DIR}'
  npm install --omit=dev --no-package-lock
"

PRISMA_BIN="${TOOLS_DIR}/node_modules/.bin/prisma"

log "Staging @prisma/client for generate (standalone bundle is incomplete)..."
install -d -o kiosk -g kiosk "${WEB_DIR}/node_modules"
rm -rf "${WEB_DIR}/node_modules/@prisma" "${WEB_DIR}/node_modules/.prisma"
cp -R "${TOOLS_DIR}/node_modules/@prisma" "${WEB_DIR}/node_modules/"
# cp runs as root; kiosk must own node_modules before prisma generate writes .prisma
chown -R kiosk:kiosk "${WEB_DIR}/node_modules" "${TOOLS_DIR}"

if [[ "${MODE}" == "--generate-only" ]]; then
  log "Regenerating Prisma client..."
  sudo -u kiosk bash -lc "
    set -euo pipefail
    cd '${WEB_DIR}'
    export PRISMA_GENERATE_SKIP_AUTOINSTALL=1
    '${PRISMA_BIN}' generate --schema=prisma/schema.prisma
  "
  kiosk_install_sharp "${INSTALL_DIR}"
  chown -R kiosk:kiosk "${INSTALL_DIR}"
  log "Prisma client ready (database untouched at ${DB_FILE})"
  exit 0
fi

# Refuse relative SQLite URLs. Prisma 7 resolves file:./dev.db next to the app,
# which would create a second empty database instead of updating kiosk.db.
db_url=""
if [[ -f "${ENV_FILE}" ]]; then
  db_url="$(grep -E '^DATABASE_URL=' "${ENV_FILE}" | tail -1 | cut -d= -f2- || true)"
  db_url="${db_url#\"}"
  db_url="${db_url%\"}"
  db_url="${db_url#\'}"
  db_url="${db_url%\'}"
fi
db_url="${db_url:-file:${DB_FILE}}"
db_path="${db_url#file:}"
db_path="${db_path#//}"
if [[ "${db_path}" != /* ]]; then
  log "ERROR: DATABASE_URL must be an absolute SQLite path (got ${db_url})"
  log "Refusing schema push so a second empty database is not created."
  exit 1
fi

SEED_NEW_DB=0
if [[ ! -f "${DB_FILE}" ]]; then
  SEED_NEW_DB=1
fi

if [[ -f "${DB_FILE}" ]]; then
  cp -a "${DB_FILE}" "${DB_FILE}.pre-schema-push"
  chown kiosk:kiosk "${DB_FILE}.pre-schema-push"
  log "Backed up existing database to ${DB_FILE}.pre-schema-push"
fi

log "Generating client and applying schema to ${DB_FILE}..."
sudo -u kiosk bash -lc "
  set -euo pipefail
  cd '${WEB_DIR}'

  if [[ -f '${ENV_FILE}' ]]; then
    set -a
    # shellcheck disable=SC1091
    source '${ENV_FILE}'
    set +a
  fi
  export DATABASE_URL=\"\${DATABASE_URL:-file:${DB_FILE}}\"
  export PRISMA_GENERATE_SKIP_AUTOINSTALL=1

  '${PRISMA_BIN}' generate --schema=prisma/schema.prisma
  # Additive only. Never pass --force-reset or --accept-data-loss.
  '${PRISMA_BIN}' db push --schema=prisma/schema.prisma

  if [[ '${SEED_NEW_DB}' == '1' ]]; then
    node prisma/seed.js
    echo '[setup-db] Seeded new database'
  else
    echo '[setup-db] Existing database preserved (seed skipped)'
  fi
"

chown -R kiosk:kiosk "${INSTALL_DIR}" "${KIOSK_DATA_DIR}"
kiosk_install_sharp "${INSTALL_DIR}"
log "Database ready at ${DB_FILE}"
