#!/usr/bin/env bash
#
# In-place upgrade for an existing Event Kiosk install.
# Application files in /opt/kiosk are replaced; data in /var/lib/kiosk is untouched.
#
# Usage (from extracted release tarball):
#   tar -xzf event-kiosk-pi-*.tar.gz
#   cd event-kiosk-pi-*
#   sudo bash update.sh
#
# After a release with schema changes, run:
#   sudo bash /opt/kiosk/setup-db.sh
#
set -euo pipefail

INSTALL_DIR="/opt/kiosk"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=kiosk-paths.sh
source "${SCRIPT_DIR}/kiosk-paths.sh"

log() { echo "[update] $*"; }
die() { echo "[update] ERROR: $*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run as root: sudo bash update.sh"
has_existing_install || die "No existing install found. Run install.sh first."

log "Updating Event Kiosk at ${INSTALL_DIR}..."
log "Data directory ${KIOSK_DATA_DIR} will not be modified."

# Migrate any data still under /opt/kiosk from older installs (one-time).
migrate_to_data_dir "${INSTALL_DIR}"

# ---------------------------------------------------------------------------
# 1. Replace application files only
# ---------------------------------------------------------------------------
log "Installing updated application files..."
rsync -a --delete \
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

chown -R kiosk:kiosk "${INSTALL_DIR}"

# ---------------------------------------------------------------------------
# 2. Regenerate Prisma client (does not touch the database file)
# ---------------------------------------------------------------------------
log "Regenerating Prisma client..."
bash "${INSTALL_DIR}/setup-db.sh" "${INSTALL_DIR}" --generate-only

# ---------------------------------------------------------------------------
# 3. Refresh Electron shell
# ---------------------------------------------------------------------------
log "Checking Electron shell..."
sudo -u kiosk bash -lc "
  set -euo pipefail
  cd '${INSTALL_DIR}/shell'
  npm install --omit=dev
"

chown -R kiosk:kiosk "${INSTALL_DIR}"

# ---------------------------------------------------------------------------
# 4. systemd units (paths may change between releases)
# ---------------------------------------------------------------------------
log "Updating systemd services..."
cp "${INSTALL_DIR}/systemd/kiosk-web.service" /etc/systemd/system/
cp "${INSTALL_DIR}/systemd/kiosk-display.service" /etc/systemd/system/

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
log "Update complete."
log "  Data:   ${KIOSK_DATA_DIR}"
log "  Config: $(kiosk_env_file)"
log ""
log "  Admin:  http://${IP}:3000/admin"
log "  Kiosk:  http://${IP}:3000/kiosk"
log ""
