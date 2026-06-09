#!/usr/bin/env bash
# Layer required packages on Fedora Atomic via rpm-ostree.
set -euo pipefail

DISPLAY_MODE="${1:-wayland}"
VARIANT="${2:-desktop}"

log() { echo "[layer-packages] $*"; }

if ! command -v rpm-ostree >/dev/null 2>&1; then
  echo "[layer-packages] ERROR: rpm-ostree not found" >&2
  exit 1
fi

# shellcheck disable=SC2086
PACKAGES=(
  nodejs npm
  gtk3 nss alsa-lib libdrm mesa-libgbm
  libXScrnSaver libXtst atk at-spi2-atk
  pango cairo gdk-pixbuf2
  curl
)

if [[ "${DISPLAY_MODE}" == "wayland" ]] || [[ "${VARIANT}" == "iot" ]]; then
  PACKAGES+=(cage seatd wlr-randr)
fi

if [[ "${DISPLAY_MODE}" == "x11" ]] || [[ "${DISPLAY_MODE}" == "session" ]]; then
  PACKAGES+=(libX11 libXcomposite libXdamage libXrandr xorg-x11-server-Xorg xorg-x11-xauth)
fi

MISSING=()
for pkg in "${PACKAGES[@]}"; do
  if ! rpm -q "${pkg}" >/dev/null 2>&1; then
    MISSING+=("${pkg}")
  fi
done

if ((${#MISSING[@]} == 0)); then
  log "All required packages already layered."
  exit 0
fi

log "Layering packages: ${MISSING[*]}"
log "A reboot is required after layering completes."

rpm-ostree install -y "${MISSING[@]}"
echo "REBOOT_REQUIRED=1"
