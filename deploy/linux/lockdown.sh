#!/usr/bin/env bash
# Deprecated: use deploy/debian/install.sh
echo "deploy/linux/lockdown.sh is deprecated."
echo "Run: sudo bash deploy/debian/install.sh"
exec "$(dirname "$0")/../debian/install.sh" "$@"
