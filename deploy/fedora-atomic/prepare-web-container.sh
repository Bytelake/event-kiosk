#!/usr/bin/env bash
# Ensure host data paths exist and pull (or build) the web container image.
set -euo pipefail

WEB_IMAGE="${1:?image required}"
REPO_ROOT="${2:-}"
DATA_DIR="${KIOSK_DATA_DIR:-/var/lib/kiosk}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../common/kiosk-paths.sh
source "${SCRIPT_DIR}/../common/kiosk-paths.sh"

log() { echo "[web-container] $*"; }
die() { echo "[web-container] ERROR: $*" >&2; exit 1; }

mkdir -p "${DATA_DIR}" "$(kiosk_uploads_dir)"

# Podman cannot bind-mount a file that does not exist yet.
if [[ ! -f "$(kiosk_db_file)" ]]; then
  log "Creating database file at $(kiosk_db_file) (required before Podman can start)..."
  touch "$(kiosk_db_file)"
  chown kiosk:kiosk "$(kiosk_db_file)"
  chmod 640 "$(kiosk_db_file)"
fi

if [[ ! -f "$(kiosk_env_file)" ]]; then
  die "Missing $(kiosk_env_file). Run setup-db or create .env first."
fi

normalize_env_file_quotes "$(kiosk_env_file)"

chown -R kiosk:kiosk "${DATA_DIR}"
chmod 750 "${DATA_DIR}"
chmod 640 "$(kiosk_env_file)"

bash "${SCRIPT_DIR}/selinux-contexts.sh" "/opt/kiosk" "${DATA_DIR}"

log "Pulling ${WEB_IMAGE}..."
if podman pull "${WEB_IMAGE}"; then
  log "Image ready."
  exit 0
fi

[[ -n "${REPO_ROOT}" && -f "${REPO_ROOT}/deploy/containers/Containerfile.web" ]] \
  || die "Pull failed and no Containerfile at ${REPO_ROOT}/deploy/containers/Containerfile.web"

log "Registry pull failed; building ${WEB_IMAGE} locally (may take several minutes)..."
podman build -t "${WEB_IMAGE}" \
  -f "${REPO_ROOT}/deploy/containers/Containerfile.web" \
  "${REPO_ROOT}"
log "Local image build complete."
