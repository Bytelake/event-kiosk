#!/usr/bin/env bash
# Put the kiosk monitor to sleep (or wake it) while the PC stays on.
# Prefers DRM DPMS so HDMI signal actually stops without disabling the compositor.
set -euo pipefail

KIOSK_ROOT="${KIOSK_ROOT:-/opt/kiosk}"
UDEV_RULE="/etc/udev/rules.d/99-kiosk-display-power.rules"
ROTATION_SCRIPT="${KIOSK_ROOT}/bin/set-display-rotation.sh"

log() { echo "[display-power] $*"; }
warn() { echo "[display-power] WARNING: $*" >&2; }

discover_wayland() {
  local uid dir sock
  uid="$(id -u)"

  if [[ -z "${XDG_RUNTIME_DIR:-}" ]]; then
    if [[ -d "/run/user/${uid}" && -w "/run/user/${uid}" ]]; then
      export XDG_RUNTIME_DIR="/run/user/${uid}"
    elif [[ -d "/run/kiosk-wayland" ]]; then
      export XDG_RUNTIME_DIR="/run/kiosk-wayland"
    fi
  fi

  if [[ -n "${WAYLAND_DISPLAY:-}" ]]; then
    return 0
  fi

  for dir in ${XDG_RUNTIME_DIR:+"${XDG_RUNTIME_DIR}"} "/run/user/${uid}" "/run/kiosk-wayland"; do
    [[ -d "${dir}" ]] || continue
    for sock in "${dir}"/wayland-*; do
      [[ -S "${sock}" ]] || continue
      [[ "${sock}" == *.lock ]] && continue
      export XDG_RUNTIME_DIR="${dir}"
      export WAYLAND_DISPLAY
      WAYLAND_DISPLAY="$(basename "${sock}")"
      return 0
    done
  done
  return 1
}

drm_connectors() {
  local conn
  shopt -s nullglob
  for conn in /sys/class/drm/card*-*; do
    [[ -e "${conn}/dpms" ]] || continue
    printf '%s\n' "${conn}"
  done
}

chmod_drm_dpms() {
  local conn
  while IFS= read -r conn; do
    [[ -n "${conn}" ]] || continue
    chgrp video "${conn}/dpms" 2>/dev/null || true
    chmod g+w "${conn}/dpms" 2>/dev/null || true
  done < <(drm_connectors)
}

configure_system() {
  mkdir -p "$(dirname "${UDEV_RULE}")"
  cat > "${UDEV_RULE}" <<'EOF'
# Event Kiosk — allow the video group (kiosk user) to sleep HDMI via DRM DPMS.
ACTION=="add", SUBSYSTEM=="drm", KERNEL=="card*-*", TEST=="dpms", RUN+="/bin/sh -c 'chgrp video /sys/class/drm/%k/dpms 2>/dev/null; chmod g+w /sys/class/drm/%k/dpms 2>/dev/null'"
EOF
  log "Wrote ${UDEV_RULE}"
  if command -v udevadm >/dev/null 2>&1; then
    udevadm control --reload-rules 2>/dev/null || true
    udevadm trigger --subsystem-match=drm 2>/dev/null || true
  fi
  chmod_drm_dpms
}

read_dpms() {
  tr -d '[:space:]' < "$1" 2>/dev/null || true
}

drm_status() {
  local conn state
  local saw=0
  local on=0
  while IFS= read -r conn; do
    [[ -n "${conn}" ]] || continue
    state="$(read_dpms "${conn}/dpms")"
    [[ -n "${state}" ]] || continue
    saw=1
    case "${state}" in
      On | on) on=1 ;;
    esac
  done < <(drm_connectors)
  if [[ "${saw}" -eq 0 ]]; then
    return 2
  fi
  [[ "${on}" -eq 1 ]]
}

set_drm() {
  local want="$1"
  local value conn wrote=0
  if [[ "${want}" == "on" ]]; then
    value="On"
  else
    value="Off"
  fi
  chmod_drm_dpms
  while IFS= read -r conn; do
    [[ -n "${conn}" ]] || continue
    if [[ -w "${conn}/dpms" ]] && printf '%s\n' "${value}" > "${conn}/dpms" 2>/dev/null; then
      log "DRM $(basename "${conn}") dpms=${value}"
      wrote=1
    fi
  done < <(drm_connectors)
  [[ "${wrote}" -eq 1 ]]
}

list_wayland_outputs() {
  wlr-randr 2>/dev/null | awk '/^[A-Za-z0-9-]+ / {print $1}'
}

set_wlopm() {
  local want="$1"
  command -v wlopm >/dev/null 2>&1 || return 1
  discover_wayland || return 1
  if [[ "${want}" == "on" ]]; then
    wlopm --on '*' >/dev/null
  else
    wlopm --off '*' >/dev/null
  fi
  log "wlopm ${want}"
}

wayland_output_enabled() {
  wlr-randr 2>/dev/null | awk '
    /^[A-Za-z0-9-]+ / { output=$1 }
    /Enabled:/ {
      if ($2 == "yes") found=1
    }
    END { exit found ? 0 : 1 }
  '
}

set_wlr_randr() {
  local want="$1"
  local output
  command -v wlr-randr >/dev/null 2>&1 || return 1
  discover_wayland || return 1
  local -a outputs=()
  mapfile -t outputs < <(list_wayland_outputs)
  ((${#outputs[@]} > 0)) || return 1
  for output in "${outputs[@]}"; do
    if [[ "${want}" == "on" ]]; then
      wlr-randr --output "${output}" --on
    else
      wlr-randr --output "${output}" --off
    fi
    log "wlr-randr ${output} ${want}"
  done
  if [[ "${want}" == "on" && -x "${ROTATION_SCRIPT}" ]]; then
    "${ROTATION_SCRIPT}" --apply-wayland || true
  fi
}

set_xset() {
  local want="$1"
  command -v xset >/dev/null 2>&1 || return 1
  export DISPLAY="${DISPLAY:-:0}"
  xset +dpms >/dev/null 2>&1 || true
  if [[ "${want}" == "on" ]]; then
    xset dpms force on
  else
    xset dpms force off
  fi
  log "xset dpms force ${want}"
}

list_x11_outputs() {
  xrandr --query 2>/dev/null | awk '/ connected/{print $1}'
}

set_xrandr() {
  local want="$1"
  local output
  command -v xrandr >/dev/null 2>&1 || return 1
  export DISPLAY="${DISPLAY:-:0}"
  local -a outputs=()
  mapfile -t outputs < <(list_x11_outputs)
  ((${#outputs[@]} > 0)) || return 1
  for output in "${outputs[@]}"; do
    if [[ "${want}" == "on" ]]; then
      xrandr --output "${output}" --auto
    else
      xrandr --output "${output}" --off
    fi
    log "xrandr ${output} ${want}"
  done
  if [[ "${want}" == "on" && -x "${ROTATION_SCRIPT}" ]]; then
    "${ROTATION_SCRIPT}" --apply-x11 || true
  fi
}

set_vcgencmd() {
  local want="$1"
  command -v vcgencmd >/dev/null 2>&1 || return 1
  if [[ "${want}" == "on" ]]; then
    vcgencmd display_power 1 >/dev/null
  else
    vcgencmd display_power 0 >/dev/null
  fi
  log "vcgencmd display_power ${want}"
}

xset_is_on() {
  command -v xset >/dev/null 2>&1 || return 2
  export DISPLAY="${DISPLAY:-:0}"
  local info
  info="$(xset q 2>/dev/null || true)"
  [[ -n "${info}" ]] || return 2
  echo "${info}" | grep -q "Monitor is On"
}

vcgencmd_is_on() {
  command -v vcgencmd >/dev/null 2>&1 || return 2
  local out
  out="$(vcgencmd display_power 2>/dev/null || true)"
  [[ -n "${out}" ]] || return 2
  echo "${out}" | grep -q '=1'
}

apply() {
  local want="$1"
  if set_drm "${want}"; then
    echo "method=drm"
    return 0
  fi
  if set_wlopm "${want}"; then
    echo "method=wlopm"
    return 0
  fi
  if set_xset "${want}"; then
    echo "method=xset"
    return 0
  fi
  if set_vcgencmd "${want}"; then
    echo "method=vcgencmd"
    return 0
  fi
  if set_wlr_randr "${want}"; then
    echo "method=wlr-randr"
    return 0
  fi
  if set_xrandr "${want}"; then
    echo "method=xrandr"
    return 0
  fi
  warn "No display power method succeeded (need DRM dpms write access, wlopm, xset, vcgencmd, wlr-randr, or xrandr)."
  return 1
}

print_status() {
  if drm_status; then
    echo "on"
    echo "method=drm"
    return 0
  fi
  local drm_rc=$?
  if [[ "${drm_rc}" -eq 1 ]]; then
    echo "off"
    echo "method=drm"
    return 0
  fi

  if discover_wayland && command -v wlr-randr >/dev/null 2>&1; then
    if wayland_output_enabled; then
      echo "on"
    else
      echo "off"
    fi
    echo "method=wlr-randr"
    return 0
  fi

  if xset_is_on; then
    echo "on"
    echo "method=xset"
    return 0
  fi
  local xset_rc=$?
  if [[ "${xset_rc}" -eq 1 ]]; then
    echo "off"
    echo "method=xset"
    return 0
  fi

  if vcgencmd_is_on; then
    echo "on"
    echo "method=vcgencmd"
    return 0
  fi
  local vc_rc=$?
  if [[ "${vc_rc}" -eq 1 ]]; then
    echo "off"
    echo "method=vcgencmd"
    return 0
  fi

  echo "unknown"
  echo "method=none"
  return 0
}

usage() {
  cat <<EOF
Usage: $(basename "$0") on | off | status | --configure-system

  on                  Wake HDMI/DP outputs (monitor on)
  off                 Sleep HDMI/DP outputs (monitor can power down)
  status              Print on|off|unknown
  --configure-system  udev rule so the kiosk user can write DRM DPMS (run as root)
EOF
}

main() {
  case "${1:-}" in
    on | off)
      apply "$1"
      ;;
    status)
      print_status
      ;;
    --configure-system)
      configure_system
      ;;
    -h | --help)
      usage
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
