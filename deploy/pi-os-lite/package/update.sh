#!/usr/bin/env bash
# Deprecated: use deploy/debian/package/update.sh
exec "$(dirname "$0")/../../debian/package/update.sh" "$@"
