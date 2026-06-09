#!/usr/bin/env bash
# Apply SELinux contexts for kiosk paths on Fedora Atomic.
set -euo pipefail

INSTALL_DIR="${1:-/opt/kiosk}"
DATA_DIR="${2:-/var/lib/kiosk}"

log() { echo "[selinux] $*"; }

if ! command -v getenforce >/dev/null 2>&1; then
  log "SELinux tools not available; skipping."
  exit 0
fi

if [[ "$(getenforce 2>/dev/null)" == "Disabled" ]]; then
  log "SELinux disabled; skipping."
  exit 0
fi

mkdir -p "${INSTALL_DIR}" "${DATA_DIR}" "${DATA_DIR}/uploads"

if command -v semanage >/dev/null 2>&1; then
  semanage fcontext -a -t container_file_t "${DATA_DIR}(/.*)?" 2>/dev/null \
    || semanage fcontext -m -t container_file_t "${DATA_DIR}(/.*)?" 2>/dev/null || true
  semanage fcontext -a -t bin_t "${INSTALL_DIR}/bin(/.*)?" 2>/dev/null \
    || semanage fcontext -m -t bin_t "${INSTALL_DIR}/bin(/.*)?" 2>/dev/null || true
fi

if command -v restorecon >/dev/null 2>&1; then
  restorecon -RF "${DATA_DIR}" "${INSTALL_DIR}" 2>/dev/null || true
fi

log "SELinux contexts applied for ${DATA_DIR} and ${INSTALL_DIR}"
