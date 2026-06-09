#!/usr/bin/env bash
# Deprecated: use deploy/debian/package/install.sh
exec "$(dirname "$0")/../../debian/package/install.sh" "$@"
