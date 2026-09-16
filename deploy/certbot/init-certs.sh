#!/usr/bin/env sh
# First-time Let's Encrypt certificate for ts.slovekpixel.ru
# Prerequisites: DNS A record points to this server; ports 80/443 open; stack is up.
set -e

DOMAIN="${DOMAIN:-ts.slovekpixel.ru}"
EMAIL="${CERTBOT_EMAIL:?Set CERTBOT_EMAIL in .env}"

cd "$(dirname "$0")/../.."

# Load CERTBOT_EMAIL / DOMAIN from .env if present
if [ -f .env ]; then
  # shellcheck disable=SC1091
  set -a
  . ./.env
  set +a
fi

DOMAIN="${DOMAIN:-ts.slovekpixel.ru}"
EMAIL="${CERTBOT_EMAIL:?Set CERTBOT_EMAIL in .env}"

echo "Requesting certificate for ${DOMAIN}..."
docker compose --profile certbot run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "${EMAIL}" \
  --agree-tos \
  --no-eff-email \
  --force-renewal \
  -d "${DOMAIN}"

echo "Reloading nginx..."
docker compose exec nginx nginx -s reload

echo "Done. Site: https://${DOMAIN}"
echo "TeamSpeak client: ${DOMAIN} (UDP 9987)"
