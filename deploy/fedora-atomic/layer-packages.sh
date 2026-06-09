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

# Fedora ships npm as nodejs-npm (pulled in by nodejs). Requesting a bare "npm"
# RPM leaves rpm -q npm failing forever and traps the installer in reboot loops.
LAYER_RPMS=(
  nodejs
  gtk3 nss alsa-lib libdrm mesa-libgbm
  libXScrnSaver libXtst atk at-spi2-atk
  pango cairo gdk-pixbuf2
  curl
)

if [[ "${DISPLAY_MODE}" == "wayland" ]] || [[ "${VARIANT}" == "iot" ]]; then
  LAYER_RPMS+=(cage seatd wlr-randr)
fi

if [[ "${DISPLAY_MODE}" == "x11" ]] || [[ "${DISPLAY_MODE}" == "session" ]]; then
  LAYER_RPMS+=(libX11 libXcomposite libXdamage libXrandr xorg-x11-server-Xorg xorg-x11-xauth)
fi

# Return 0 when the requirement is already satisfied on the booted deployment.
requirement_satisfied() {
  local pkg="$1"
  case "${pkg}" in
    nodejs)
      command -v node >/dev/null 2>&1 && return 0
      rpm -q nodejs >/dev/null 2>&1 && return 0
      ;;
    *)
      rpm -q "${pkg}" >/dev/null 2>&1 && return 0
      ;;
  esac
  return 1
}

runtime_satisfied() {
  command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1
}

MISSING=()
for pkg in "${LAYER_RPMS[@]}"; do
  if ! requirement_satisfied "${pkg}"; then
    MISSING+=("${pkg}")
  fi
done

if runtime_satisfied; then
  log "Node.js runtime present: $(node --version), npm $(npm --version)"
elif ((${#MISSING[@]} > 0)) && printf '%s\n' "${MISSING[@]}" | grep -qx nodejs; then
  log "nodejs RPM will be layered (includes nodejs-npm)."
fi

if ((${#MISSING[@]} == 0)); then
  if ! runtime_satisfied; then
    log "RPM dependencies are layered but node/npm binaries are missing."
    log "Reboot if rpm-ostree status shows a staged deployment, then re-run install."
    echo "REBOOT_REQUIRED=1"
    exit 0
  fi
  log "All required packages already layered."
  exit 0
fi

log "Packages still needed on booted deployment: ${MISSING[*]}"

# A prior install may have layered packages that are not active until reboot.
if rpm-ostree status 2>/dev/null | grep -qE '(staged|Pending)'; then
  log "rpm-ostree has a staged deployment waiting for reboot."
  log "Run: sudo systemctl reboot"
  log "Then re-run: sudo bash deploy/fedora-atomic/install.sh"
  echo "REBOOT_REQUIRED=1"
  exit 0
fi

log "Layering packages: ${MISSING[*]}"
log "A reboot is required after layering completes."

if ! LAYER_OUT="$(rpm-ostree install -y "${MISSING[@]}" 2>&1)"; then
  if echo "${LAYER_OUT}" | grep -qiE 'already requested'; then
    log "Packages are already layered but pending reboot."
    echo "REBOOT_REQUIRED=1"
    exit 0
  fi
  echo "${LAYER_OUT}" >&2
  exit 1
fi

if echo "${LAYER_OUT}" | grep -qiE 'No changes|already (present|installed)|already requested'; then
  log "rpm-ostree reported no new changes."
  if runtime_satisfied || requirement_satisfied nodejs; then
    log "Required tools are available; continuing without reboot."
    exit 0
  fi
  log "Reboot to activate staged packages, then re-run install."
  echo "REBOOT_REQUIRED=1"
  exit 0
fi

echo "REBOOT_REQUIRED=1"
