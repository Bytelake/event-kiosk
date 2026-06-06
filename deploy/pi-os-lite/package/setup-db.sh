#!/usr/bin/env bash
# Install Prisma 5 + ARM64 client and initialize the SQLite database.
set -euo pipefail

INSTALL_DIR="${1:-/opt/kiosk}"
WEB_DIR="${INSTALL_DIR}/web"
TOOLS_DIR="${INSTALL_DIR}/prisma-tools"
SCHEMA="${WEB_DIR}/prisma/schema.prisma"
ENV_FILE="${WEB_DIR}/.env"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=kiosk-paths.sh
source "${SCRIPT_DIR}/kiosk-paths.sh"

log() { echo "[setup-db] $*"; }

[[ -d "${WEB_DIR}" ]] || { log "Missing ${WEB_DIR}"; exit 1; }

if [[ ! -f "${ENV_FILE}" ]]; then
  cp "${WEB_DIR}/.env.example" "${ENV_FILE}"
  log "Created ${ENV_FILE}"
fi

# Move a misplaced dev.db (file:./dev.db) into prisma/dev.db and fix .env.
if grep -qE '^[[:space:]]*DATABASE_URL="file:./dev\.db"' "${ENV_FILE}" 2>/dev/null; then
  if [[ -f "${WEB_DIR}/dev.db" ]]; then
    mkdir -p "${WEB_DIR}/prisma"
    if [[ ! -f "${WEB_DIR}/prisma/dev.db" ]]; then
      mv "${WEB_DIR}/dev.db" "${WEB_DIR}/prisma/dev.db"
      [[ -f "${WEB_DIR}/dev.db-journal" ]] && mv "${WEB_DIR}/dev.db-journal" "${WEB_DIR}/prisma/dev.db-journal" || true
      log "Moved web/dev.db to web/prisma/dev.db"
    fi
  fi
  sed -i 's|DATABASE_URL="file:./dev.db"|DATABASE_URL="file:./prisma/dev.db"|' "${ENV_FILE}"
  log "Normalized DATABASE_URL to file:./prisma/dev.db"
fi

migrate_legacy_install "${INSTALL_DIR}"

DB_FILE="$(resolve_database_file "${WEB_DIR}")"
DB_REL="${DB_FILE#${WEB_DIR}/}"

mkdir -p "${TOOLS_DIR}" "${WEB_DIR}/prisma"
cat >"${TOOLS_DIR}/package.json" <<'JSON'
{
  "private": true,
  "dependencies": {
    "@prisma/client": "5.22.0",
    "prisma": "5.22.0"
  }
}
JSON

chown -R kiosk:kiosk "${INSTALL_DIR}"

log "Installing Prisma 5 CLI in ${TOOLS_DIR}..."
sudo -u kiosk bash -lc "
  set -euo pipefail
  cd '${TOOLS_DIR}'
  npm install --omit=dev --no-package-lock
"

PRISMA_BIN="${TOOLS_DIR}/node_modules/.bin/prisma"

log "Staging @prisma/client for generate (standalone bundle is incomplete)..."
mkdir -p "${WEB_DIR}/node_modules"
rm -rf "${WEB_DIR}/node_modules/@prisma" "${WEB_DIR}/node_modules/.prisma"
cp -R "${TOOLS_DIR}/node_modules/@prisma" "${WEB_DIR}/node_modules/"

log "Generating client and migrating database at ${DB_FILE}..."
sudo -u kiosk bash -lc "
  set -euo pipefail
  cd '${WEB_DIR}'

  # Load .env so DATABASE_URL is available to Prisma
  if [[ -f .env ]]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
  fi
  export DATABASE_URL=\"\${DATABASE_URL:-file:./prisma/dev.db}\"
  # Prevent prisma generate from running \"npm i prisma -D\" in the web tree.
  # That triggers apps/web postinstall, which fails because schema lives at prisma/.
  export PRISMA_GENERATE_SKIP_AUTOINSTALL=1

  '${PRISMA_BIN}' generate --schema=prisma/schema.prisma
  '${PRISMA_BIN}' db push --schema=prisma/schema.prisma

  if [[ ! -f '${DB_REL}' ]]; then
    node prisma/seed.js
    echo '[setup-db] Seeded new database'
  else
    echo '[setup-db] Existing database preserved (seed skipped)'
  fi
"

chown -R kiosk:kiosk "${INSTALL_DIR}"
log "Database ready at ${DB_FILE}"
