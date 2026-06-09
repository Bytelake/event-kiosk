#!/usr/bin/env bash
# Backward-compatible alias for build-debian-package.sh (arm64 on Pi hosts).
exec "$(dirname "$0")/build-debian-package.sh" "$@"
