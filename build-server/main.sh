#!/bin/bash
set -euo pipefail

export GIT_REPOSITORY__URL="${GIT_REPOSITORY__URL:?GIT_REPOSITORY__URL is required}"

echo "=== Build container starting ==="
echo "PROJECT_ID=${PROJECT_ID:-not set}"
echo "REDIS_URL=${REDIS_URL:-not set}"
echo "S3_BUCKET=${S3_BUCKET:-not set}"
echo "GIT_REPOSITORY__URL=${GIT_REPOSITORY__URL}"

git clone "$GIT_REPOSITORY__URL" /home/app/output

exec node /home/app/script.js
