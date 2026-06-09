#!/usr/bin/env bash
# Deprecated: use deploy/debian/package/uninstall.sh
exec "$(dirname "$0")/../../debian/package/uninstall.sh" "$@"
