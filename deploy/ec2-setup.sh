#!/bin/bash
set -euo pipefail

# EC2 setup — installs system packages as root, runs npm/PM2 as ubuntu:
#   sudo bash deploy/ec2-setup.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
ENV_FILE="${APP_DIR}/.env"
APP_USER="${SUDO_USER:-ubuntu}"

run_as_user() {
    if [ "$(id -u)" -eq 0 ]; then
        sudo -u "$APP_USER" bash -lc "$*"
    else
        bash -lc "$*"
    fi
}

echo "==> Using project directory: ${APP_DIR}"
echo "==> App user: ${APP_USER}"

if [ "$(id -u)" -eq 0 ]; then
    chown -R "${APP_USER}:${APP_USER}" "$APP_DIR"
fi

echo "==> Installing system dependencies..."
apt-get update
apt-get install -y curl git nginx redis-server

echo "==> Installing Node.js 22..."
if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d v) -lt 22 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y nodejs
fi

echo "==> Installing PM2 for ${APP_USER}..."
run_as_user "npm install -g pm2"

echo "==> Configuring Redis (local on this server)..."
systemctl enable redis-server
systemctl start redis-server

if [ ! -f "$ENV_FILE" ]; then
    if [ ! -f "${APP_DIR}/deploy/.env.example" ]; then
        echo "ERROR: ${APP_DIR}/deploy/.env.example not found."
        echo "Create ${ENV_FILE} manually (see deploy/DEPLOY.md) or pull the latest repo with deploy/.env.example committed."
        exit 1
    fi
    echo "==> Creating .env from example — EDIT THIS FILE before starting services!"
    cp "${APP_DIR}/deploy/.env.example" "$ENV_FILE"
    chown "${APP_USER}:${APP_USER}" "$ENV_FILE"
fi

echo "==> Loading environment..."
set -a
source "$ENV_FILE"
set +a

echo "==> Installing npm dependencies (as ${APP_USER})..."
run_as_user "cd '${APP_DIR}/api-server' && npm install"
run_as_user "cd '${APP_DIR}/build-server' && npm install"
run_as_user "cd '${APP_DIR}/s3-reverse-proxy' && npm install"
run_as_user "cd '${APP_DIR}/frontend-nextjs' && npm install"

echo "==> Building frontend (NEXT_PUBLIC_* vars are baked in at build time)..."
run_as_user "cd '${APP_DIR}/frontend-nextjs' && NEXT_PUBLIC_API_URL='${NEXT_PUBLIC_API_URL:-}' NEXT_PUBLIC_SOCKET_URL='${NEXT_PUBLIC_SOCKET_URL:-}' npm run build"

echo "==> Starting services with PM2 (as ${APP_USER})..."
run_as_user "cd '${APP_DIR}' && pm2 delete all 2>/dev/null || true"
run_as_user "cd '${APP_DIR}' && pm2 start deploy/ecosystem.config.js"
run_as_user "pm2 save"
run_as_user "pm2 startup systemd -u ${APP_USER} --hp /home/${APP_USER}" || true

echo "==> Configuring nginx..."
if [ -n "${DOMAIN:-}" ]; then
    sed "s/YOUR_DOMAIN/${DOMAIN}/g" "${APP_DIR}/deploy/nginx.conf" > "${APP_DIR}/deploy/.nginx.generated.conf"
    chown "${APP_USER}:${APP_USER}" "${APP_DIR}/deploy/.nginx.generated.conf"
    cp "${APP_DIR}/deploy/.nginx.generated.conf" /etc/nginx/sites-available/vercel-clone
    ln -sf /etc/nginx/sites-available/vercel-clone /etc/nginx/sites-enabled/vercel-clone
    rm -f /etc/nginx/sites-enabled/default
    nginx -t
    systemctl enable nginx
    systemctl restart nginx
else
    echo "WARNING: DOMAIN not set in .env — configure nginx manually from deploy/nginx.conf"
fi

echo ""
echo "=== Setup complete ==="
echo "Ports:"
echo "  nginx:            80"
echo "  Frontend:         3000  (proxied via nginx)"
echo "  API:              9000  (proxied at /api)"
echo "  Socket.IO:        9002  (proxied at /socket.io)"
echo "  S3 reverse proxy: 8000  (*.${DOMAIN:-localhost})"
echo "  Redis:            6379"
echo ""
echo "Open http://${DOMAIN:-localhost} in your browser (port 80, not :3000)"
echo ""
echo "After .env changes run (as ${APP_USER}, NOT sudo): bash deploy/restart.sh --rebuild"
echo "View logs: pm2 logs"
