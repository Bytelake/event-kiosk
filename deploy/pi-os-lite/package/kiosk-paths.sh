#!/usr/bin/env bash
# Shared paths for Pi package install/update scripts.
#
# Application code lives in KIOSK_INSTALL_DIR (/opt/kiosk).
# All persistent data lives in KIOSK_DATA_DIR (/var/lib/kiosk) and is never
# touched by rsync during updates.

KIOSK_INSTALL_DIR="${KIOSK_INSTALL_DIR:-/opt/kiosk}"
KIOSK_DATA_DIR="${KIOSK_DATA_DIR:-/var/lib/kiosk}"

kiosk_env_file() { echo "${KIOSK_DATA_DIR}/.env"; }
kiosk_db_file() { echo "${KIOSK_DATA_DIR}/kiosk.db"; }
kiosk_uploads_dir() { echo "${KIOSK_DATA_DIR}/uploads"; }
kiosk_display_env() { echo "${KIOSK_DATA_DIR}/display.env"; }

ensure_data_dir() {
  mkdir -p "${KIOSK_DATA_DIR}" "$(kiosk_uploads_dir)"
  chown -R kiosk:kiosk "${KIOSK_DATA_DIR}"
  chmod 750 "${KIOSK_DATA_DIR}"
}

write_env_if_missing() {
  local template="${1:-}"
  local env_file
  env_file="$(kiosk_env_file)"

  [[ -f "${env_file}" ]] && return 0

  if [[ -n "${template}" && -f "${template}" ]]; then
    cp "${template}" "${env_file}"
  else
    cat >"${env_file}" <<EOF
DATABASE_URL="file:$(kiosk_db_file)"
UPLOADS_DIR="$(kiosk_uploads_dir)"
ADMIN_PASSWORD="changeme"
SESSION_SECRET="change-this-to-a-long-random-string"
COOKIE_SECURE="false"
BREEZE_SUBDOMAIN=""
BREEZE_API_KEY=""
EOF
  fi

  # Always use absolute paths for production data.
  if grep -q '^DATABASE_URL=' "${env_file}"; then
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"file:$(kiosk_db_file)\"|" "${env_file}"
  else
    echo "DATABASE_URL=\"file:$(kiosk_db_file)\"" >>"${env_file}"
  fi

  if grep -q '^UPLOADS_DIR=' "${env_file}"; then
    sed -i "s|^UPLOADS_DIR=.*|UPLOADS_DIR=\"$(kiosk_uploads_dir)\"|" "${env_file}"
  else
    echo "UPLOADS_DIR=\"$(kiosk_uploads_dir)\"" >>"${env_file}"
  fi

  chown kiosk:kiosk "${env_file}"
  chmod 640 "${env_file}"
  echo "[data] Created ${env_file}"
}

write_display_env_if_missing() {
  local template="$1"
  local display_env
  display_env="$(kiosk_display_env)"

  [[ -f "${display_env}" ]] && return 0

  if [[ -f "${template}" ]]; then
    cp "${template}" "${display_env}"
  else
    echo 'KIOSK_DISPLAY_ROTATION="normal"' >"${display_env}"
  fi

  chown kiosk:kiosk "${display_env}"
  chmod 644 "${display_env}"
  echo "[data] Created ${display_env}"
}

has_existing_install() {
  [[ -d "${KIOSK_INSTALL_DIR}/web" ]] \
    || [[ -f "$(kiosk_db_file)" ]] \
    || [[ -f "$(kiosk_env_file)" ]]
}
