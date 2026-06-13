#!/usr/bin/env bash
# Build Debian/Ubuntu release package:
#   npm run package:debian [-- amd64|arm64] [--pre-release[=label]]
#   KIOSK_PRERELEASE=1 npm run package:debian -- amd64
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -p "require('${ROOT}/package.json').version")"
OUT_DIR="${ROOT}/dist"

PRERELEASE=""
ARCH=""
for arg in "$@"; do
  case "${arg}" in
    --pre-release | --prerelease)
      PRERELEASE="prerelease"
      ;;
    --pre-release=* | --prerelease=*)
      PRERELEASE="${arg#*=}"
      ;;
    amd64 | arm64 | x86_64 | aarch64)
      ARCH="${arg}"
      ;;
    *)
      echo "Unknown argument: ${arg}" >&2
      echo "Usage: $0 [amd64|arm64] [--pre-release[=label]]" >&2
      exit 1
      ;;
  esac
done

if [[ -z "${PRERELEASE}" && -n "${KIOSK_PRERELEASE:-}" ]]; then
  case "${KIOSK_PRERELEASE}" in
    1 | true | yes) PRERELEASE="prerelease" ;;
    *) PRERELEASE="${KIOSK_PRERELEASE}" ;;
  esac
fi

ARCH="${ARCH:-$(uname -m)}"
case "${ARCH}" in
  x86_64 | amd64) ARCH_LABEL="amd64" ;;
  aarch64 | arm64) ARCH_LABEL="arm64" ;;
  *) echo "Unsupported arch: ${ARCH}" >&2; exit 1 ;;
esac

VERSION_LABEL="${VERSION}"
if [[ -n "${PRERELEASE}" ]]; then
  if git -C "${ROOT}" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    GIT_SHA="$(git -C "${ROOT}" rev-parse --short HEAD 2>/dev/null || true)"
    if [[ -n "${GIT_SHA}" ]]; then
      PRERELEASE="${PRERELEASE}.${GIT_SHA}"
    fi
  fi
  VERSION_LABEL="${VERSION}-${PRERELEASE}"
fi

PACKAGE_NAME="event-kiosk-debian-${ARCH_LABEL}-${VERSION_LABEL}"
ARCHIVE="${OUT_DIR}/${PACKAGE_NAME}.tar.gz"

log() { echo "[package:debian] $*"; }

if [[ -n "${PRERELEASE}" ]]; then
  log "Pre-release build (version label: ${VERSION_LABEL})"
fi

log "Building web app (standalone)..."
cd "${ROOT}/apps/web"
npm run build

log "Building Electron shell..."
cd "${ROOT}/apps/shell"
npm run build

log "Staging release files (${ARCH_LABEL})..."
PACKAGE_ROOT="${OUT_DIR}/${PACKAGE_NAME}"
rm -rf "${PACKAGE_ROOT}"
mkdir -p "${PACKAGE_ROOT}/web" "${PACKAGE_ROOT}/shell/dist" "${PACKAGE_ROOT}/bin" "${PACKAGE_ROOT}/systemd" "${PACKAGE_ROOT}/lib"

STANDALONE="${ROOT}/apps/web/.next/standalone"
cp -R "${STANDALONE}/." "${PACKAGE_ROOT}/web/"
rm -rf "${PACKAGE_ROOT}/web/node_modules/@prisma" "${PACKAGE_ROOT}/web/node_modules/.prisma" 2>/dev/null || true
mkdir -p "${PACKAGE_ROOT}/web/apps/web/.next"
cp -R "${ROOT}/apps/web/.next/static" "${PACKAGE_ROOT}/web/apps/web/.next/static"
mkdir -p "${PACKAGE_ROOT}/web/prisma"
rsync -a --exclude dev.db --exclude dev.db-journal \
  "${ROOT}/apps/web/prisma/" "${PACKAGE_ROOT}/web/prisma/"
cp "${ROOT}/apps/web/.env.example" "${PACKAGE_ROOT}/web/.env.example"

cp -R "${ROOT}/apps/shell/dist/." "${PACKAGE_ROOT}/shell/dist/"
cp "${ROOT}/apps/shell/package.json" "${PACKAGE_ROOT}/shell/package.json"
cp "${ROOT}/apps/shell/src/registration-chrome.html" "${PACKAGE_ROOT}/shell/dist/registration-chrome.html"
cp "${ROOT}/apps/shell/src/registration-keyboard.html" "${PACKAGE_ROOT}/shell/dist/registration-keyboard.html"

cp "${ROOT}/deploy/common/bin/"*.sh "${PACKAGE_ROOT}/bin/"
cp "${ROOT}/deploy/common/systemd/"*.service "${PACKAGE_ROOT}/systemd/"
cp "${ROOT}/deploy/common/kiosk-paths.sh" "${PACKAGE_ROOT}/kiosk-paths.sh"
cp "${ROOT}/deploy/common/setup-db.sh" "${PACKAGE_ROOT}/setup-db.sh"
cp "${ROOT}/deploy/common/diagnose.sh" "${PACKAGE_ROOT}/diagnose.sh"
cp "${ROOT}/deploy/common/display.env.example" "${PACKAGE_ROOT}/display.env.example"
cp "${ROOT}/deploy/debian/package/lib/helpers.sh" "${PACKAGE_ROOT}/lib/helpers.sh"
cp "${ROOT}/deploy/debian/package/install.sh" "${PACKAGE_ROOT}/install.sh"
cp "${ROOT}/deploy/debian/package/update.sh" "${PACKAGE_ROOT}/update.sh"
cp "${ROOT}/deploy/debian/package/uninstall.sh" "${PACKAGE_ROOT}/uninstall.sh"
cp "${ROOT}/deploy/debian/package/fix-prisma.sh" "${PACKAGE_ROOT}/fix-prisma.sh"
cp "${ROOT}/deploy/debian/package/fix-permissions.sh" "${PACKAGE_ROOT}/fix-permissions.sh"
cp "${ROOT}/deploy/debian/package/README.txt" "${PACKAGE_ROOT}/README.txt"

chmod +x "${PACKAGE_ROOT}/install.sh" "${PACKAGE_ROOT}/update.sh" "${PACKAGE_ROOT}/uninstall.sh"
chmod +x "${PACKAGE_ROOT}/fix-prisma.sh" "${PACKAGE_ROOT}/fix-permissions.sh" "${PACKAGE_ROOT}/setup-db.sh" "${PACKAGE_ROOT}/diagnose.sh"
chmod +x "${PACKAGE_ROOT}/bin/"*.sh

mkdir -p "${OUT_DIR}"
xattr -cr "${PACKAGE_ROOT}" 2>/dev/null || true
tar --no-xattrs -czf "${ARCHIVE}" -C "${OUT_DIR}" "${PACKAGE_NAME}" 2>/dev/null \
  || tar -czf "${ARCHIVE}" -C "${OUT_DIR}" "${PACKAGE_NAME}"

BYTES=$(wc -c < "${ARCHIVE}" | tr -d ' ')
log "Done: ${ARCHIVE} ($(numfmt --to=iec-i --suffix=B "${BYTES}" 2>/dev/null || echo "${BYTES} bytes"))"
log ""
log "Deploy:"
log "  scp ${ARCHIVE} user@<host>:~/"
log "  tar -xzf $(basename "${ARCHIVE}") && cd ${PACKAGE_NAME} && sudo bash install.sh"
