#!/usr/bin/env bash
# Deprecated: use deploy/debian/install.sh
exec "$(dirname "$0")/../debian/install.sh" "$@"
