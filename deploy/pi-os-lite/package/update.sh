#!/usr/bin/env bash
#
# In-place upgrade for an existing Event Kiosk install.
# Preserves database, .env, uploaded images, and display settings.
#
# Usage (from extracted release tarball):
#   tar -xzf event-kiosk-pi-*.tar.gz
#   cd event-kiosk-pi-*
#   sudo bash update.sh
#
set -euo pipefail

INSTALL_DIR="/opt/kiosk"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log() { echo "[update] $*"; }
die() { echo "[update] ERROR: $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run as root: sudo bash update.sh"
[[ -d "${INSTALL_DIR}/web" ]] || die "No existing install at ${INSTALL_DIR}. Run install.sh first."

log "Updating Event Kiosk at ${INSTALL_DIR}..."

# ---------------------------------------------------------------------------
# 1. Backup persistent data before touching anything
# ---------------------------------------------------------------------------
BACKUP_DIR="/var/backups/kiosk/$(date +%Y%m%d-%H%M%S)"
mkdir -p "${BACKUP_DIR}"
log "Backing up persistent data to ${BACKUP_DIR}..."

for item in \
  "${INSTALL_DIR}/web/prisma/dev.db" \
  "${INSTALL_DIR}/web/.env" \
  "${INSTALL_DIR}/display.env"; do
  if [[ -f "${item}" ]]; then
    cp -a "${item}" "${BACKUP_DIR}/"
  fi
done

UPLOADS="${INSTALL_DIR}/web/apps/web/public/uploads"
if [[ -d "${UPLOADS}" ]] && [[ -n "$(ls -A "${UPLOADS}" 2>/dev/null || true)" ]]; then
  cp -a "${UPLOADS}" "${BACKUP_DIR}/uploads"
fi

# ---------------------------------------------------------------------------
# 2. Copy new application files (never delete persistent paths)
# ---------------------------------------------------------------------------
log "Installing updated application files..."
rsync -a --delete \
  --exclude web/prisma/dev.db \
  --exclude web/prisma/dev.db-journal \
  --exclude web/.env \
  --exclude web/apps/web/public/uploads/ \
  --exclude display.env \
  --exclude prisma-tools/ \
  --exclude shell/node_modules/ \
  "${SCRIPT_DIR}/" "${INSTALL_DIR}/"

chmod +x "${INSTALL_DIR}/bin/"*.sh \
  "${INSTALL_DIR}/install.sh" \
  "${INSTALL_DIR}/update.sh" \
  "${INSTALL_DIR}/uninstall.sh" \
  "${INSTALL_DIR}/diagnose.sh" \
  "${INSTALL_DIR}/setup-db.sh" \
  "${INSTALL_DIR}/fix-prisma.sh" \
  "${INSTALL_DIR}/fix-permissions.sh" 2>/dev/null || true

mkdir -p "${UPLOADS}"
chown -R kiosk:kiosk "${INSTALL_DIR}"

# ---------------------------------------------------------------------------
# 3. Migrate database schema (preserve existing rows)
# ---------------------------------------------------------------------------
log "Migrating database schema..."
bash "${INSTALL_DIR}/setup-db.sh" "${INSTALL_DIR}"

# ---------------------------------------------------------------------------
# 4. Refresh Electron shell if package.json changed
# ---------------------------------------------------------------------------
log "Checking Electron shell..."
sudo -u kiosk bash -lc "
  set -euo pipefail
  cd '${INSTALL_DIR}/shell'
  npm install --omit=dev
"

chown -R kiosk:kiosk "${INSTALL_DIR}"

# ---------------------------------------------------------------------------
# 5. Restart services
# ---------------------------------------------------------------------------
systemctl daemon-reload
systemctl restart kiosk-web.service
if systemctl is-enabled --quiet kiosk-display.service 2>/dev/null; then
  systemctl restart kiosk-display.service
fi

IP="$(hostname -I | awk '{print $1}')"
log ""
log "Update complete. Database and settings preserved."
log "Backup saved at: ${BACKUP_DIR}"
log ""
log "  Admin:  http://${IP}:3000/admin"
log "  Kiosk:  http://${IP}:3000/kiosk"
log ""
