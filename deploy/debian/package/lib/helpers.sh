#!/usr/bin/env bash
# Shared helpers for Debian/Ubuntu kiosk installation.
set -euo pipefail

DEBIAN_APT_PACKAGES=(
  curl ca-certificates gnupg rsync
  cage seatd libseat1 kbd wlr-randr
  libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6
  libatk1.0-0 libatk-bridge2.0-0 libdrm2 libgbm1 libasound2
  libx11-xcb1 libxcomposite1 libxdamage1 libxrandr2
  libpango-1.0-0 libpangocairo-1.0-0 libcairo2 libgdk-pixbuf-2.0-0
  fonts-liberation xdg-utils
)

DEBIAN_APT_PACKAGES_SOURCE=(
  git build-essential
)

debian_check_os() {
  if [[ ! -f /etc/os-release ]]; then
    echo "[debian] ERROR: /etc/os-release not found" >&2
    return 1
  fi
  # shellcheck disable=SC1091
  source /etc/os-release
  case "${ID}" in
    debian | ubuntu | raspbian) return 0 ;;
  esac
  case " ${ID_LIKE:-} " in
    *" debian "* | *" ubuntu "*) return 0 ;;
  esac
  echo "[debian] ERROR: unsupported OS (ID=${ID}). Use Debian, Ubuntu, or Raspberry Pi OS." >&2
  return 1
}

debian_install_node() {
  if command -v node >/dev/null 2>&1 && [[ "$(node -p "process.versions.node.split('.')[0]")" -ge 20 ]]; then
    echo "[debian] Node $(node -v)"
    return 0
  fi
  echo "[debian] Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
  echo "[debian] Node $(node -v)"
}

debian_install_packages() {
  local from_source="${1:-false}"
  echo "[debian] Installing system packages..."
  apt-get update
  local -a pkgs=("${DEBIAN_APT_PACKAGES[@]}")
  if [[ "${from_source}" == "true" ]]; then
    pkgs+=("${DEBIAN_APT_PACKAGES_SOURCE[@]}")
  fi
  DEBIAN_FRONTEND=noninteractive apt-get install -y "${pkgs[@]}"
}

debian_setup_kiosk_user() {
  if ! id kiosk &>/dev/null; then
    useradd -m -s /bin/bash kiosk
  fi
  usermod -aG video,input kiosk
  for g in render seat tty; do
    getent group "${g}" >/dev/null && usermod -aG "${g}" kiosk || true
  done
  loginctl enable-linger kiosk 2>/dev/null || true
}

debian_install_systemd() {
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
      echo "[debian] X11 display service enabled (kiosk-shell)."
    else
      cp "${install_dir}/systemd/kiosk-display.service" /etc/systemd/system/
      systemctl stop getty@tty1.service 2>/dev/null || true
      systemctl disable getty@tty1.service 2>/dev/null || true
      systemctl enable kiosk-display.service
      systemctl enable seatd.service
      systemctl start seatd.service
      echo "[debian] Wayland display service enabled (kiosk-display + cage)."
    fi
  else
    echo "[debian] Web-only mode — no display service."
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

debian_apply_pi_boot_tweaks() {
  local cmdline=""
  for candidate in /boot/firmware/cmdline.txt /boot/cmdline.txt; do
    if [[ -f "${candidate}" ]]; then
      cmdline="${candidate}"
      break
    fi
  done
  if [[ -n "${cmdline}" ]] && ! grep -q "consoleblank=0" "${cmdline}"; then
    echo "[debian] Adding consoleblank=0 to ${cmdline}"
    sed -i 's/$/ consoleblank=0/' "${cmdline}"
  fi
}

debian_stage_common_files() {
  local repo_root="$1"
  local install_dir="$2"

  mkdir -p "${install_dir}/bin" "${install_dir}/systemd"
  cp "${repo_root}/deploy/common/bin/"*.sh "${install_dir}/bin/"
  cp "${repo_root}/deploy/common/systemd/"*.service "${install_dir}/systemd/"
  cp "${repo_root}/deploy/common/kiosk-paths.sh" "${install_dir}/kiosk-paths.sh"
  cp "${repo_root}/deploy/common/setup-db.sh" "${install_dir}/setup-db.sh"
  cp "${repo_root}/deploy/common/diagnose.sh" "${install_dir}/diagnose.sh"
  cp "${repo_root}/deploy/common/display.env.example" "${install_dir}/display.env.example"
  chmod +x "${install_dir}/bin/"*.sh "${install_dir}/setup-db.sh" "${install_dir}/diagnose.sh"
}
