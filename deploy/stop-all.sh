#!/bin/bash
# Stop all app processes and free ports 3000, 8000, 9000, 9002.
# Usage: bash deploy/stop-all.sh

set -euo pipefail

PORTS=(3000 8000 9000 9002)

echo "==> Stopping PM2 for user: $(whoami)"
pm2 delete all 2>/dev/null || true
pm2 kill 2>/dev/null || true

echo "==> Stopping root PM2 (from old sudo setup — common cause of EADDRINUSE)"
sudo pm2 delete all 2>/dev/null || true
sudo pm2 kill 2>/dev/null || true

echo "==> Killing processes on ports (requires sudo)..."
for port in "${PORTS[@]}"; do
    sudo fuser -k "${port}/tcp" 2>/dev/null || true
done

sleep 2

echo ""
echo "==> Port status:"
for port in "${PORTS[@]}"; do
    if ss -tlnp 2>/dev/null | grep -q ":${port} "; then
        echo "  STILL IN USE — port ${port}:"
        ss -tlnp 2>/dev/null | grep ":${port} " || true
        sudo lsof -i ":${port}" 2>/dev/null || true
    else
        echo "  free — port ${port}"
    fi
done

echo ""
echo "Done. Start again with: bash deploy/restart.sh --rebuild"
