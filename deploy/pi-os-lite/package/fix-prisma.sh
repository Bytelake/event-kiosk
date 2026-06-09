#!/usr/bin/env bash
set -euo pipefail
INSTALL_DIR="${1:-/opt/kiosk}"
exec bash "${INSTALL_DIR}/setup-db.sh" "${INSTALL_DIR}"
