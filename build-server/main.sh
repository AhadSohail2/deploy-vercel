#!/bin/bash
set -euo pipefail

export GIT_REPOSITORY__URL="${GIT_REPOSITORY__URL:?GIT_REPOSITORY__URL is required}"

echo "=== Build container starting ==="
echo "PROJECT_ID=${PROJECT_ID:-not set}"
echo "REDIS_URL=${REDIS_URL:-not set}"
echo "S3_BUCKET=${S3_BUCKET:-not set}"
echo "GIT_REPOSITORY__URL=${GIT_REPOSITORY__URL}"
node --version
npm --version

echo "Cloning repository (shallow)..."
if ! git clone --depth 1 "$GIT_REPOSITORY__URL" /home/app/output; then
    echo "ERROR: git clone failed for ${GIT_REPOSITORY__URL}"
    exit 1
fi

echo "Git clone complete — starting build script"
exec node /home/app/script.js
