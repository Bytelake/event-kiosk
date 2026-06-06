#!/usr/bin/env bash
# Install Prisma 5 + ARM64 client and initialize the SQLite database.
set -euo pipefail

INSTALL_DIR="${1:-/opt/kiosk}"
WEB_DIR="${INSTALL_DIR}/web"
TOOLS_DIR="${INSTALL_DIR}/prisma-tools"
SCHEMA="${WEB_DIR}/prisma/schema.prisma"
ENV_FILE="${WEB_DIR}/.env"

log() { echo "[setup-db] $*"; }

[[ -d "${WEB_DIR}" ]] || { log "Missing ${WEB_DIR}"; exit 1; }

if [[ ! -f "${ENV_FILE}" ]]; then
  cp "${WEB_DIR}/.env.example" "${ENV_FILE}"
  log "Created ${ENV_FILE}"
fi

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

log "Generating client and creating database (from ${WEB_DIR})..."
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

  if [[ ! -f prisma/dev.db ]]; then
    node prisma/seed.js
    echo '[setup-db] Seeded new database'
  else
    echo '[setup-db] Existing database preserved (seed skipped)'
  fi
"

chown -R kiosk:kiosk "${INSTALL_DIR}"
log "Database ready at ${WEB_DIR}/prisma/dev.db"
