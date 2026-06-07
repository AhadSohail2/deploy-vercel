#!/bin/bash
set -euo pipefail

# Restart PM2 services. Run as your normal user (ubuntu) — NOT sudo:
#   bash deploy/restart.sh --rebuild
#   bash deploy/restart.sh --nginx    (only nginx step uses sudo internally)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
ENV_FILE="${APP_DIR}/.env"
NGINX_GEN="${APP_DIR}/deploy/.nginx.generated.conf"
APP_USER="$(whoami)"

REBUILD=false
RELOAD_NGINX=false

for arg in "$@"; do
    case "$arg" in
        --rebuild|-b) REBUILD=true ;;
        --nginx|-n) RELOAD_NGINX=true ;;
        --help|-h)
            echo "Usage: bash deploy/restart.sh [--rebuild] [--nginx]"
            echo ""
            echo "  Run as ubuntu, NOT sudo. Example:"
            echo "    bash deploy/restart.sh --rebuild"
            echo "    bash deploy/restart.sh --nginx"
            exit 0
            ;;
        *)
            echo "Unknown option: $arg (use --help)"
            exit 1
            ;;
    esac
done

if [ "$(id -u)" -eq 0 ]; then
    echo "ERROR: Do not run this script with sudo."
    echo "Run as your normal user: bash deploy/restart.sh --rebuild"
    echo "If you have permission errors first run: bash deploy/fix-permissions.sh"
    exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: ${ENV_FILE} not found."
    echo "Copy deploy/.env.example to .env and fill in your values."
    exit 1
fi

if [ -d "${APP_DIR}/frontend-nextjs/.next" ] && [ ! -w "${APP_DIR}/frontend-nextjs/.next" ]; then
    echo "ERROR: .next is owned by root (from a previous sudo run)."
    echo "Run: bash deploy/fix-permissions.sh"
    exit 1
fi

echo "==> Using project directory: ${APP_DIR}"
echo "==> Loading environment..."
set -a
source "$ENV_FILE"
set +a

echo "==> Installing npm dependencies..."
cd "${APP_DIR}/api-server" && npm install
cd "${APP_DIR}/s3-reverse-proxy" && npm install
cd "${APP_DIR}/frontend-nextjs" && npm install

if [ "$REBUILD" = true ] || [ ! -d "${APP_DIR}/frontend-nextjs/.next" ]; then
    echo "==> Building frontend..."
    cd "${APP_DIR}/frontend-nextjs"
    NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-}" \
        NEXT_PUBLIC_SOCKET_URL="${NEXT_PUBLIC_SOCKET_URL:-}" \
        npm run build
fi

echo "==> Checking Redis..."
if ! redis-cli ping &>/dev/null; then
    echo "WARNING: Redis is not responding. Starting redis-server..."
    sudo systemctl start redis-server || true
fi

cd "$APP_DIR"

echo "==> Stopping all services and freeing ports..."
bash "${APP_DIR}/deploy/stop-all.sh"

echo "==> Starting PM2 services..."
pm2 start deploy/ecosystem.config.js
pm2 save

echo "==> Waiting for services to bind ports..."
sleep 5

if [ "$RELOAD_NGINX" = true ]; then
    if [ -z "${DOMAIN:-}" ]; then
        echo "WARNING: DOMAIN not set — skipping nginx reload"
    else
        echo "==> Reloading nginx..."
        sed "s/YOUR_DOMAIN/${DOMAIN}/g" "${APP_DIR}/deploy/nginx.conf" > "$NGINX_GEN"
        sudo cp "$NGINX_GEN" /etc/nginx/sites-available/vercel-clone
        sudo ln -sf /etc/nginx/sites-available/vercel-clone /etc/nginx/sites-enabled/vercel-clone
        sudo rm -f /etc/nginx/sites-enabled/default
        sudo nginx -t
        sudo systemctl reload nginx
    fi
fi

echo ""
echo "=== Restart complete ==="
echo "(PM2 shows a table when starting — that is normal. You have one PM2 daemon.)"
echo ""
echo "Health check:"
if curl -s --connect-timeout 3 http://127.0.0.1:3000 -o /dev/null 2>&1; then
    echo "  frontend :3000  OK"
else
    echo "  frontend :3000  FAIL — run: pm2 logs frontend"
fi
if curl -s --connect-timeout 3 http://127.0.0.1:9000 -o /dev/null 2>&1; then
    echo "  api      :9000  OK"
else
    echo "  api      :9000  FAIL — run: pm2 logs api-server"
fi
if curl -s --connect-timeout 3 "http://127.0.0.1:9002/socket.io/?EIO=4&transport=polling" -o /dev/null 2>&1; then
    echo "  socket   :9002  OK"
else
    echo "  socket   :9002  FAIL — run: pm2 logs api-server"
fi
if curl -s --connect-timeout 3 http://127.0.0.1:8000 -o /dev/null 2>&1; then
    echo "  s3-proxy :8000  OK"
else
    echo "  s3-proxy :8000  FAIL — run: pm2 logs s3-reverse-proxy"
fi
echo ""
echo "View logs: pm2 logs"
echo "Check status anytime: pm2 status"
