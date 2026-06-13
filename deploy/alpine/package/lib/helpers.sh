#!/usr/bin/env bash
# Shared helpers for Alpine Linux kiosk installation.
set -euo pipefail

ALPINE_APK_BASE=(
  bash curl ca-certificates rsync util-linux shadow
)

ALPINE_APK_DISPLAY=(
  cage seatd libseat wlr-randr kbd
  gtk+3.0 nss libatk-1.0 at-spi2-core libdrm mesa-gbm alsa-lib
  libxcomposite libxdamage libxrandr pango cairo gdk-pixbuf
  font-liberation xdg-utils xwayland electron
)

ALPINE_APK_X11=(
  xorg-server xinit
)

ALPINE_APK_SOURCE=(
  git build-base
)

alpine_check_os() {
  if [[ ! -f /etc/os-release ]]; then
    echo "[alpine] ERROR: /etc/os-release not found" >&2
    return 1
  fi
  # shellcheck disable=SC1091
  source /etc/os-release
  if [[ "${ID}" == "alpine" ]]; then
    return 0
  fi
  echo "[alpine] ERROR: unsupported OS (ID=${ID:-unknown}). Use Alpine Linux." >&2
  return 1
}

alpine_ensure_repos() {
  local repos_file="/etc/apk/repositories"
  local main_line=""
  local changed=false

  [[ -f "${repos_file}" ]] || return 0

  if grep -qE '^#https?://.+/community$' "${repos_file}"; then
    sed -i 's|^#\(https\?://.*/community\)$|\1|' "${repos_file}"
    changed=true
  fi

  main_line="$(grep -E '^https?://.+/main$' "${repos_file}" | head -1 || true)"
  if [[ -z "${main_line}" ]]; then
    echo "[alpine] WARNING: could not detect Alpine mirror line in ${repos_file}" >&2
    return 0
  fi

  if ! grep -qE '^https?://.+/community$' "${repos_file}"; then
    echo "${main_line/main/community}" >>"${repos_file}"
    changed=true
  fi
  if ! grep -qE '/testing$' "${repos_file}"; then
    echo "${main_line/main/testing}" >>"${repos_file}"
    changed=true
  fi

  if [[ "${changed}" == "true" ]]; then
    echo "[alpine] Enabled community and testing repositories"
    apk update || true
  fi

  # Newer Alpine releases (e.g. 3.24) may not publish versioned testing; electron lives in edge/testing.
  if ! apk search -x electron 2>/dev/null | grep -qE '^electron-'; then
    if ! grep -qE 'edge/testing$' "${repos_file}"; then
      echo "http://dl-cdn.alpinelinux.org/alpine/edge/testing" >>"${repos_file}"
      echo "[alpine] Added edge/testing repository (electron not in version testing)"
      apk update || true
    fi
  fi
}

alpine_install_sudo_wrapper() {
  if command -v sudo >/dev/null 2>&1 && sudo -u root id >/dev/null 2>&1; then
    return 0
  fi
  if ! command -v runuser >/dev/null 2>&1; then
    echo "[alpine] ERROR: runuser not found (util-linux package)" >&2
    return 1
  fi
  if [[ -x /usr/bin/sudo ]] && grep -q 'runuser -u' /usr/bin/sudo 2>/dev/null; then
    return 0
  fi
  cat >/usr/bin/sudo <<'SCRIPT'
#!/bin/sh
# Minimal sudo wrapper for install scripts (Alpine has no sudo apk).
if [ "$1" = "-u" ]; then
  user=$2
  shift 2
  exec runuser -u "$user" -- "$@"
fi
exec "$@"
SCRIPT
  chmod 755 /usr/bin/sudo
  echo "[alpine] Installed runuser-based sudo wrapper at /usr/bin/sudo"
}

alpine_install_node() {
  if command -v node >/dev/null 2>&1 && [[ "$(node -p "process.versions.node.split('.')[0]")" -ge 20 ]]; then
    echo "[alpine] Node $(node -v)"
    return 0
  fi
  echo "[alpine] Installing Node.js from apk..."
  apk add nodejs npm
  if ! command -v node >/dev/null 2>&1; then
    echo "[alpine] ERROR: nodejs package did not provide node" >&2
    return 1
  fi
  if [[ "$(node -p "process.versions.node.split('.')[0]")" -lt 20 ]]; then
    echo "[alpine] ERROR: Node $(node -v) is too old; need 20+" >&2
    return 1
  fi
  echo "[alpine] Node $(node -v)"
}

alpine_install_packages() {
  local from_source="${1:-false}"
  local with_display="${2:-true}"
  local display_mode="${3:-wayland}"

  alpine_ensure_repos
  alpine_install_sudo_wrapper
  echo "[alpine] Installing system packages..."
  local -a pkgs=("${ALPINE_APK_BASE[@]}")
  if [[ "${from_source}" == "true" ]]; then
    pkgs+=("${ALPINE_APK_SOURCE[@]}")
  fi
  if [[ "${with_display}" == "true" ]]; then
    pkgs+=("${ALPINE_APK_DISPLAY[@]}")
    if [[ "${display_mode}" == "x11" ]]; then
      pkgs+=("${ALPINE_APK_X11[@]}")
    fi
  fi
  apk add "${pkgs[@]}"
}

alpine_setup_kiosk_user() {
  if ! id kiosk &>/dev/null; then
    adduser -D -h /home/kiosk -s /bin/bash kiosk
  fi
  for g in video input render seat tty; do
    getent group "${g}" >/dev/null && addgroup kiosk "${g}" 2>/dev/null || true
  done
  if alpine_detect_init 2>/dev/null | grep -q systemd; then
    loginctl enable-linger kiosk 2>/dev/null || true
  fi
}

alpine_detect_init() {
  if [[ -d /run/systemd/system ]] && command -v systemctl >/dev/null 2>&1; then
    echo systemd
  elif command -v rc-service >/dev/null 2>&1; then
    echo openrc
  else
    echo "[alpine] ERROR: need systemd or OpenRC" >&2
    return 1
  fi
}

alpine_primary_ip() {
  ip -4 route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}' \
    || hostname -i 2>/dev/null | awk '{print $1}' \
    || echo "localhost"
}

alpine_install_shell_npm() {
  local install_dir="$1"
  sudo -u kiosk bash -lc "
    set -euo pipefail
    export ELECTRON_SKIP_BINARY_DOWNLOAD=1
    cd '${install_dir}/shell'
    npm install --omit=dev --ignore-scripts
  "
}

alpine_disable_tty1_login() {
  local inittab="/etc/inittab"
  if [[ -f "${inittab}" ]] && grep -qE '^tty1:' "${inittab}"; then
    sed -i 's/^tty1:/# kiosk-disabled tty1:/' "${inittab}"
    kill -HUP 1 2>/dev/null || true
    echo "[alpine] Disabled getty on tty1 in ${inittab}"
  fi
}

alpine_restore_tty1_login() {
  local inittab="/etc/inittab"
  if [[ -f "${inittab}" ]]; then
    sed -i 's/^# kiosk-disabled tty1:/tty1:/' "${inittab}"
    kill -HUP 1 2>/dev/null || true
  fi
}

alpine_install_systemd() {
  local display_mode="$1"
  local with_display="$2"
  local install_dir="${3:-/opt/kiosk}"

  cp "${install_dir}/systemd/kiosk-web.service" /etc/systemd/system/
  systemctl disable kiosk-shell.service 2>/dev/null || true
  systemctl stop kiosk-shell.service 2>/dev/null || true
  systemctl disable kiosk-display.service 2>/dev/null || true
  systemctl stop kiosk-display.service 2>/dev/null || true

  if [[ "${with_display}" == "true" ]]; then
    if [[ "${display_mode}" == "x11" ]]; then
      cp "${install_dir}/systemd/kiosk-shell.service" /etc/systemd/system/
      systemctl enable kiosk-shell.service
      echo "[alpine] X11 display service enabled (kiosk-shell)."
    else
      cp "${install_dir}/systemd/kiosk-display.service" /etc/systemd/system/
      systemctl stop getty@tty1.service 2>/dev/null || true
      systemctl disable getty@tty1.service 2>/dev/null || true
      systemctl enable kiosk-display.service
      systemctl enable seatd.service 2>/dev/null || true
      systemctl start seatd.service 2>/dev/null || true
      echo "[alpine] Wayland display service enabled (kiosk-display + cage)."
    fi
  else
    echo "[alpine] Web-only mode — no display service."
  fi

  systemctl daemon-reload
  systemctl enable kiosk-web.service
  systemctl restart kiosk-web.service
  if [[ "${with_display}" == "true" ]]; then
    if [[ "${display_mode}" == "x11" ]]; then
      systemctl restart kiosk-shell.service || true
    else
      systemctl restart kiosk-display.service || true
    fi
  fi
}

alpine_install_openrc() {
  local display_mode="$1"
  local with_display="$2"
  local install_dir="${3:-/opt/kiosk}"

  install -m 755 "${install_dir}/openrc/kiosk-web" /etc/init.d/kiosk-web
  rc-update del kiosk-shell 2>/dev/null || true
  rc-service kiosk-shell stop 2>/dev/null || true
  rc-update del kiosk-display 2>/dev/null || true
  rc-service kiosk-display stop 2>/dev/null || true

  rc-update add seatd default 2>/dev/null || true
  rc-service seatd start 2>/dev/null || true

  if [[ "${with_display}" == "true" ]]; then
    if [[ "${display_mode}" == "x11" ]]; then
      install -m 755 "${install_dir}/openrc/kiosk-shell" /etc/init.d/kiosk-shell
      rc-update add kiosk-shell default
      echo "[alpine] X11 display service enabled (kiosk-shell)."
    else
      install -m 755 "${install_dir}/openrc/kiosk-display" /etc/init.d/kiosk-display
      alpine_disable_tty1_login
      rc-update add kiosk-display default
      echo "[alpine] Wayland display service enabled (kiosk-display + cage)."
    fi
  else
    echo "[alpine] Web-only mode — no display service."
  fi

  rc-update add kiosk-web default
  rc-service kiosk-web restart 2>/dev/null || rc-service kiosk-web start
  if [[ "${with_display}" == "true" ]]; then
    if [[ "${display_mode}" == "x11" ]]; then
      rc-service kiosk-shell restart 2>/dev/null || rc-service kiosk-shell start
    else
      rc-service kiosk-display restart 2>/dev/null || rc-service kiosk-display start
    fi
  fi
}

alpine_install_services() {
  local display_mode="$1"
  local with_display="$2"
  local install_dir="${3:-/opt/kiosk}"
  local init
  init="$(alpine_detect_init)"

  case "${init}" in
    systemd)
      alpine_install_systemd "${display_mode}" "${with_display}" "${install_dir}"
      ;;
    openrc)
      alpine_install_openrc "${display_mode}" "${with_display}" "${install_dir}"
      ;;
  esac
}

alpine_refresh_services() {
  local install_dir="${1:-/opt/kiosk}"
  local init
  init="$(alpine_detect_init)"

  case "${init}" in
    systemd)
      cp "${install_dir}/systemd/kiosk-web.service" /etc/systemd/system/
      if systemctl is-enabled --quiet kiosk-display.service 2>/dev/null; then
        cp "${install_dir}/systemd/kiosk-display.service" /etc/systemd/system/
      elif systemctl is-enabled --quiet kiosk-shell.service 2>/dev/null; then
        cp "${install_dir}/systemd/kiosk-shell.service" /etc/systemd/system/
      fi
      systemctl daemon-reload
      systemctl restart kiosk-web.service
      if systemctl is-enabled --quiet kiosk-display.service 2>/dev/null; then
        systemctl restart kiosk-display.service
      elif systemctl is-enabled --quiet kiosk-shell.service 2>/dev/null; then
        systemctl restart kiosk-shell.service
      fi
      ;;
    openrc)
      install -m 755 "${install_dir}/openrc/kiosk-web" /etc/init.d/kiosk-web
      if rc-update show -v 2>/dev/null | grep -q 'kiosk-display |.*default'; then
        install -m 755 "${install_dir}/openrc/kiosk-display" /etc/init.d/kiosk-display
      elif rc-update show -v 2>/dev/null | grep -q 'kiosk-shell |.*default'; then
        install -m 755 "${install_dir}/openrc/kiosk-shell" /etc/init.d/kiosk-shell
      fi
      rc-service kiosk-web restart 2>/dev/null || rc-service kiosk-web start
      if rc-update show -v 2>/dev/null | grep -q 'kiosk-display |.*default'; then
        rc-service kiosk-display restart 2>/dev/null || true
      elif rc-update show -v 2>/dev/null | grep -q 'kiosk-shell |.*default'; then
        rc-service kiosk-shell restart 2>/dev/null || true
      fi
      ;;
  esac
}

alpine_stop_services() {
  local init
  init="$(alpine_detect_init 2>/dev/null || echo unknown)"

  case "${init}" in
    systemd)
      systemctl stop kiosk-display.service 2>/dev/null || true
      systemctl stop kiosk-shell.service 2>/dev/null || true
      systemctl stop kiosk-web.service 2>/dev/null || true
      systemctl disable kiosk-display.service 2>/dev/null || true
      systemctl disable kiosk-shell.service 2>/dev/null || true
      systemctl disable kiosk-web.service 2>/dev/null || true
      systemctl enable getty@tty1.service 2>/dev/null || true
      systemctl start getty@tty1.service 2>/dev/null || true
      rm -f /etc/systemd/system/kiosk-web.service
      rm -f /etc/systemd/system/kiosk-display.service
      rm -f /etc/systemd/system/kiosk-shell.service
      systemctl daemon-reload
      ;;
    openrc)
      rc-service kiosk-display stop 2>/dev/null || true
      rc-service kiosk-shell stop 2>/dev/null || true
      rc-service kiosk-web stop 2>/dev/null || true
      rc-update del kiosk-display 2>/dev/null || true
      rc-update del kiosk-shell 2>/dev/null || true
      rc-update del kiosk-web 2>/dev/null || true
      alpine_restore_tty1_login
      rm -f /etc/init.d/kiosk-web /etc/init.d/kiosk-display /etc/init.d/kiosk-shell
      ;;
  esac
}

alpine_service_restart_hint() {
  local init
  init="$(alpine_detect_init 2>/dev/null || echo systemd)"
  case "${init}" in
    openrc) echo "sudo rc-service kiosk-web restart" ;;
    *) echo "sudo systemctl restart kiosk-web" ;;
  esac
}

alpine_stage_common_files() {
  local repo_root="$1"
  local install_dir="$2"

  mkdir -p "${install_dir}/bin" "${install_dir}/systemd" "${install_dir}/openrc"
  cp "${repo_root}/deploy/common/bin/"*.sh "${install_dir}/bin/"
  cp "${repo_root}/deploy/common/systemd/"*.service "${install_dir}/systemd/"
  cp "${repo_root}/deploy/common/openrc/"* "${install_dir}/openrc/"
  cp "${repo_root}/deploy/common/kiosk-paths.sh" "${install_dir}/kiosk-paths.sh"
  cp "${repo_root}/deploy/common/setup-db.sh" "${install_dir}/setup-db.sh"
  cp "${repo_root}/deploy/common/diagnose.sh" "${install_dir}/diagnose.sh"
  cp "${repo_root}/deploy/common/display.env.example" "${install_dir}/display.env.example"
  chmod +x "${install_dir}/bin/"*.sh "${install_dir}/setup-db.sh" "${install_dir}/diagnose.sh"
  chmod +x "${install_dir}/openrc/"*
}
