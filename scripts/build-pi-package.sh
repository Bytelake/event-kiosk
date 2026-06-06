#!/usr/bin/env bash
# Build Pi release package: npm run package:pi → dist/event-kiosk-pi-<version>.tar.gz
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "require('${ROOT}/package.json').version")"
OUT_DIR="${ROOT}/dist"
PACKAGE_NAME="event-kiosk-pi-${VERSION}"
ARCHIVE="${OUT_DIR}/${PACKAGE_NAME}.tar.gz"

log() { echo "[package:pi] $*"; }

log "Building web app (standalone)..."
cd "${ROOT}/apps/web"
npm run build

log "Building Electron shell..."
cd "${ROOT}/apps/shell"
npm run build

log "Staging release files..."
PACKAGE_ROOT="${OUT_DIR}/${PACKAGE_NAME}"
rm -rf "${PACKAGE_ROOT}"
mkdir -p "${PACKAGE_ROOT}/web" "${PACKAGE_ROOT}/shell/dist" "${PACKAGE_ROOT}/bin" "${PACKAGE_ROOT}/systemd"

# Next.js standalone server
STANDALONE="${ROOT}/apps/web/.next/standalone"
cp -R "${STANDALONE}/." "${PACKAGE_ROOT}/web/"
# Drop Mac-built Prisma — Pi install downloads ARM64 binaries
rm -rf "${PACKAGE_ROOT}/web/node_modules/@prisma" "${PACKAGE_ROOT}/web/node_modules/.prisma" 2>/dev/null || true
mkdir -p "${PACKAGE_ROOT}/web/apps/web/.next"
cp -R "${ROOT}/apps/web/.next/static" "${PACKAGE_ROOT}/web/apps/web/.next/static"
cp -R "${ROOT}/apps/web/public" "${PACKAGE_ROOT}/web/apps/web/public"
mkdir -p "${PACKAGE_ROOT}/web/prisma"
rsync -a --exclude dev.db --exclude dev.db-journal \
  "${ROOT}/apps/web/prisma/" "${PACKAGE_ROOT}/web/prisma/"
cp "${ROOT}/apps/web/.env.example" "${PACKAGE_ROOT}/web/.env.example"

# Electron shell (native electron binary installed on Pi during install)
cp -R "${ROOT}/apps/shell/dist/." "${PACKAGE_ROOT}/shell/dist/"
cp "${ROOT}/apps/shell/package.json" "${PACKAGE_ROOT}/shell/package.json"
cp "${ROOT}/apps/shell/src/registration-chrome.html" "${PACKAGE_ROOT}/shell/dist/registration-chrome.html"
cp "${ROOT}/apps/shell/src/registration-keyboard.html" "${PACKAGE_ROOT}/shell/dist/registration-keyboard.html"

# Helper scripts & systemd units
cp "${ROOT}/deploy/pi-os-lite/package/bin/"*.sh "${PACKAGE_ROOT}/bin/"
cp "${ROOT}/deploy/pi-os-lite/display.env.example" "${PACKAGE_ROOT}/display.env.example"
cp "${ROOT}/deploy/pi-os-lite/package/systemd/"*.service "${PACKAGE_ROOT}/systemd/"
cp "${ROOT}/deploy/pi-os-lite/package/install.sh" "${PACKAGE_ROOT}/install.sh"
cp "${ROOT}/deploy/pi-os-lite/package/update.sh" "${PACKAGE_ROOT}/update.sh"
cp "${ROOT}/deploy/pi-os-lite/package/uninstall.sh" "${PACKAGE_ROOT}/uninstall.sh"
cp "${ROOT}/deploy/pi-os-lite/package/diagnose.sh" "${PACKAGE_ROOT}/diagnose.sh"
cp "${ROOT}/deploy/pi-os-lite/package/fix-prisma.sh" "${PACKAGE_ROOT}/fix-prisma.sh"
cp "${ROOT}/deploy/pi-os-lite/package/fix-permissions.sh" "${PACKAGE_ROOT}/fix-permissions.sh"
cp "${ROOT}/deploy/pi-os-lite/package/setup-db.sh" "${PACKAGE_ROOT}/setup-db.sh"
cp "${ROOT}/deploy/pi-os-lite/package/kiosk-paths.sh" "${PACKAGE_ROOT}/kiosk-paths.sh"
cp "${ROOT}/deploy/pi-os-lite/package/README.txt" "${PACKAGE_ROOT}/README.txt"

chmod +x "${PACKAGE_ROOT}/install.sh" "${PACKAGE_ROOT}/update.sh" "${PACKAGE_ROOT}/uninstall.sh" "${PACKAGE_ROOT}/diagnose.sh"
chmod +x "${PACKAGE_ROOT}/fix-prisma.sh" "${PACKAGE_ROOT}/fix-permissions.sh" "${PACKAGE_ROOT}/setup-db.sh"
chmod +x "${PACKAGE_ROOT}/bin/"*.sh

mkdir -p "${OUT_DIR}"
tar -czf "${ARCHIVE}" -C "${OUT_DIR}" "${PACKAGE_NAME}"

BYTES=$(wc -c < "${ARCHIVE}" | tr -d ' ')
log "Done: ${ARCHIVE} ($(numfmt --to=iec-i --suffix=B "${BYTES}" 2>/dev/null || echo "${BYTES} bytes"))"
log ""
log "Deploy to Pi:"
log "  scp ${ARCHIVE} pi@<pi-ip>:~/"
log "  ssh pi@<pi-ip>"
log "  tar -xzf ${PACKAGE_NAME}.tar.gz && cd ${PACKAGE_NAME} && sudo bash install.sh"
