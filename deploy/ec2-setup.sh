#!/bin/bash
set -euo pipefail

# EC2 setup for vercel-clone
# Run from the project root on Ubuntu 22.04/24.04 (as root or with sudo):
#   sudo bash deploy/ec2-setup.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
ENV_FILE="${APP_DIR}/.env"

echo "==> Using project directory: ${APP_DIR}"
echo "==> Installing system dependencies..."
apt-get update
apt-get install -y curl git nginx redis-server

echo "==> Installing Node.js 20..."
if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d v) -lt 20 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

echo "==> Installing PM2..."
npm install -g pm2

echo "==> Configuring Redis (local on this server)..."
systemctl enable redis-server
systemctl start redis-server

# Redis listens on 127.0.0.1 by default — api-server connects locally.
# If ECS build tasks need Redis, uncomment bind and set REDIS_URL_FOR_ECS in .env:
# sed -i 's/^bind 127.0.0.1 .*/bind 0.0.0.0/' /etc/redis/redis.conf
# systemctl restart redis-server

if [ ! -f "$ENV_FILE" ]; then
    if [ ! -f "${APP_DIR}/deploy/.env.example" ]; then
        echo "ERROR: ${APP_DIR}/deploy/.env.example not found."
        echo "Create ${ENV_FILE} manually (see deploy/DEPLOY.md) or pull the latest repo with deploy/.env.example committed."
        exit 1
    fi
    echo "==> Creating .env from example — EDIT THIS FILE before starting services!"
    cp "${APP_DIR}/deploy/.env.example" "$ENV_FILE"
fi

echo "==> Loading environment..."
set -a
source "$ENV_FILE"
set +a

echo "==> Installing npm dependencies..."
cd "$APP_DIR/api-server" && npm install
cd "$APP_DIR/s3-reverse-proxy" && npm install
cd "$APP_DIR/frontend-nextjs" && npm install

echo "==> Building frontend (NEXT_PUBLIC_* vars are baked in at build time)..."
cd "$APP_DIR/frontend-nextjs"
NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL}" NEXT_PUBLIC_SOCKET_URL="${NEXT_PUBLIC_SOCKET_URL}" npm run build

echo "==> Starting services with PM2..."
cd "$APP_DIR"
set -a && source "$ENV_FILE" && set +a
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || pm2 startup

echo "==> Configuring nginx..."
if [ -n "${DOMAIN:-}" ]; then
    sed "s/YOUR_DOMAIN/${DOMAIN}/g" "${APP_DIR}/deploy/nginx.conf" > /etc/nginx/sites-available/vercel-clone
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
echo "Edit ${ENV_FILE} then run: bash deploy/restart.sh"
echo "View logs: pm2 logs"
