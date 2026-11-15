#!/usr/bin/env bash
# Creates /opt/jungle-village/.env ON THE SERVER. Secrets are generated or typed here, never committed, never echoed.
#   cd /opt/jungle-village && bash deploy/make-env.sh
set -euo pipefail
cd "$(dirname "$0")/.."
[ -e .env ] && { echo ".env already exists. Edit it directly (nano .env) or delete it first."; exit 1; }

read -rp "API domain (DNS record pointing at this server), e.g. api.example.com: " API_DOMAIN
read -rp "Website origin(s) allowed to call the API (comma separated), e.g. https://village.pages.dev: " CORS_ORIGIN
read -rp "Channel name shown on the site [Old School Stories TV]: " CHANNEL_NAME
CHANNEL_NAME=${CHANNEL_NAME:-Old School Stories TV}
read -rp "YouTube channel id [UCFZLzGrnth6TDH_Xyh_McBQ]: " YT_CHANNEL_ID
YT_CHANNEL_ID=${YT_CHANNEL_ID:-UCFZLzGrnth6TDH_Xyh_McBQ}
read -rsp "YouTube Data API key (input hidden, Enter to skip and use demo mode): " YT_API_KEY; echo

ADMIN_TOKEN=$(openssl rand -hex 24)
POSTGRES_PASSWORD=$(openssl rand -hex 24)
if [ -n "$YT_API_KEY" ]; then YT_MODE=apikey; else YT_MODE=mock; fi

umask 077
cat > .env <<EOF
API_DOMAIN=$API_DOMAIN
CORS_ORIGIN=$CORS_ORIGIN
CHANNEL_NAME=$CHANNEL_NAME
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
ADMIN_TOKEN=$ADMIN_TOKEN
YT_MODE=$YT_MODE
YT_API_KEY=$YT_API_KEY
YT_CHANNEL_ID=$YT_CHANNEL_ID
YT_POLL_INTERVAL_SEC=300
YT_BACKFILL_LIMIT=15
EOF
chmod 600 .env
echo
echo ".env written (mode 600). Your admin token is stored in .env as ADMIN_TOKEN. Read it with:  grep ADMIN_TOKEN .env"
echo "Next:  docker compose -f docker-compose.vps.yml up -d --build"
