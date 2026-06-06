#!/usr/bin/env bash
# Shared path helpers for Pi package install/update scripts.

# Resolve the SQLite file path from web/.env (relative to WEB_DIR).
resolve_database_file() {
  local web_dir="$1"
  local env_file="${web_dir}/.env"
  local url="file:./prisma/dev.db"

  if [[ -f "${env_file}" ]]; then
    local line
    line="$(grep -E '^[[:space:]]*DATABASE_URL=' "${env_file}" | tail -1 || true)"
    if [[ -n "${line}" ]]; then
      url="${line#DATABASE_URL=}"
      url="${url#"${url%%[![:space:]]*}"}"
      url="${url%"${url##*[![:space:]]}"}"
      url="${url#\"}"
      url="${url%\"}"
      url="${url#\'}"
      url="${url%\'}"
    fi
  fi

  local rel="${url#file:}"
  if [[ "${rel}" == ./* ]]; then
    echo "${web_dir}/${rel#./}"
  else
    echo "${web_dir}/${rel}"
  fi
}

# Move data from a source install (apps/web/) into the package layout (web/).
migrate_legacy_install() {
  local install_dir="$1"
  local legacy_web="${install_dir}/apps/web"
  local new_web="${install_dir}/web"

  [[ -d "${legacy_web}" ]] || return 0

  local legacy_db="${legacy_web}/prisma/dev.db"
  local new_db="${new_web}/prisma/dev.db"
  if [[ -f "${legacy_db}" ]] && { [[ ! -f "${new_db}" ]] || [[ ! -s "${new_db}" ]]; }; then
    mkdir -p "$(dirname "${new_db}")"
    cp -a "${legacy_db}" "${new_db}"
    [[ -f "${legacy_db}-journal" ]] && cp -a "${legacy_db}-journal" "${new_db}-journal" || true
    echo "[migrate] Copied database from legacy apps/web/prisma/dev.db"
  fi

  local legacy_env="${legacy_web}/.env"
  local new_env="${new_web}/.env"
  if [[ -f "${legacy_env}" ]] && [[ ! -f "${new_env}" ]]; then
    cp -a "${legacy_env}" "${new_env}"
    echo "[migrate] Copied .env from legacy apps/web/.env"
  fi

  local legacy_uploads="${legacy_web}/public/uploads"
  local new_uploads="${new_web}/apps/web/public/uploads"
  if [[ -d "${legacy_uploads}" ]] && [[ -n "$(ls -A "${legacy_uploads}" 2>/dev/null || true)" ]]; then
    mkdir -p "${new_uploads}"
    cp -a "${legacy_uploads}/." "${new_uploads}/"
    echo "[migrate] Copied uploads from legacy apps/web/public/uploads"
  fi
}

backup_persistent_file() {
  local install_dir="$1"
  local backup_dir="$2"
  local rel_path="$3"

  local src="${install_dir}/${rel_path}"
  [[ -f "${src}" ]] || return 0

  mkdir -p "${backup_dir}/$(dirname "${rel_path}")"
  cp -a "${src}" "${backup_dir}/${rel_path}"
}

restore_persistent_file_if_missing() {
  local install_dir="$1"
  local backup_dir="$2"
  local rel_path="$3"

  local dest="${install_dir}/${rel_path}"
  local backup="${backup_dir}/${rel_path}"
  [[ -f "${backup}" ]] || return 0
  [[ -f "${dest}" ]] && return 0

  mkdir -p "$(dirname "${dest}")"
  cp -a "${backup}" "${dest}"
  echo "[restore] Restored ${rel_path} from backup"
}
