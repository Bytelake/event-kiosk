#!/usr/bin/env bash
# Shared paths for Pi package install/update scripts.
#
# Application code lives in KIOSK_INSTALL_DIR (/opt/kiosk).
# All persistent data lives in KIOSK_DATA_DIR (/var/lib/kiosk) and is never
# touched by rsync during updates.

KIOSK_INSTALL_DIR="${KIOSK_INSTALL_DIR:-/opt/kiosk}"
KIOSK_DATA_DIR="${KIOSK_DATA_DIR:-/var/lib/kiosk}"
DEFAULT_ADMIN_PASSWORD="changeme"
DEFAULT_SESSION_SECRET="change-this-to-a-long-random-string"

kiosk_env_file() { echo "${KIOSK_DATA_DIR}/.env"; }
kiosk_db_file() { echo "${KIOSK_DATA_DIR}/kiosk.db"; }
kiosk_uploads_dir() { echo "${KIOSK_DATA_DIR}/uploads"; }
kiosk_display_env() { echo "${KIOSK_DATA_DIR}/display.env"; }

ensure_data_dir() {
  mkdir -p "${KIOSK_DATA_DIR}" "$(kiosk_uploads_dir)"
  chown -R kiosk:kiosk "${KIOSK_DATA_DIR}"
  chmod 750 "${KIOSK_DATA_DIR}"
}

# Podman --env-file treats quotes literally; production .env files use bare values.
normalize_env_file_quotes() {
  local env_file="$1"
  [[ -f "${env_file}" ]] || return 0
  sed -i -E \
    -e 's/^([A-Za-z_][A-Za-z0-9_]*)="([^"]*)"$/\1=\2/' \
    -e "s/^([A-Za-z_][A-Za-z0-9_]*)='([^']*)'$/\1=\2/" \
    "${env_file}"
}

env_file_value() {
  local env_file="$1"
  local key="$2"
  [[ -f "${env_file}" ]] || return 0
  grep "^${key}=" "${env_file}" | tail -n1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

set_env_file_value() {
  local env_file="$1"
  local key="$2"
  local value="$3"
  if grep -q "^${key}=" "${env_file}"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "${env_file}"
  else
    echo "${key}=${value}" >>"${env_file}"
  fi
}

generate_session_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
    return 0
  fi
  dd if=/dev/urandom bs=32 count=1 2>/dev/null | od -An -tx1 | tr -d ' \n'
}

# Replace missing/default SESSION_SECRET values. Safe to run on updates.
ensure_session_secret() {
  local env_file
  env_file="$(kiosk_env_file)"
  [[ -f "${env_file}" ]] || return 0

  local current
  current="$(env_file_value "${env_file}" SESSION_SECRET)"
  if [[ -n "${current}" && "${current}" != "${DEFAULT_SESSION_SECRET}" && ${#current} -ge 16 ]]; then
    return 0
  fi

  local secret
  secret="$(generate_session_secret)"
  if [[ -z "${secret}" || ${#secret} -lt 16 ]]; then
    echo "[data] ERROR: could not generate SESSION_SECRET" >&2
    return 1
  fi

  set_env_file_value "${env_file}" SESSION_SECRET "${secret}"
  chown kiosk:kiosk "${env_file}"
  chmod 640 "${env_file}"
  echo "[data] Generated a random SESSION_SECRET in ${env_file}"
}

warn_if_default_admin_password() {
  local env_file
  env_file="$(kiosk_env_file)"
  [[ -f "${env_file}" ]] || return 0

  local current
  current="$(env_file_value "${env_file}" ADMIN_PASSWORD)"
  if [[ "${current}" == "${DEFAULT_ADMIN_PASSWORD}" ]]; then
    echo "[data] WARNING: ADMIN_PASSWORD is still '${DEFAULT_ADMIN_PASSWORD}'."
    echo "[data]          Change it in ${env_file} before exposing admin on the network."
  fi
}

write_env_if_missing() {
  local template="${1:-}"
  local env_file
  env_file="$(kiosk_env_file)"

  if [[ -f "${env_file}" ]]; then
    ensure_session_secret
    return 0
  fi

  if [[ -n "${template}" && -f "${template}" ]]; then
    cp "${template}" "${env_file}"
  else
    cat >"${env_file}" <<EOF
DATABASE_URL=file:$(kiosk_db_file)
UPLOADS_DIR=$(kiosk_uploads_dir)
ADMIN_PASSWORD=${DEFAULT_ADMIN_PASSWORD}
SESSION_SECRET=${DEFAULT_SESSION_SECRET}
COOKIE_SECURE=false
EOF
  fi

  # Always use absolute paths for production data so Prisma cannot create a
  # second SQLite file next to the app (as happened with file:./dev.db locally).
  if grep -q '^DATABASE_URL=' "${env_file}"; then
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=file:$(kiosk_db_file)|" "${env_file}"
  else
    echo "DATABASE_URL=file:$(kiosk_db_file)" >>"${env_file}"
  fi

  if grep -q '^UPLOADS_DIR=' "${env_file}"; then
    sed -i "s|^UPLOADS_DIR=.*|UPLOADS_DIR=$(kiosk_uploads_dir)|" "${env_file}"
  else
    echo "UPLOADS_DIR=$(kiosk_uploads_dir)" >>"${env_file}"
  fi

  normalize_env_file_quotes "${env_file}"
  ensure_session_secret

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

# Bundled Electron lives under the install dir (not system PATH).
kiosk_electron_bin() {
  local root="${1:-${KIOSK_INSTALL_DIR:-/opt/kiosk}}"
  local candidate
  for candidate in \
    "${root}/shell/node_modules/.bin/electron" \
    "${root}/shell/node_modules/electron/dist/electron"; do
    if [[ -x "${candidate}" ]]; then
      echo "${candidate}"
      return 0
    fi
  done
  return 1
}

kiosk_install_electron() {
  local root="${1:-${KIOSK_INSTALL_DIR:-/opt/kiosk}}"
  sudo -u kiosk bash -lc "
    set -euo pipefail
    cd '${root}/shell'
    npm install --omit=dev
  "
}

# sharp ships platform-specific binaries — install on the host like Prisma.
kiosk_install_sharp() {
  local root="${1:-${KIOSK_INSTALL_DIR:-/opt/kiosk}}"
  local web="${root}/web"
  [[ -d "${web}" ]] || return 0

  echo "[sharp] Installing sharp for host architecture..."
  sudo -u kiosk bash -lc "
    set -euo pipefail
    cd '${web}'
    rm -rf node_modules/sharp node_modules/@img 2>/dev/null || true
    npm install sharp@0.33.5 --omit=dev --no-package-lock
    node -e \"require('sharp')(Buffer.from([0xff,0xd8,0xff,0xd9])).metadata().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); })\"
  "
}
