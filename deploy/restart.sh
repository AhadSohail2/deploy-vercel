#!/bin/bash
set -euo pipefail

# Restart PM2 services. Run from anywhere:
#   bash deploy/restart.sh
#   bash deploy/restart.sh --rebuild   # rebuild frontend (after NEXT_PUBLIC_* changes)
#   bash deploy/restart.sh --nginx      # reload nginx config (requires sudo)
#   bash deploy/restart.sh --rebuild --nginx

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
ENV_FILE="${APP_DIR}/.env"

REBUILD=false
RELOAD_NGINX=false

for arg in "$@"; do
    case "$arg" in
        --rebuild|-b) REBUILD=true ;;
        --nginx|-n) RELOAD_NGINX=true ;;
        --help|-h)
            echo "Usage: bash deploy/restart.sh [--rebuild] [--nginx]"
            echo "  --rebuild, -b   Rebuild frontend before restart"
            echo "  --nginx,   -n   Reload nginx (needs sudo)"
            exit 0
            ;;
        *)
            echo "Unknown option: $arg (use --help)"
            exit 1
            ;;
    esac
done

if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: ${ENV_FILE} not found."
    echo "Copy deploy/.env.example to .env and fill in your values."
    exit 1
fi

echo "==> Using project directory: ${APP_DIR}"
echo "==> Loading environment..."
set -a
source "$ENV_FILE"
set +a

if [ "$REBUILD" = true ]; then
    echo "==> Rebuilding frontend..."
    cd "${APP_DIR}/frontend-nextjs"
    NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-}" \
        NEXT_PUBLIC_SOCKET_URL="${NEXT_PUBLIC_SOCKET_URL:-}" \
        npm run build
fi

cd "$APP_DIR"

echo "==> Restarting PM2 services..."
if pm2 describe api-server &>/dev/null; then
    pm2 restart deploy/ecosystem.config.js --update-env
else
    echo "PM2 apps not running — starting fresh..."
    pm2 start deploy/ecosystem.config.js
fi
pm2 save

if [ "$RELOAD_NGINX" = true ]; then
    if [ -z "${DOMAIN:-}" ]; then
        echo "WARNING: DOMAIN not set — skipping nginx reload"
    else
        echo "==> Reloading nginx..."
        sed "s/YOUR_DOMAIN/${DOMAIN}/g" "${APP_DIR}/deploy/nginx.conf" > /tmp/vercel-clone-nginx.conf
        sudo cp /tmp/vercel-clone-nginx.conf /etc/nginx/sites-available/vercel-clone
        sudo ln -sf /etc/nginx/sites-available/vercel-clone /etc/nginx/sites-enabled/vercel-clone
        sudo nginx -t
        sudo systemctl reload nginx
    fi
fi

echo ""
echo "=== Restart complete ==="
pm2 status
echo ""
echo "View logs: pm2 logs"
