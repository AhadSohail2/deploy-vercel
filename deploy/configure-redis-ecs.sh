#!/bin/bash
# Expose Redis on EC2 private IP for ECS Fargate build tasks.
# Run with sudo: sudo bash deploy/configure-redis-ecs.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="${APP_DIR:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
ENV_FILE="${APP_DIR}/.env"
REDIS_CONF="/etc/redis/redis.conf"

if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: Run with sudo: sudo bash deploy/configure-redis-ecs.sh"
    exit 1
fi

get_private_ip() {
    if [ -n "${EC2_PRIVATE_IP:-}" ]; then
        echo "$EC2_PRIVATE_IP"
        return
    fi
    curl -sf --connect-timeout 2 http://169.254.169.254/latest/meta-data/local-ipv4 \
        || hostname -I | awk '{print $1}'
}

PRIVATE_IP="$(get_private_ip)"
if [ -z "$PRIVATE_IP" ]; then
    echo "ERROR: Could not detect EC2 private IP (expected 172.31.x.x). Set EC2_PRIVATE_IP and re-run."
    exit 1
fi

if [[ ! "$PRIVATE_IP" =~ ^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.) ]]; then
    echo "WARNING: ${PRIVATE_IP} does not look like a private IP. ECS tasks need the VPC private IP, not the public IP."
fi

REDIS_URL_FOR_ECS="redis://${PRIVATE_IP}:6379"

echo "==> Configuring Redis on private IP ${PRIVATE_IP}:6379"

cp "$REDIS_CONF" "${REDIS_CONF}.bak.$(date +%s)"

if grep -q '^bind ' "$REDIS_CONF"; then
    sed -i "s/^bind .*/bind 127.0.0.1 ${PRIVATE_IP}/" "$REDIS_CONF"
else
    echo "bind 127.0.0.1 ${PRIVATE_IP}" >> "$REDIS_CONF"
fi

if grep -q '^protected-mode ' "$REDIS_CONF"; then
    sed -i 's/^protected-mode yes/protected-mode no/' "$REDIS_CONF"
else
    echo "protected-mode no" >> "$REDIS_CONF"
fi

systemctl restart redis-server
sleep 1

redis-cli -h 127.0.0.1 ping | grep -q PONG

if [ ! -f "$ENV_FILE" ]; then
    cp "${APP_DIR}/deploy/.env.example" "$ENV_FILE"
fi

if grep -q '^REDIS_URL_FOR_ECS=' "$ENV_FILE"; then
    sed -i "s|^REDIS_URL_FOR_ECS=.*|REDIS_URL_FOR_ECS=${REDIS_URL_FOR_ECS}|" "$ENV_FILE"
else
    echo "REDIS_URL_FOR_ECS=${REDIS_URL_FOR_ECS}" >> "$ENV_FILE"
fi

grep -q '^REDIS_URL=' "$ENV_FILE" || echo "REDIS_URL=redis://127.0.0.1:6379" >> "$ENV_FILE"

chown "${SUDO_USER:-ubuntu}:${SUDO_USER:-ubuntu}" "$ENV_FILE" 2>/dev/null || true

echo ""
echo "=== Done ==="
echo "  REDIS_URL=redis://127.0.0.1:6379          (api-server on EC2)"
echo "  REDIS_URL_FOR_ECS=${REDIS_URL_FOR_ECS}    (ECS build tasks)"
echo ""
echo "Do NOT use the public IP (32.x.x.x) for REDIS_URL_FOR_ECS."
echo "Allow TCP 6379 in EC2 security group from VPC CIDR only."
echo "Then: pm2 restart api-server"
