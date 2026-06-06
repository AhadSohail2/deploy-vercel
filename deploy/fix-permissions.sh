#!/bin/bash
# Fix root-owned files after running setup/restart with sudo.
# Usage: bash deploy/fix-permissions.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
APP_USER="${SUDO_USER:-$(whoami)}"

echo "==> Fixing ownership of ${APP_DIR} → ${APP_USER}"
sudo chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"

echo "==> Removing broken .next build (will rebuild next)"
rm -rf "${APP_DIR}/frontend-nextjs/.next"

echo "Done. Now run: bash deploy/restart.sh --rebuild"
